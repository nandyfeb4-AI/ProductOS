from __future__ import annotations

from typing import Any, Mapping

from app.services.story_spec_skill import STORY_SPEC_REQUIRED_SECTIONS, normalize_story_body


STORY_SLICING_REQUIRED_SECTIONS = list(STORY_SPEC_REQUIRED_SECTIONS)


def default_story_slicing_skill() -> dict[str, Any]:
    return {
        "name": "Default Story Slicing Skill",
        "skill_type": "story_slicing",
        "description": "Default ProductOS skill for splitting an oversized story into smaller implementation-ready stories.",
        "instructions": (
            "Split one oversized story into a small set of independently deliverable child stories. "
            "Preserve the original intent, avoid overlap, and keep each output concrete and implementation-ready."
        ),
        "required_sections": list(STORY_SLICING_REQUIRED_SECTIONS),
        "quality_bar": [
            "Preserve the intent of the original story",
            "Create 2 to 4 independently deliverable child stories by default",
            "Avoid duplicate or overlapping child stories",
            "Keep acceptance criteria concrete and testable",
            "Do not invent unrelated backlog work",
        ],
        "integration_notes": [
            "Sliced stories should persist as project stories linked back to the source story",
            "The original story should remain available for review after slicing",
            "Outputs should be clean inputs for Story Refiner and Jira export",
        ],
    }


def build_story_slicing_instructions(skill: Mapping[str, Any] | None) -> str:
    resolved = dict(default_story_slicing_skill())
    if skill:
        resolved.update({key: value for key, value in dict(skill).items() if value is not None})

    required_sections = _string_list(resolved.get("required_sections")) or list(STORY_SLICING_REQUIRED_SECTIONS)
    quality_bar = _string_list(resolved.get("quality_bar"))
    integration_notes = _string_list(resolved.get("integration_notes"))

    parts = [
        "You are ProductOS, an AI product manager and delivery planner.",
        f"Use the '{resolved.get('name', 'Story Slicing Skill')}' skill to slice stories.",
        str(resolved.get("instructions", "")).strip(),
        "Split the provided source story into a small set of independently deliverable child stories.",
        "Do not create duplicate stories. Do not merge concerns that are naturally separable. Do not drift away from the original user intent.",
        "Return JSON only using the provided schema.",
        f"Each sliced story must include exactly these sections: {', '.join(required_sections)}.",
        "Use the classic user story template: As a <persona>, I want <goal>, so that <benefit>.",
    ]

    if quality_bar:
        parts.append("Quality bar: " + "; ".join(quality_bar) + ".")
    if integration_notes:
        parts.append("Integration notes: " + "; ".join(integration_notes) + ".")

    return " ".join(part for part in parts if part)


def story_slicing_response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "slicing_summary": {"type": "string"},
            "stories": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "title": {"type": "string"},
                        "user_story": {"type": "string"},
                        "as_a": {"type": "string"},
                        "i_want": {"type": "string"},
                        "so_that": {"type": "string"},
                        "description": {"type": "string"},
                        "acceptance_criteria": {"type": "array", "items": {"type": "string"}},
                        "edge_cases": {"type": "array", "items": {"type": "string"}},
                        "dependencies": {"type": "array", "items": {"type": "string"}},
                        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                    },
                    "required": list(STORY_SPEC_REQUIRED_SECTIONS),
                },
            },
        },
        "required": ["slicing_summary", "stories"],
    }


__all__ = [
    "build_story_slicing_instructions",
    "default_story_slicing_skill",
    "normalize_story_body",
    "story_slicing_response_schema",
]


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
