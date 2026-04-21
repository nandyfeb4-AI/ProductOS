from __future__ import annotations

from typing import Any, Mapping


def default_feature_prioritization_skill() -> dict[str, Any]:
    return {
        "name": "Default Feature Prioritization Skill",
        "skill_type": "feature_prioritization",
        "description": "Default ProductOS skill for ranking project features using an impact-versus-effort lens with PM-style tradeoff reasoning.",
        "instructions": (
            "Prioritize the provided features using Impact vs Effort as the default framework. "
            "Balance user value, business value, urgency, and strategic alignment against delivery effort and confidence. "
            "Recommend a rank order that a PM could defend in planning review."
        ),
        "required_sections": [
            "framework",
            "impact_score",
            "effort_score",
            "strategic_alignment_score",
            "urgency_score",
            "confidence_score",
            "overall_priority_score",
            "recommended_rank",
            "priority_bucket",
            "rationale",
            "tradeoffs",
            "recommendation",
        ],
        "quality_bar": [
            "Use a consistent framework across all selected features",
            "Explain why items move up or down rather than only assigning scores",
            "Call out when a feature needs more refinement before confident prioritization",
            "Avoid recommending everything as high priority",
            "Tie recommendations back to user and business value",
        ],
        "integration_notes": [
            "Prioritization should persist onto the same project feature records",
            "Results should help PMs decide what to refine, generate stories for, or export next",
            "This agent recommends priority order; it does not reorder Jira automatically",
        ],
    }


def build_feature_prioritization_instructions(skill: Mapping[str, Any] | None) -> str:
    resolved = dict(default_feature_prioritization_skill())
    if skill:
        resolved.update({key: value for key, value in dict(skill).items() if value is not None})

    required_sections = _string_list(resolved.get("required_sections")) or list(
        default_feature_prioritization_skill()["required_sections"]
    )
    quality_bar = _string_list(resolved.get("quality_bar"))
    integration_notes = _string_list(resolved.get("integration_notes"))

    parts = [
        "You are ProductOS, an AI product manager.",
        f"Use the '{resolved.get('name', 'Feature Prioritization Skill')}' skill to evaluate and rank features.",
        str(resolved.get("instructions", "")).strip(),
        "Return a prioritization result for every feature and assign a unique recommended_rank starting at 1 for the highest priority item.",
        "Use 1 to 5 scores, where 1 is weak/low and 5 is strong/high. Higher effort should reduce priority when other factors are equal.",
        "Do not rewrite the feature itself. Do not create new features. Return JSON only using the provided schema.",
        f"Each prioritization result must include exactly these sections: {', '.join(required_sections)}.",
    ]

    if quality_bar:
        parts.append("Quality bar: " + "; ".join(quality_bar) + ".")
    if integration_notes:
        parts.append("Integration notes: " + "; ".join(integration_notes) + ".")

    return " ".join(part for part in parts if part)


def feature_prioritization_response_schema() -> dict[str, Any]:
    score_property = {"type": "integer", "minimum": 1, "maximum": 5}
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "prioritization_summary": {"type": "string"},
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "feature_id": {"type": "string"},
                        "prioritization_summary": {"type": "string"},
                        "prioritization": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "framework": {"type": "string"},
                                "impact_score": score_property,
                                "effort_score": score_property,
                                "strategic_alignment_score": score_property,
                                "urgency_score": score_property,
                                "confidence_score": score_property,
                                "overall_priority_score": score_property,
                                "recommended_rank": {"type": "integer", "minimum": 1},
                                "priority_bucket": {"type": "string"},
                                "rationale": {"type": "array", "items": {"type": "string"}},
                                "tradeoffs": {"type": "array", "items": {"type": "string"}},
                                "recommendation": {"type": "string"},
                            },
                            "required": [
                                "framework",
                                "impact_score",
                                "effort_score",
                                "strategic_alignment_score",
                                "urgency_score",
                                "confidence_score",
                                "overall_priority_score",
                                "recommended_rank",
                                "priority_bucket",
                                "rationale",
                                "tradeoffs",
                                "recommendation",
                            ],
                        },
                    },
                    "required": ["feature_id", "prioritization_summary", "prioritization"],
                },
            },
        },
        "required": ["prioritization_summary", "results"],
    }


def normalize_feature_prioritization(item: Mapping[str, Any] | None) -> dict[str, Any]:
    data = dict(item or {})
    bucket = str(data.get("priority_bucket", "medium")).strip().lower() or "medium"
    if bucket not in {"high", "medium", "low"}:
        bucket = "medium"
    return {
        "framework": str(data.get("framework", "impact_vs_effort")).strip() or "impact_vs_effort",
        "impact_score": _coerce_score(data.get("impact_score")),
        "effort_score": _coerce_score(data.get("effort_score")),
        "strategic_alignment_score": _coerce_score(data.get("strategic_alignment_score")),
        "urgency_score": _coerce_score(data.get("urgency_score")),
        "confidence_score": _coerce_score(data.get("confidence_score")),
        "overall_priority_score": _coerce_score(data.get("overall_priority_score")),
        "recommended_rank": _coerce_rank(data.get("recommended_rank")),
        "priority_bucket": bucket,
        "rationale": _string_list(data.get("rationale")),
        "tradeoffs": _string_list(data.get("tradeoffs")),
        "recommendation": str(data.get("recommendation", "")).strip(),
    }


def _coerce_score(value: Any) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        return 3
    return max(1, min(5, score))


def _coerce_rank(value: Any) -> int:
    try:
        rank = int(value)
    except (TypeError, ValueError):
        return 1
    return max(1, rank)


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
