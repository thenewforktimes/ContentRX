"""Deterministic pre-processing for mechanical content standards.

Runs regex and pattern-matching checks before the LLM call. Catches binary,
character-level violations that the model consistently misses.

Each check returns a list of Violation objects.
"""

from __future__ import annotations

import re

from content_checker.models import Violation

# ---------------------------------------------------------------------------
# GRM-01: Oxford comma
# ---------------------------------------------------------------------------


def check_oxford_comma(text: str) -> list[Violation]:
    """Flag lists of 3+ items missing the serial comma before 'and'/'or'."""
    violations = []
    sentences = re.split(r"(?<=[.!?])\s+", text)

    for sentence in sentences:
        for match in re.finditer(r"\s+(and|or)\s+", sentence, re.IGNORECASE):
            conj = match.group(1)
            before = sentence[: match.start()]

            if "," not in before:
                continue

            before_stripped = before.rstrip()
            if before_stripped.endswith(","):
                continue

            segments = before.split(",")
            if len(segments) < 2:
                continue

            last_segment = segments[-1].strip()
            if not last_segment or len(last_segment.split()) > 6:
                continue

            violations.append(
                Violation(
                    standard_id="GRM-01",
                    rule="Use the serial comma (Oxford comma) in lists of three or more items.",
                    issue=f"Missing Oxford comma before '{conj}' in a list of 3 or more items.",
                    suggestion=f"Add a comma before '{conj}': '...{last_segment}, {conj} ...'",
                    source="deterministic",
                )
            )
            break

    return violations


# ---------------------------------------------------------------------------
# GRM-04: Ampersands
# ---------------------------------------------------------------------------

_BRAND_AMPERSANDS = {
    "at&t", "h&m", "m&m", "m&ms", "m&m's", "p&g", "s&p", "a&w", "a&e",
    "b&h", "d&g", "r&d", "h&r", "c&a", "t&c",
    "barnes & noble", "bed bath & beyond", "ben & jerry", "ben & jerry's",
    "dolce & gabbana", "ernst & young", "johnson & johnson",
    "procter & gamble", "simon & schuster", "tiffany & co",
    "arm & hammer", "jack & jones",
}


def check_ampersand(text: str) -> list[Violation]:
    """Flag ampersands that aren't part of a known brand name."""
    if "&" not in text:
        return []

    text_lower = text.lower()
    for brand in _BRAND_AMPERSANDS:
        if brand in text_lower:
            text_lower = text_lower.replace(brand, "")

    if "&" not in text_lower:
        return []

    return [
        Violation(
            standard_id="GRM-04",
            rule="Don't use ampersands in copy unless they are part of a brand name.",
            issue="Contains an ampersand (&) that is not part of a recognized brand name.",
            suggestion="Replace '&' with 'and'.",
            source="deterministic",
        )
    ]


# ---------------------------------------------------------------------------
# GRM-05: Numerals vs. spelled-out numbers
# ---------------------------------------------------------------------------

_NUMBER_WORDS = {
    "zero", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
    "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
    "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    "hundred", "thousand", "million", "billion",
}

_NUMBER_EXCEPTIONS = {
    "one", "once", "none", "anyone", "someone", "everyone", "no one",
}

_COMPOUND_NUMBER_PATTERN = re.compile(
    r"\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)"
    r"[- ](one|two|three|four|five|six|seven|eight|nine)\b",
    re.IGNORECASE,
)


def check_numerals(text: str) -> list[Violation]:
    """Flag spelled-out numbers that should be numerals per GRM-05."""
    found_spelled_out = []
    sentences = re.split(r"(?<=[.!?])\s+", text)

    for sentence in sentences:
        words = sentence.split()
        if not words:
            continue

        first_word_idx = 0
        for i, w in enumerate(words):
            stripped = w.lstrip("\"'\"\"''([")
            if stripped:
                first_word_idx = i
                break

        for i, word in enumerate(words):
            clean = word.strip(".,;:!?'\"()[]{}\"\"''—–-").lower()

            if i == first_word_idx:
                continue
            if clean in _NUMBER_EXCEPTIONS:
                continue
            if clean in _NUMBER_WORDS:
                found_spelled_out.append(word.strip(".,;:!?"))

        if sentence:
            for match in _COMPOUND_NUMBER_PATTERN.finditer(sentence):
                if match.start() == 0:
                    continue
                before = sentence[: match.start()].strip()
                if not before:
                    continue
                found_spelled_out.append(match.group(0))

    if not found_spelled_out:
        return []

    examples = ", ".join(f"'{w}'" for w in found_spelled_out[:3])
    return [
        Violation(
            standard_id="GRM-05",
            rule="Use numerals for numbers in body copy. Spell out a number only when it begins a sentence.",
            issue=f"Spelled-out number(s) found in body copy: {examples}. Use numerals instead.",
            suggestion="Replace spelled-out numbers with numerals (e.g., 'two' → '2', 'five' → '5'). Numbers at the start of a sentence can stay spelled out.",
            source="deterministic",
        )
    ]


# ---------------------------------------------------------------------------
# CON-03: Date format
# ---------------------------------------------------------------------------

_NUMERIC_DATE_PATTERN = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b")


def check_date_format(text: str) -> list[Violation]:
    """Flag numeric-only date formats that should spell out the month."""
    matches = _NUMERIC_DATE_PATTERN.findall(text)
    if not matches:
        return []

    example = f"{matches[0][0]}/{matches[0][1]}/{matches[0][2]}"
    return [
        Violation(
            standard_id="CON-03",
            rule="Use consistent date and time formats. Spell out the month to avoid ambiguity.",
            issue=f"Numeric date format found ('{example}'). Spelled-out months avoid ambiguity across locales.",
            suggestion="Use a format like 'March 16, 2026' instead of numeric dates.",
            source="deterministic",
        )
    ]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_preprocess(text: str) -> list[Violation]:
    """Run all deterministic checks. Returns a list of Violations."""
    violations: list[Violation] = []
    violations.extend(check_oxford_comma(text))
    violations.extend(check_ampersand(text))
    violations.extend(check_numerals(text))
    violations.extend(check_date_format(text))
    return violations
