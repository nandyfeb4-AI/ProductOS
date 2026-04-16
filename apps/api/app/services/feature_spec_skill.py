from __future__ import annotations

from typing import Any, Mapping


FEATURE_SPEC_REQUIRED_SECTIONS = [
    "problem_statement",
    "user_segment",
    "proposed_solution",
    "user_value",
    "business_value",
    "functional_requirements",
    "non_functional_requirements",
    "dependencies",
    "success_metrics",
    "priority",
]


def default_feature_spec_skill() -> dict[str, Any]:
    return {
        "name": "Default Feature Spec Skill",
        "skill_type": "feature_spec",
        "description": "Default ProductOS skill for writing a PM-ready feature spec from discovery inputs.",
        "instructions": (
            "Write one PM-ready feature spec grounded in the provided source material. "
            "Keep it concrete, delivery-oriented, and concise. Emphasize the user problem, "
            "the proposed solution, and the requirements needed to make it implementation-ready."
        ),
        "required_sections": list(FEATURE_SPEC_REQUIRED_SECTIONS),
        "quality_bar": [
            "Ground the output in the provided input",
            "Avoid vague platform-language",
            "Make requirements actionable for downstream story generation",
            "Capture meaningful success metrics",
            "Do not turn the output into a PRD",
        ],
        "integration_notes": [
            "This skill should map cleanly to the existing Jira epic/feature export structure",
            "Functional requirements should be ready for story generation input",
        ],
    }


def build_feature_spec_instructions(skill: Mapping[str, Any] | None) -> str:
    resolved = dict(default_feature_spec_skill())
    if skill:
        resolved.update({key: value for key, value in dict(skill).items() if value is not None})

    required_sections = _string_list(resolved.get("required_sections")) or list(FEATURE_SPEC_REQUIRED_SECTIONS)
    quality_bar = _string_list(resolved.get("quality_bar"))
    integration_notes = _string_list(resolved.get("integration_notes"))

    parts = [
        "You are ProductOS, an AI product manager.",
        f"Use the '{resolved.get('name', 'Feature Spec Skill')}' skill to write the feature.",
        str(resolved.get("instructions", "")).strip(),
        "Generate one PM-ready feature draft from the provided source material.",
        "Return concise, concrete output grounded in the input.",
        "Do not produce an initiative or a PRD. Produce exactly one feature draft.",
        "Return JSON only using the provided schema.",
        f"The body must include exactly these sections: {', '.join(required_sections)}.",
    ]

    if quality_bar:
        parts.append("Quality bar: " + "; ".join(quality_bar) + ".")
    if integration_notes:
        parts.append("Integration notes: " + "; ".join(integration_notes) + ".")

    return " ".join(part for part in parts if part)


def feature_spec_body_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "problem_statement": {"type": "string"},
            "user_segment": {"type": "string"},
            "proposed_solution": {"type": "string"},
            "user_value": {"type": "string"},
            "business_value": {"type": "string"},
            "functional_requirements": {
                "type": "array",
                "items": {"type": "string"},
            },
            "non_functional_requirements": {
                "type": "array",
                "items": {"type": "string"},
            },
            "dependencies": {
                "type": "array",
                "items": {"type": "string"},
            },
            "success_metrics": {
                "type": "array",
                "items": {"type": "string"},
            },
            "priority": {"type": "string"},
        },
        "required": list(FEATURE_SPEC_REQUIRED_SECTIONS),
    }


def normalize_feature_spec_body(body: dict[str, Any]) -> None:
    problem_statement = str(body.get("problem_statement") or body.get("user_problem") or "").strip()
    proposed_solution = str(body.get("proposed_solution") or body.get("solution_overview") or "").strip()
    body["problem_statement"] = problem_statement
    body["user_problem"] = problem_statement
    body["user_segment"] = str(body.get("user_segment", "")).strip()
    body["proposed_solution"] = proposed_solution
    body["solution_overview"] = proposed_solution
    body["user_value"] = str(body.get("user_value", "")).strip()
    body["business_value"] = str(body.get("business_value", "")).strip()
    body["functional_requirements"] = _string_list(body.get("functional_requirements"))
    body["non_functional_requirements"] = _string_list(body.get("non_functional_requirements"))
    body["dependencies"] = _string_list(body.get("dependencies"))
    body["success_metrics"] = _string_list(body.get("success_metrics"))
    body["priority"] = str(body.get("priority", "medium")).strip().lower() or "medium"


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
