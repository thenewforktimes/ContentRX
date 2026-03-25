"""Standards filter for the content standards checker.

Filters the standards library to only standards relevant to a given content type.
Returns a pruned copy in the same structure so build_system_prompt works unchanged.
"""

from __future__ import annotations


def filter_standards(
    standards_data: dict,
    content_type: str,
    include_all: bool = False,
) -> dict:
    """Return a filtered copy of standards_data for the given content type.

    Only includes standards where content_type is in relevant_content_types
    and checkable_from is 'plain_text' (unless include_all=True).

    Categories with no remaining standards are dropped.
    """
    filtered: dict = {
        "version": standards_data.get("version"),
        "content_types": standards_data.get("content_types", []),
        "categories": [],
        "active_notes": [],
        "filtered_count": 0,
        "total_count": 0,
    }

    for cat in standards_data["categories"]:
        filtered_standards = []

        for std in cat["standards"]:
            filtered["total_count"] += 1

            if not include_all and std.get("checkable_from", "plain_text") != "plain_text":
                continue

            if content_type not in std.get("relevant_content_types", []):
                continue

            filtered_standards.append(std)
            filtered["filtered_count"] += 1

            notes = std.get("content_type_notes", {})
            if content_type in notes:
                filtered["active_notes"].append({
                    "standard_id": std["id"],
                    "note": notes[content_type],
                })

        if filtered_standards:
            filtered["categories"].append({
                "id": cat["id"],
                "name": cat["name"],
                "standards": filtered_standards,
            })

    return filtered


def get_content_type_ids(standards_data: dict) -> list[str]:
    """Return the list of valid content type IDs."""
    return [ct["id"] for ct in standards_data.get("content_types", [])]


def get_content_type_descriptions(standards_data: dict) -> list[dict]:
    """Return content type definitions for use in the LLM classifier prompt."""
    return standards_data.get("content_types", [])


def get_standard_ids_for_type(standards_data: dict, content_type: str) -> list[str]:
    """Return a flat list of standard IDs relevant to a content type."""
    ids = []
    for cat in standards_data["categories"]:
        for std in cat["standards"]:
            if content_type in std.get("relevant_content_types", []):
                ids.append(std["id"])
    return ids


def get_multi_snippet_standards(standards_data: dict) -> list[str]:
    """Return standard IDs that require multi-snippet context."""
    ids = []
    for cat in standards_data["categories"]:
        for std in cat["standards"]:
            if std.get("requires_multi_snippet"):
                ids.append(std["id"])
    return ids
