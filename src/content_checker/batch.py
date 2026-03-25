"""Batch handler for the content standards checker.

Checks multiple content items through the pipeline, then runs cross-snippet
consistency standards (CON-01, CON-04, TRN-07) across the full set.

This is the module that makes Figma multi-select and code scanning work.
Single-string mode can't detect terminology inconsistency — batch mode can.
"""

from __future__ import annotations

import json
import time

from content_checker.filter import get_multi_snippet_standards
from content_checker.models import (
    BatchResult,
    ConsistencyViolation,
    ContentItem,
    ItemResult,
    TokenUsage,
)
from content_checker.pipeline import check
from content_checker.standards.loader import load_standards


def _build_consistency_prompt(multi_standards: list[dict]) -> str:
    """Build the system prompt for cross-snippet consistency checking."""
    standards_text = ""
    for std in multi_standards:
        standards_text += f"\n### {std['id']}: {std['rule']}\n"
        standards_text += f"- Correct: {std['correct']}\n"
        standards_text += f"- Incorrect: {std['incorrect']}\n"

    return (
        "You are a content consistency checker. You review a set of UI copy strings "
        "that appear in the same product or flow, and check whether they use terminology "
        "consistently.\n\n"
        f"Check against these standards:\n{standards_text}\n\n"
        "Review all the strings as a set. Look for:\n"
        "- Different words used for the same concept (e.g., 'settings' in one place "
        "and 'preferences' in another)\n"
        "- Different verbs for the same action (e.g., 'delete' and 'remove' for the "
        "same operation)\n"
        "- Synonyms that could confuse translators or users\n\n"
        "Only flag genuine inconsistencies where the same concept is referred to with "
        "different terms. Different terms for genuinely different concepts are acceptable.\n\n"
        "If no consistency issues are found, return an empty violations list.\n\n"
        "Respond in this exact JSON format (no markdown, no backticks):\n"
        "{\n"
        '  "violations": [\n'
        "    {\n"
        '      "standard_id": "the standard ID",\n'
        '      "issue": "describe the inconsistency",\n'
        '      "suggestion": "which term to standardize on and why",\n'
        '      "items_involved": ["the specific strings that conflict"]\n'
        "    }\n"
        "  ]\n"
        "}"
    )


def _check_consistency(
    items: list[ContentItem],
    model: str = "claude-sonnet-4-20250514",
) -> tuple[list[ConsistencyViolation], float, TokenUsage]:
    """Run cross-snippet consistency checks across all items.

    Only runs if there are 2+ items. Checks CON-01, CON-04, and TRN-07.

    Returns (violations, latency, tokens).
    """
    if len(items) < 2:
        return [], 0.0, TokenUsage()

    import anthropic

    standards_data = load_standards()

    # Get the multi-snippet standard IDs
    multi_ids = set(get_multi_snippet_standards(standards_data))
    if not multi_ids:
        return [], 0.0, TokenUsage()

    # Collect the full standard objects
    multi_standards = []
    for cat in standards_data["categories"]:
        for std in cat["standards"]:
            if std["id"] in multi_ids:
                multi_standards.append(std)

    system_prompt = _build_consistency_prompt(multi_standards)

    # Build the user message with all strings
    items_text = "Here are the content strings to check for consistency:\n\n"
    for i, item in enumerate(items, 1):
        label = item.label or f"String {i}"
        items_text += f'{i}. [{label}] "{item.text}"\n'

    client = anthropic.Anthropic()

    start = time.time()
    response = client.messages.create(
        model=model,
        max_tokens=1000,
        system=system_prompt,
        messages=[{"role": "user", "content": items_text}],
    )
    latency = time.time() - start

    tokens = TokenUsage(
        input=response.usage.input_tokens,
        output=response.usage.output_tokens,
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        return [], latency, tokens

    violations = []
    # Look up rule text for each violation
    rule_lookup = {std["id"]: std["rule"] for std in multi_standards}

    for v in result.get("violations", []):
        std_id = v.get("standard_id", "")
        violations.append(
            ConsistencyViolation(
                standard_id=std_id,
                rule=rule_lookup.get(std_id, ""),
                issue=v.get("issue", ""),
                suggestion=v.get("suggestion", ""),
                items_involved=v.get("items_involved", []),
            )
        )

    return violations, latency, tokens


def check_batch(
    items: list[ContentItem],
    model: str = "claude-sonnet-4-20250514",
    use_llm_classifier: bool = True,
    skip_consistency: bool = False,
) -> BatchResult:
    """Check a batch of content items through the full pipeline.

    Runs each item through check() individually, then runs cross-snippet
    consistency standards across the full set.

    Args:
        items: Content items to check.
        model: Claude model for all LLM calls.
        use_llm_classifier: Use LLM for classification.
        skip_consistency: Skip the cross-snippet consistency check.

    Returns:
        BatchResult with per-item results and consistency violations.
    """
    batch = BatchResult()

    # Phase 1: Check each item individually
    for item in items:
        content_type = item.content_type or None

        result, latency, tokens = check(
            item.text,
            content_type=content_type,
            model=model,
            use_llm_classifier=use_llm_classifier,
        )

        batch.item_results.append(
            ItemResult(item=item, result=result, latency=latency, tokens=tokens)
        )
        batch.total_latency += latency
        batch.total_tokens += tokens

    # Phase 2: Cross-snippet consistency check
    if not skip_consistency and len(items) >= 2:
        consistency_violations, con_latency, con_tokens = _check_consistency(
            items, model=model,
        )
        batch.consistency_violations = consistency_violations
        batch.total_latency += con_latency
        batch.total_tokens += con_tokens

    # Determine overall verdict
    any_item_failed = any(
        r.result.overall_verdict == "fail" for r in batch.item_results
    )
    has_consistency_issues = len(batch.consistency_violations) > 0

    if any_item_failed or has_consistency_issues:
        batch.overall_verdict = "fail"
    else:
        batch.overall_verdict = "pass"

    return batch
