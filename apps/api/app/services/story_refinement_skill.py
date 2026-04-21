from __future__ import annotations

from typing import Any, Mapping

from app.services.story_spec_skill import STORY_SPEC_REQUIRED_SECTIONS, normalize_story_body


STORY_REFINEMENT_REQUIRED_SECTIONS = [
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

BACKLOG_READY_CRITERIA = [
    "Acceptance criteria are concrete, measurable, and testable",
    "Implementation scope is explicit enough that engineering does not need a PM follow-up to begin",
    "Dependencies and integration touchpoints are named when relevant",
    "Edge cases or fallback behavior are called out when they materially affect delivery",
    "API contracts, events, payload fields, validation rules, or timing expectations are explicit when relevant",
    "The story can be verified by QA without interpretation or guesswork",
]


def default_story_refinement_skill() -> dict[str, Any]:
    return {
        "name": "Default Story Refinement Skill",
        "skill_type": "story_refinement",
        "description": "Default ProductOS skill for evaluating and refining implementation-ready stories.",
        "instructions": (
            "Evaluate each story first, then refine only the parts that need improvement. "
            "Strengthen acceptance criteria, reduce ambiguity, preserve intent, and keep the result concrete and implementation-ready."
        ),
        "required_sections": list(STORY_REFINEMENT_REQUIRED_SECTIONS),
        "quality_bar": [
            "Score each story before refining it",
            "Keep the refined story grounded in the original intent",
            "Make acceptance criteria concrete and testable",
            "Clarify missing edge cases and dependencies when needed",
            "Do not split one story into multiple stories",
        ],
        "integration_notes": [
            "Refined stories should remain compatible with Jira Story or Task issue types",
            "This agent should improve existing stories, not create net-new backlog items",
        ],
    }


def build_story_refinement_instructions(skill: Mapping[str, Any] | None) -> str:
    resolved = dict(default_story_refinement_skill())
    if skill:
        resolved.update({key: value for key, value in dict(skill).items() if value is not None})

    required_sections = _string_list(resolved.get("required_sections")) or list(STORY_REFINEMENT_REQUIRED_SECTIONS)
    quality_bar = _string_list(resolved.get("quality_bar"))
    integration_notes = _string_list(resolved.get("integration_notes"))

    parts = [
        "You are ProductOS, an AI product manager and delivery quality partner.",
        f"Use the '{resolved.get('name', 'Story Refinement Skill')}' skill to evaluate and refine stories.",
        str(resolved.get("instructions", "")).strip(),
        "For each story, score its quality first and then return a refined version of that same story.",
        "Do not create additional stories. Do not merge stories. Do not change the core user intent.",
        "Return JSON only using the provided schema.",
        f"Each refined story must include exactly these sections: {', '.join(required_sections)}.",
        "Use 1 to 5 scores, where 1 is weak and 5 is strong.",
        (
            "A story is only ready for execution when all of the following are true: "
            + "; ".join(BACKLOG_READY_CRITERIA)
            + "."
        ),
        (
            "Set `needs_refinement` to false only when the story is truly execution-ready. "
            "If any of the readiness criteria are missing, ambiguous, or only partially specified, set `needs_refinement` to true."
        ),
    ]

    if quality_bar:
        parts.append("Quality bar: " + "; ".join(quality_bar) + ".")
    if integration_notes:
        parts.append("Integration notes: " + "; ".join(integration_notes) + ".")

    return " ".join(part for part in parts if part)


def story_refinement_response_schema() -> dict[str, Any]:
    score_property = {"type": "integer", "minimum": 1, "maximum": 5}
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "story_id": {"type": "string"},
                        "refinement_summary": {"type": "string"},
                        "evaluation": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "clarity_score": score_property,
                                "acceptance_criteria_score": score_property,
                                "completeness_score": score_property,
                                "edge_case_score": score_property,
                                "dependency_score": score_property,
                                "implementation_readiness_score": score_property,
                                "overall_score": score_property,
                                "needs_refinement": {"type": "boolean"},
                                "strengths": {"type": "array", "items": {"type": "string"}},
                                "gaps": {"type": "array", "items": {"type": "string"}},
                                "refinement_reasons": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": [
                                "clarity_score",
                                "acceptance_criteria_score",
                                "completeness_score",
                                "edge_case_score",
                                "dependency_score",
                                "implementation_readiness_score",
                                "overall_score",
                                "needs_refinement",
                                "strengths",
                                "gaps",
                                "refinement_reasons",
                            ],
                        },
                        "story": {
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
                    "required": ["story_id", "refinement_summary", "evaluation", "story"],
                },
            }
        },
        "required": ["results"],
    }


def normalize_story_refinement_evaluation(item: Mapping[str, Any] | None) -> dict[str, Any]:
    data = dict(item or {})
    return {
        "clarity_score": _coerce_score(data.get("clarity_score")),
        "acceptance_criteria_score": _coerce_score(data.get("acceptance_criteria_score")),
        "completeness_score": _coerce_score(data.get("completeness_score")),
        "edge_case_score": _coerce_score(data.get("edge_case_score")),
        "dependency_score": _coerce_score(data.get("dependency_score")),
        "implementation_readiness_score": _coerce_score(data.get("implementation_readiness_score")),
        "overall_score": _coerce_score(data.get("overall_score")),
        "needs_refinement": bool(data.get("needs_refinement", True)),
        "strengths": _string_list(data.get("strengths")),
        "gaps": _string_list(data.get("gaps")),
        "refinement_reasons": _string_list(data.get("refinement_reasons")),
    }


__all__ = [
    "build_story_refinement_instructions",
    "BACKLOG_READY_CRITERIA",
    "default_story_refinement_skill",
    "normalize_story_body",
    "normalize_story_refinement_evaluation",
    "story_refinement_response_schema",
]


def _coerce_score(value: Any) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        return 3
    return max(1, min(5, score))


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
