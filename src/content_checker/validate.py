"""Validation pass for the content standards checker.

Second LLM call. Takes candidate violations from the scan phase and makes
focused yes/no judgments on each one. Injects content_type_notes for
context-specific evaluation guidance.
"""

from __future__ import annotations

import time

from content_checker.llm_json import parse_llm_json
from content_checker.models import TokenUsage, Violation


def _build_validation_prompt(content_type: str, active_notes: list[dict]) -> str:
    """Build the system prompt for the validation pass."""
    notes_text = ""
    if active_notes:
        notes_text = (
            "\n\n## Content type notes\n\n"
            "These notes provide additional context for evaluating specific "
            "standards against this content type:\n"
        )
        for note in active_notes:
            notes_text += f"\n- **{note['standard_id']}**: {note['note']}"

    return (
        "You are a content standards validator. Your job is to review candidate "
        "violations and decide whether each one is a genuine violation in context.\n\n"
        f"The content being checked was classified as: **{content_type}**\n"
        f"{notes_text}\n\n"
        "For each candidate, respond with ONLY \"confirm\" or \"reject\":\n"
        "- **confirm**: This is a genuine violation that should be reported.\n"
        "- **reject**: This is a false positive. The content is acceptable.\n\n"
        "Apply these principles:\n"
        "- If a content type note provides specific guidance, follow it.\n"
        "- If the content is borderline, reject. The bar for confirming should be high.\n"
        "- Consider whether the issue actually hurts the user experience for this content type.\n\n"
        "Respond in this exact JSON format (no markdown, no backticks):\n"
        "{\n"
        '  "validations": [\n'
        "    {\n"
        '      "standard_id": "the standard ID",\n'
        '      "verdict": "confirm" or "reject",\n'
        '      "reason": "1 sentence explaining why"\n'
        "    }\n"
        "  ]\n"
        "}"
    )


def validate_candidates(
    text: str,
    content_type: str,
    candidates: list[Violation],
    active_notes: list[dict] | None = None,
    model: str = "claude-sonnet-4-20250514",
) -> tuple[list[Violation], list[Violation], float, TokenUsage]:
    """Validate candidate violations with a focused LLM call.

    Returns (confirmed, rejected, latency, token_usage).
    """
    if not candidates:
        return [], [], 0.0, TokenUsage()

    import anthropic

    active_notes = active_notes or []
    system_prompt = _build_validation_prompt(content_type, active_notes)

    candidate_text = f'Original content ({content_type}):\n"{text}"\n\nCandidate violations to validate:\n'
    for i, v in enumerate(candidates, 1):
        candidate_text += f"\n{i}. [{v.standard_id}] {v.rule}\n"
        candidate_text += f"   Issue: {v.issue}\n"
        if v.suggestion:
            candidate_text += f"   Suggested fix: {v.suggestion}\n"

    client = anthropic.Anthropic()

    start = time.time()
    response = client.messages.create(
        model=model,
        max_tokens=1000,
        system=system_prompt,
        messages=[{"role": "user", "content": candidate_text}],
    )
    latency = time.time() - start

    tokens = TokenUsage(
        input=response.usage.input_tokens,
        output=response.usage.output_tokens,
    )

    result = parse_llm_json(response.content[0].text)
    if result is None:
        return candidates, [], latency, tokens

    validation_map = {}
    for v in result.get("validations", []):
        validation_map[v.get("standard_id")] = v.get("verdict", "confirm")

    confirmed = []
    rejected = []

    for candidate in candidates:
        verdict = validation_map.get(candidate.standard_id, "confirm")
        if verdict == "reject":
            rejected.append(candidate)
        else:
            confirmed.append(candidate)

    return confirmed, rejected, latency, tokens
