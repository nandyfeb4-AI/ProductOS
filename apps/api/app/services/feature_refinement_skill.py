from __future__ import annotations

from typing import Any, Mapping

from app.services.feature_spec_skill import FEATURE_SPEC_REQUIRED_SECTIONS, normalize_feature_spec_body


FEATURE_REFINEMENT_REQUIRED_SECTIONS = list(FEATURE_SPEC_REQUIRED_SECTIONS)


def default_feature_refinement_skill() -> dict[str, Any]:
    return {
        "name": "Default Feature Refinement Skill",
        "skill_type": "feature_refinement",
        "description": "Default ProductOS skill for evaluating and refining existing feature specs.",
        "instructions": (
            "Evaluate each feature first, then refine only the parts that need improvement. "
            "Preserve the original intent while improving clarity, scope, requirements, dependencies, and success metrics."
        ),
        "required_sections": list(FEATURE_REFINEMENT_REQUIRED_SECTIONS),
        "quality_bar": [
            "Preserve the original problem and business intent",
            "Make requirements actionable for downstream story generation",
            "Clarify dependencies and non-functional requirements where needed",
            "Strengthen success metrics so the feature is measurable",
            "Do not turn the output into a PRD",
        ],
        "integration_notes": [
            "Refined features should remain compatible with Jira Epic export",
            "Refined output should improve Story Generator input quality",
            "This agent should improve the same feature, not create net-new feature records",
        ],
    }


def build_feature_refinement_instructions(skill: Mapping[str, Any] | None) -> str:
    resolved = dict(default_feature_refinement_skill())
    if skill:
        resolved.update({key: value for key, value in dict(skill).items() if value is not None})

    required_sections = _string_list(resolved.get("required_sections")) or list(FEATURE_REFINEMENT_REQUIRED_SECTIONS)
    quality_bar = _string_list(resolved.get("quality_bar"))
    integration_notes = _string_list(resolved.get("integration_notes"))

    parts = [
        "You are ProductOS, an AI product manager.",
        f"Use the '{resolved.get('name', 'Feature Refinement Skill')}' skill to evaluate and refine features.",
        str(resolved.get("instructions", "")).strip(),
        "For each feature, score its quality first and then return a refined version of that same feature.",
        "Do not create additional features. Do not change the core user or business intent. Return JSON only using the provided schema.",
        f"The refined feature body must include exactly these sections: {', '.join(required_sections)}.",
        "Use 1 to 5 scores, where 1 is weak and 5 is strong.",
    ]

    if quality_bar:
        parts.append("Quality bar: " + "; ".join(quality_bar) + ".")
    if integration_notes:
        parts.append("Integration notes: " + "; ".join(integration_notes) + ".")

    return " ".join(part for part in parts if part)


def feature_refinement_response_schema() -> dict[str, Any]:
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
                        "feature_id": {"type": "string"},
                        "refinement_summary": {"type": "string"},
                        "evaluation": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "problem_clarity_score": score_property,
                                "solution_clarity_score": score_property,
                                "requirement_completeness_score": score_property,
                                "dependency_score": score_property,
                                "success_metrics_score": score_property,
                                "implementation_readiness_score": score_property,
                                "overall_score": score_property,
                                "needs_refinement": {"type": "boolean"},
                                "strengths": {"type": "array", "items": {"type": "string"}},
                                "gaps": {"type": "array", "items": {"type": "string"}},
                                "refinement_reasons": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": [
                                "problem_clarity_score",
                                "solution_clarity_score",
                                "requirement_completeness_score",
                                "dependency_score",
                                "success_metrics_score",
                                "implementation_readiness_score",
                                "overall_score",
                                "needs_refinement",
                                "strengths",
                                "gaps",
                                "refinement_reasons",
                            ],
                        },
                        "feature": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "title": {"type": "string"},
                                "summary": {"type": "string"},
                                "body": _feature_body_schema(),
                            },
                            "required": ["title", "summary", "body"],
                        },
                    },
                    "required": ["feature_id", "refinement_summary", "evaluation", "feature"],
                },
            }
        },
        "required": ["results"],
    }


def normalize_feature_refinement_evaluation(item: Mapping[str, Any] | None) -> dict[str, Any]:
    data = dict(item or {})
    return {
        "problem_clarity_score": _coerce_score(data.get("problem_clarity_score")),
        "solution_clarity_score": _coerce_score(data.get("solution_clarity_score")),
        "requirement_completeness_score": _coerce_score(data.get("requirement_completeness_score")),
        "dependency_score": _coerce_score(data.get("dependency_score")),
        "success_metrics_score": _coerce_score(data.get("success_metrics_score")),
        "implementation_readiness_score": _coerce_score(data.get("implementation_readiness_score")),
        "overall_score": _coerce_score(data.get("overall_score")),
        "needs_refinement": bool(data.get("needs_refinement", True)),
        "strengths": _string_list(data.get("strengths")),
        "gaps": _string_list(data.get("gaps")),
        "refinement_reasons": _string_list(data.get("refinement_reasons")),
    }


__all__ = [
    "build_feature_refinement_instructions",
    "default_feature_refinement_skill",
    "feature_refinement_response_schema",
    "normalize_feature_refinement_evaluation",
    "normalize_feature_spec_body",
]


def _feature_body_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "problem_statement": {"type": "string"},
            "user_segment": {"type": "string"},
            "proposed_solution": {"type": "string"},
            "user_value": {"type": "string"},
            "business_value": {"type": "string"},
            "functional_requirements": {"type": "array", "items": {"type": "string"}},
            "non_functional_requirements": {"type": "array", "items": {"type": "string"}},
            "dependencies": {"type": "array", "items": {"type": "string"}},
            "success_metrics": {"type": "array", "items": {"type": "string"}},
            "priority": {"type": "string"},
        },
        "required": list(FEATURE_SPEC_REQUIRED_SECTIONS),
    }


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
