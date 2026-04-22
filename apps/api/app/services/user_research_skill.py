from __future__ import annotations

from typing import Any, Mapping


def default_user_research_skill() -> dict[str, Any]:
    return {
        "name": "Default User Research Skill",
        "skill_type": "user_research",
        "description": "Default ProductOS skill for synthesizing provided research notes, interviews, and user signals into actionable PM insights.",
        "instructions": (
            "Synthesize the provided user research inputs into practical product insights. "
            "Use only the supplied notes, quotes, summaries, and supporting context. "
            "Do not claim live research, fresh interviews, external citations, or statistically validated findings that were not provided. "
            "Focus on PM-ready outputs: user segments, pain points, unmet needs, jobs to be done, research insights, and recommended actions."
        ),
        "required_sections": [
            "insight_title",
            "insight_summary",
            "evidence",
            "implication",
            "recommended_action",
            "confidence_score",
        ],
        "quality_bar": [
            "Ground every insight in the provided research inputs",
            "Separate observed evidence from inference or implication",
            "Return recommendations useful for product decisions, not generic UX advice",
            "Do not invent live user evidence, market evidence, or unprovided interview details",
            "Confidence scores should reflect how strongly the provided evidence supports the insight",
        ],
        "integration_notes": [
            "This first version is analysis-only and does not persist research entities",
            "Outputs should help PMs refine features, roadmap direction, and backlog decisions",
            "UI should present this as synthesis of provided research inputs, not live user intelligence",
        ],
    }


def build_user_research_instructions(skill: Mapping[str, Any] | None) -> str:
    resolved = dict(default_user_research_skill())
    if skill:
        resolved.update({key: value for key, value in dict(skill).items() if value is not None})

    required_sections = _string_list(resolved.get("required_sections")) or list(
        default_user_research_skill()["required_sections"]
    )
    quality_bar = _string_list(resolved.get("quality_bar"))
    integration_notes = _string_list(resolved.get("integration_notes"))

    parts = [
        "You are ProductOS, an AI product manager.",
        f"Use the '{resolved.get('name', 'User Research Skill')}' skill to synthesize provided user research.",
        str(resolved.get("instructions", "")).strip(),
        "Return a concise research summary, user segments, pain points, unmet needs, jobs to be done, recommended actions, risks and unknowns, plus insight cards grounded in the provided inputs.",
        "Use 1 to 5 confidence scores, where 1 means weak evidence and 5 means strong evidence.",
        "Do not claim external browsing, fresh interviews, or live research validation.",
        "Return JSON only using the provided schema.",
        f"Each insight card must include exactly these sections: {', '.join(required_sections)}.",
    ]
    if quality_bar:
        parts.append("Quality bar: " + "; ".join(quality_bar) + ".")
    if integration_notes:
        parts.append("Integration notes: " + "; ".join(integration_notes) + ".")
    return " ".join(part for part in parts if part)


def user_research_response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "research_summary": {"type": "string"},
            "user_segments": {"type": "array", "items": {"type": "string"}},
            "key_pain_points": {"type": "array", "items": {"type": "string"}},
            "unmet_needs": {"type": "array", "items": {"type": "string"}},
            "jobs_to_be_done": {"type": "array", "items": {"type": "string"}},
            "recommended_actions": {"type": "array", "items": {"type": "string"}},
            "risks_and_unknowns": {"type": "array", "items": {"type": "string"}},
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "insight_title": {"type": "string"},
                        "insight_summary": {"type": "string"},
                        "evidence": {"type": "array", "items": {"type": "string"}},
                        "implication": {"type": "string"},
                        "recommended_action": {"type": "string"},
                        "confidence_score": {"type": "integer", "minimum": 1, "maximum": 5},
                    },
                    "required": [
                        "insight_title",
                        "insight_summary",
                        "evidence",
                        "implication",
                        "recommended_action",
                        "confidence_score",
                    ],
                },
            },
        },
        "required": [
            "research_summary",
            "user_segments",
            "key_pain_points",
            "unmet_needs",
            "jobs_to_be_done",
            "recommended_actions",
            "risks_and_unknowns",
            "results",
        ],
    }


def normalize_user_research_insight(item: Mapping[str, Any] | None) -> dict[str, Any]:
    data = dict(item or {})
    title = str(data.get("insight_title", "")).strip()
    if not title:
        raise ValueError("User research analysis returned an empty insight title.")
    return {
        "insight_title": title,
        "insight_summary": str(data.get("insight_summary", "")).strip(),
        "evidence": _string_list(data.get("evidence")),
        "implication": str(data.get("implication", "")).strip(),
        "recommended_action": str(data.get("recommended_action", "")).strip(),
        "confidence_score": _coerce_score(data.get("confidence_score")),
    }


def _coerce_score(value: Any) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        raise ValueError("User research analysis returned an invalid confidence score.") from None
    if not 1 <= score <= 5:
        raise ValueError("User research analysis returned an out-of-range confidence score.")
    return score


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
