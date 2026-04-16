from __future__ import annotations

from typing import Any, Mapping


STORY_SPEC_REQUIRED_SECTIONS = [
    "title",
    "user_story",
    "as_a",
    "i_want",
    "so_that",
    "description",
    "acceptance_criteria",
    "edge_cases",
    "dependencies",
    "priority",
]


def default_story_spec_skill() -> dict[str, Any]:
    return {
        "name": "Default Story Spec Skill",
        "skill_type": "story_spec",
        "description": "Default ProductOS skill for writing implementation-ready stories from a feature.",
        "instructions": (
            "Write implementation-ready delivery stories from the provided feature. "
            "Keep stories concrete, independently actionable, and small enough to estimate. "
            "Use the classic user story shape and make acceptance criteria testable."
        ),
        "required_sections": list(STORY_SPEC_REQUIRED_SECTIONS),
        "quality_bar": [
            "Ground every story in the source feature",
            "Keep frontend, backend, analytics, and integration work separate when naturally separable",
            "Use concrete, testable acceptance criteria",
            "Avoid vague planning language",
            "Prefer 3 to 5 meaningful stories for a normal feature",
        ],
        "integration_notes": [
            "Stories should map cleanly to Jira Story or Task issue types",
            "Story output should be ready for later refinement or slicing agents",
        ],
    }


def build_story_spec_instructions(skill: Mapping[str, Any] | None) -> str:
    resolved = dict(default_story_spec_skill())
    if skill:
        resolved.update({key: value for key, value in dict(skill).items() if value is not None})

    required_sections = _string_list(resolved.get("required_sections")) or list(STORY_SPEC_REQUIRED_SECTIONS)
    quality_bar = _string_list(resolved.get("quality_bar"))
    integration_notes = _string_list(resolved.get("integration_notes"))

    parts = [
        "You are ProductOS, an AI product manager and delivery planner.",
        f"Use the '{resolved.get('name', 'Story Spec Skill')}' skill to write stories.",
        str(resolved.get("instructions", "")).strip(),
        "Generate implementation-ready delivery stories from the provided feature.",
        "Return concise, concrete output grounded in the input feature.",
        "Return JSON only using the provided schema.",
        f"Each story must include exactly these sections: {', '.join(required_sections)}.",
        "Use the classic user story template: As a <persona>, I want <goal>, so that <benefit>.",
    ]

    if quality_bar:
        parts.append("Quality bar: " + "; ".join(quality_bar) + ".")
    if integration_notes:
        parts.append("Integration notes: " + "; ".join(integration_notes) + ".")

    return " ".join(part for part in parts if part)


def story_spec_response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
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
            }
        },
        "required": ["stories"],
    }


def normalize_story_body(item: dict[str, Any]) -> dict[str, Any]:
    priority = str(item.get("priority", "medium")).strip().lower() or "medium"
    if priority not in {"high", "medium", "low"}:
        priority = "medium"
    return {
        "title": str(item.get("title", "Untitled story")).strip() or "Untitled story",
        "user_story": str(item.get("user_story", "")).strip(),
        "as_a": str(item.get("as_a", "")).strip(),
        "i_want": str(item.get("i_want", "")).strip(),
        "so_that": str(item.get("so_that", "")).strip(),
        "description": str(item.get("description", "")).strip(),
        "acceptance_criteria": _string_list(item.get("acceptance_criteria")),
        "edge_cases": _string_list(item.get("edge_cases")),
        "dependencies": _string_list(item.get("dependencies")),
        "priority": priority,
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
