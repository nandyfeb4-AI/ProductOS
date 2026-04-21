from __future__ import annotations

from typing import Any, Mapping


def default_competitor_analysis_skill() -> dict[str, Any]:
    return {
        "name": "Default Competitor Analysis Skill",
        "skill_type": "competitor_analysis",
        "description": "Default ProductOS skill for comparing a product against named competitors and identifying threats, gaps, and differentiation opportunities.",
        "instructions": (
            "Analyze the provided competitors against the user's product context. "
            "Use only the provided product context and general market reasoning. "
            "Do not claim live web research, citations, or current facts that were not supplied. "
            "Focus on practical PM outputs: competitive strengths, weaknesses, feature gaps, positioning, threats, and recommended responses."
        ),
        "required_sections": [
            "category",
            "confidence_score",
            "threat_level",
            "strengths",
            "weaknesses",
            "feature_gaps",
            "positioning_summary",
            "recommended_response",
        ],
        "quality_bar": [
            "Return a result for every named competitor",
            "Separate observed competitor strengths from inferred risks or gaps",
            "Do not invent live market evidence or fake current research",
            "Make recommendations useful for PM strategy and roadmap decisions",
            "Differentiate direct threats from adjacent or weaker competitors",
        ],
        "integration_notes": [
            "This first version is analysis-only and does not persist competitor entities",
            "Outputs should help PMs decide where to differentiate, prioritize, or refine strategy",
            "UI should present this as provided-context competitor analysis, not live monitored intelligence",
        ],
    }


def build_competitor_analysis_instructions(skill: Mapping[str, Any] | None) -> str:
    resolved = dict(default_competitor_analysis_skill())
    if skill:
        resolved.update({key: value for key, value in dict(skill).items() if value is not None})

    required_sections = _string_list(resolved.get("required_sections")) or list(
        default_competitor_analysis_skill()["required_sections"]
    )
    quality_bar = _string_list(resolved.get("quality_bar"))
    integration_notes = _string_list(resolved.get("integration_notes"))

    parts = [
        "You are ProductOS, an AI product manager.",
        f"Use the '{resolved.get('name', 'Competitor Analysis Skill')}' skill to analyze named competitors.",
        str(resolved.get("instructions", "")).strip(),
        "Return one competitor analysis result for every named competitor and include a concise market summary plus strategic recommendations.",
        "Use 1 to 5 confidence scores, where 1 means low confidence and 5 means high confidence.",
        "Threat levels must be one of: high, medium, low.",
        "Competitor categories should be concise labels such as direct, adjacent, or aspirational.",
        "Do not claim external browsing, primary research, or live market validation.",
        "Return JSON only using the provided schema.",
        f"Each competitor analysis must include exactly these sections: {', '.join(required_sections)}.",
    ]

    if quality_bar:
        parts.append("Quality bar: " + "; ".join(quality_bar) + ".")
    if integration_notes:
        parts.append("Integration notes: " + "; ".join(integration_notes) + ".")

    return " ".join(part for part in parts if part)


def competitor_analysis_response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "market_summary": {"type": "string"},
            "strategic_recommendations": {"type": "array", "items": {"type": "string"}},
            "differentiation_opportunities": {"type": "array", "items": {"type": "string"}},
            "blind_spots": {"type": "array", "items": {"type": "string"}},
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "competitor_name": {"type": "string"},
                        "competitor_summary": {"type": "string"},
                        "analysis": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "category": {"type": "string"},
                                "confidence_score": {"type": "integer", "minimum": 1, "maximum": 5},
                                "threat_level": {"type": "string"},
                                "strengths": {"type": "array", "items": {"type": "string"}},
                                "weaknesses": {"type": "array", "items": {"type": "string"}},
                                "feature_gaps": {"type": "array", "items": {"type": "string"}},
                                "positioning_summary": {"type": "string"},
                                "recommended_response": {"type": "string"},
                            },
                            "required": [
                                "category",
                                "confidence_score",
                                "threat_level",
                                "strengths",
                                "weaknesses",
                                "feature_gaps",
                                "positioning_summary",
                                "recommended_response",
                            ],
                        },
                    },
                    "required": ["competitor_name", "competitor_summary", "analysis"],
                },
            },
        },
        "required": [
            "market_summary",
            "strategic_recommendations",
            "differentiation_opportunities",
            "blind_spots",
            "results",
        ],
    }


def normalize_competitor_analysis(item: Mapping[str, Any] | None) -> dict[str, Any]:
    data = dict(item or {})
    threat_level = str(data.get("threat_level", "")).strip().lower()
    if threat_level not in {"high", "medium", "low"}:
        raise ValueError("Competitor analysis returned an invalid threat level.")
    category = str(data.get("category", "")).strip().lower()
    if not category:
        raise ValueError("Competitor analysis returned an empty category.")
    return {
        "category": category,
        "confidence_score": _coerce_score(data.get("confidence_score")),
        "threat_level": threat_level,
        "strengths": _string_list(data.get("strengths")),
        "weaknesses": _string_list(data.get("weaknesses")),
        "feature_gaps": _string_list(data.get("feature_gaps")),
        "positioning_summary": str(data.get("positioning_summary", "")).strip(),
        "recommended_response": str(data.get("recommended_response", "")).strip(),
    }


def _coerce_score(value: Any) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        raise ValueError("Competitor analysis returned an invalid confidence score.") from None
    if not 1 <= score <= 5:
        raise ValueError("Competitor analysis returned an out-of-range confidence score.")
    return score


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
