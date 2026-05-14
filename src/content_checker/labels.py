"""Human-readable display labels for content standards.

Every standard ID maps to a single scannable word or short phrase
that tells the user what to fix. These labels are the primary
visual identifier in all output surfaces — the Figma plugin, the
CLI, the eval runner, and any future API.

The standard ID (e.g., CON-02) still appears as secondary reference
text for traceability. But the display label is what the user's
eye hits first.

Design principles:
    - One word when possible, two at most.
    - Describes what to fix, not the category of problem.
      "Casing" tells you what to look at. "Consistency" doesn't.
    - Same label regardless of output surface. If the plugin says
      "Casing" and the CLI says "CON-02", users lose trust.
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# Standard ID → display label mapping
#
# Organized by category for maintainability. When a new standard is
# added, add its label here. The get_display_label() function falls
# back to the standard ID if no label is defined, so missing entries
# degrade gracefully rather than crashing.
# ---------------------------------------------------------------------------

DISPLAY_LABELS: dict[str, str] = {
    # Grammar and mechanics
    "GRM-01": "Punctuation",
    "GRM-02": "Abbreviations",
    "GRM-03": "Punctuation",
    "GRM-04": "Punctuation",
    "GRM-05": "Numerals",
    "GRM-06": "Hyphenation",
    "GRM-07": "Em dashes",

    # Consistency
    "CON-01": "Terminology",
    "CON-02": "Casing",
    "CON-03": "Date format",
    "CON-04": "Terminology",
    "CON-05": "Product names",

    # Clarity
    "CLR-01": "Clarity",
    "CLR-02": "Clarity",
    "CLR-03": "Sentence length",
    "CLR-04": "One idea per sentence",
    "CLR-05": "Plain phrasing",

    # Voice and tone
    "VT-01": "Voice",
    "VT-02": "Voice",
    "VT-03": "Tone",
    "VT-04": "Tone",
    "VT-05": "Empathy",

    # Structure
    "STR-01": "Structure",
    "STR-02": "Structure",
    "STR-03": "Structure",
    "STR-04": "Hierarchy",
    "STR-05": "Lists",
    "STR-06": "Heading hierarchy",

    # Actionability
    "ACT-01": "Action verbs",
    "ACT-02": "Action verbs",
    "ACT-03": "Constructive framing",
    "ACT-04": "Next step",

    # Accessibility
    "ACC-01": "Accessibility",
    "ACC-02": "Accessibility",
    "ACC-03": "Accessibility",
    "ACC-04": "Accessibility",
    "ACC-05": "Alt text",
    "ACC-06": "Accessibility",
    "ACC-07": "Form labels",
    "ACC-08": "Device-neutral verbs",

    # Inclusivity
    "INC-01": "Inclusive language",
    "INC-02": "Inclusive language",

    # Translation readiness
    "TRN-01": "Translation",
    "TRN-02": "Translation",
    "TRN-03": "Translation",
    "TRN-04": "Translation",
    "TRN-05": "Translation",
    "TRN-06": "Translation",
    "TRN-07": "Translation",

    # Proofing (deterministic preprocessor checks)
    "PRF-01": "Proofing",
    "PRF-02": "Proofing",
    "PRF-03": "Proofing",
    "PRF-04": "Proofing",
    "PRF-05": "Proofing",
    "PRF-06": "Proofing",
    "PRF-07": "Proofing",
    "PRF-08": "Placeholder",
    "PRF-09": "Readability",
    "PRF-10": "Accessibility",
    "PRF-11": "Tone",
}


# ---------------------------------------------------------------------------
# Standard ID → customer-facing CATEGORY (schema 2.5.0)
#
# Findings on the Document-tier dashboard are grouped by category
# instead of rendered as a flat list. The category mapping is the
# customer-facing taxonomy on the public envelope. Substrate
# standard_ids stay private (per ADR 2026-04-25); customers see the
# category label only.
#
# When adding a new standard, add its category here. The fallback for
# unknown / LLM-emitted findings without a standard_id is "Big picture"
# — those are document-shape observations (incoherence, idiom-rich,
# wall-of-text) that don't map to a specific rule.
# ---------------------------------------------------------------------------

# Customer-facing category labels. The mapping has six buckets:
#   - Big picture: document-shape observations from the LLM scan
#   - Voice & tone: hedging, jargon, register, action verbs
#   - Mechanics: grammar, conventions, proofing
#   - Structure: sentence length, paragraph layout
#   - Accessibility: link text, device verbs, alt text, etc.
#   - Inclusion: gendered language, non-inclusive terminology
#
# Buckets are intentionally few — too many categories defeats the
# purpose of grouping. If a customer can't choose between five
# meaningful buckets in two seconds, the grouping isn't helping.
STANDARD_CATEGORY: dict[str, str] = {
    # Voice & tone — speaks to *how* the content sounds.
    "VT-01": "Voice & tone",
    "VT-02": "Voice & tone",
    "VT-03": "Voice & tone",
    "VT-04": "Voice & tone",
    "VT-05": "Voice & tone",
    "VT-06": "Voice & tone",
    "VT-07": "Voice & tone",
    "ACT-01": "Voice & tone",
    "ACT-02": "Voice & tone",
    "ACT-03": "Voice & tone",
    "ACT-04": "Voice & tone",
    "CLR-01": "Voice & tone",  # plain language / banned words
    "CLR-02": "Voice & tone",  # lead with most important info
    "CLR-04": "Voice & tone",
    "CLR-05": "Voice & tone",
    "CLR-06": "Voice & tone",  # short words
    "CLR-07": "Voice & tone",  # benefit-first (P2)
    "PRF-11": "Voice & tone",  # dismissive language

    # Mechanics — grammar, punctuation, conventions, proofing.
    "GRM-01": "Mechanics",
    "GRM-02": "Mechanics",
    "GRM-03": "Mechanics",
    "GRM-04": "Mechanics",
    "GRM-05": "Mechanics",
    "GRM-06": "Mechanics",
    "GRM-07": "Mechanics",
    "GRM-08": "Mechanics",
    "CON-01": "Mechanics",
    "CON-02": "Mechanics",
    "CON-03": "Mechanics",
    "CON-04": "Mechanics",
    "CON-05": "Mechanics",
    "PRF-01": "Mechanics",
    "PRF-02": "Mechanics",
    "PRF-03": "Mechanics",
    "PRF-04": "Mechanics",
    "PRF-05": "Mechanics",
    "PRF-06": "Mechanics",
    "PRF-07": "Mechanics",
    "PRF-08": "Mechanics",
    "PRF-09": "Mechanics",
    "PRF-10": "Mechanics",

    # Structure — sentence length, paragraph layout, hierarchy.
    "CLR-03": "Structure",
    "STR-01": "Structure",
    "STR-02": "Structure",
    "STR-03": "Structure",
    "STR-04": "Structure",
    "STR-05": "Structure",
    "STR-06": "Structure",
    "STR-07": "Structure",  # mobile readable (P2)

    # Accessibility — vague link text, device verbs, alt text.
    "ACC-01": "Accessibility",
    "ACC-02": "Accessibility",
    "ACC-03": "Accessibility",
    "ACC-04": "Accessibility",
    "ACC-05": "Accessibility",
    "ACC-06": "Accessibility",
    "ACC-07": "Accessibility",
    "ACC-08": "Accessibility",  # device verbs (v4.7.1)

    # Inclusion — gendered language, non-inclusive terminology.
    "INC-01": "Inclusion",
    "INC-02": "Inclusion",

    # Translation readiness folds into Mechanics — these are typically
    # syntactic/punctuation issues that hurt MT and i18n. Keeping it
    # under Mechanics avoids a 7th bucket the customer doesn't need.
    "TRN-01": "Mechanics",
    "TRN-02": "Mechanics",
    "TRN-03": "Mechanics",
    "TRN-04": "Mechanics",
    "TRN-05": "Mechanics",
    "TRN-06": "Mechanics",
    "TRN-07": "Mechanics",
}

# Default category for findings without a standard_id (LLM-emitted
# document-shape observations) or with an unrecognized standard_id.
# Big picture findings render with a distinct visual treatment in the
# UI — they're observations, not anchored line edits.
DEFAULT_CATEGORY = "Big picture"


def get_category(standard_id: str | None) -> str:
    """Return the customer-facing category for a standard ID.

    Defaults to "Big picture" for findings without a standard_id (LLM-
    emitted document-shape observations) or with an unrecognized
    standard_id. The default keeps the engine forward-compatible —
    new standards added later get categorized as Big picture until the
    map is updated, rather than crashing the public projection.
    """
    if not standard_id:
        return DEFAULT_CATEGORY
    return STANDARD_CATEGORY.get(standard_id, DEFAULT_CATEGORY)


