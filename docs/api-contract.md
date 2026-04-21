# API Contract

Base URL: `http://127.0.0.1:8001`

Endpoints return JSON unless otherwise noted. The legacy generation endpoints are still synchronous, and the preferred long-running AI flow now also supports async job endpoints with websocket updates.

## Endpoints

## Skills

Skills are reusable cross-project behavior definitions that shape how agents and workflow generation should behave.

### `POST /api/skills`
- Request:
```json
{
  "name": "Default Feature Spec Skill",
  "slug": "default-feature-spec-skill",
  "skill_type": "feature_spec",
  "description": "Default ProductOS skill for writing PM-ready feature specs.",
  "is_active": true,
  "instructions": "Write one PM-ready feature spec grounded in the provided source material.",
  "required_sections": ["problem_statement", "user_segment", "proposed_solution"],
  "quality_bar": ["Ground the output in the input"],
  "integration_notes": ["Map cleanly to Jira epic export"]
}
```
- Response: `SkillResponse`

### `GET /api/skills?skill_type=feature_spec&active_only=true`
- Response: `{ "skills": [ ...SkillSummary ] }`

### `GET /api/skills/{skill_id}`
- Response: `SkillResponse`

### `PATCH /api/skills/{skill_id}`
- Request: any subset of:
  - `name`
  - `slug`
  - `skill_type`
  - `description`
  - `is_active`
  - `instructions`
  - `required_sections`
  - `quality_bar`
  - `integration_notes`
- Response: updated `SkillResponse`

## Project Agent Runs

### `GET /api/projects/{project_id}/agent-runs`
- Purpose: list standalone AI agent runs for the corresponding project
- Query params:
  - `agent_key` optional
  - `status` optional
- Response:
```json
{
  "jobs": [
    {
      "id": "uuid",
      "job_type": "feature_generation",
      "project_id": "uuid",
      "agent_key": "feature_generator",
      "agent_label": "Feature Generator",
      "status": "queued|running|completed|failed|cancelled",
      "progress_stage": "queued|running|completed|failed",
      "progress_message": "string|null",
      "input_payload": {},
      "result_payload": {},
      "error_message": "string|null",
      "created_at": "iso",
      "updated_at": "iso",
      "completed_at": "iso|null"
    }
  ]
}
```
- Behavior:
  - returns project-scoped runs for standalone agents only
  - workflow jobs are not included in this view
  - newest runs first

## Agents

### `POST /api/agents/feature-generator`
- Purpose: first reusable manual agent outside the workshop flow
- Request:
```json
{
  "project_id": "uuid",
  "source_type": "prompt|opportunity|requirement",
  "source_title": "string",
  "source_summary": "string",
  "source_details": "string",
  "desired_outcome": "string",
  "constraints": ["string"],
  "supporting_context": ["string"]
}
```
- Response:
```json
{
  "feature": {
    "feature_id": "uuid",
    "status": "draft",
    "title": "string",
    "summary": "string",
    "body": {
      "problem_statement": "string",
      "user_segment": "string",
      "proposed_solution": "string",
      "user_value": "string",
      "business_value": "string",
      "functional_requirements": ["string"],
      "non_functional_requirements": ["string"],
      "dependencies": ["string"],
      "success_metrics": ["string"],
      "priority": "high|medium|low"
    }
  }
}
```
- Behavior: uses the OpenAI Responses API, automatically applies the active `feature_spec` skill, persists the generated feature into the project feature store, and fails explicitly when AI is unavailable or generation fails

### `POST /api/agents/feature-refiner`
- Purpose: reusable agent that evaluates and refines one or more persisted project features
- Request:
```json
{
  "project_id": "uuid",
  "source_type": "project_feature",
  "feature_ids": ["uuid"],
  "refinement_goal": "Make this feature story-generation ready.",
  "constraints": ["Do not change the business intent"],
  "supporting_context": ["This feature maps to a Jira Epic"]
}
```
- Response:
```json
{
  "results": [
    {
      "feature": {
        "id": "uuid",
        "project_id": "uuid",
        "source_type": "prompt",
        "source_title": "string",
        "source_summary": "string",
        "status": "draft",
        "generator_type": "feature_refiner",
        "skill_id": "uuid",
        "skill_name": "Default Feature Refinement Skill",
        "title": "string",
        "summary": "string",
        "body": {
          "problem_statement": "string",
          "user_segment": "string",
          "proposed_solution": "string",
          "user_value": "string",
          "business_value": "string",
          "functional_requirements": ["string"],
          "non_functional_requirements": ["string"],
          "dependencies": ["string"],
          "success_metrics": ["string"],
          "priority": "high|medium|low"
        },
        "created_at": "iso",
        "updated_at": "iso"
      },
      "evaluation": {
        "problem_clarity_score": 4,
        "solution_clarity_score": 4,
        "requirement_completeness_score": 3,
        "dependency_score": 3,
        "success_metrics_score": 2,
        "implementation_readiness_score": 3,
        "overall_score": 3,
        "needs_refinement": true,
        "strengths": ["Strong problem framing"],
        "gaps": ["Success metrics are too vague"],
        "refinement_reasons": ["Requirements need more delivery detail"]
      },
      "refinement_summary": "Clarified requirements and added measurable success criteria."
    }
  ]
}
```
- Behavior: uses the OpenAI Responses API, automatically applies the active `feature_refinement` skill, evaluates each feature first, persists refined content back into `project_features`, and returns both the updated features and their evaluation scores

### `POST /api/agents/competitor-analysis`
- Purpose: reusable agent that analyzes named competitors against a provided product context
- Request:
```json
{
  "project_id": "uuid",
  "source_type": "prompt",
  "product_name": "ProductOS",
  "product_summary": "AI-native product management platform for discovery, planning, backlog refinement, and delivery execution.",
  "target_market": "B2B SaaS product teams",
  "known_competitors": ["Productboard", "Aha!", "Jira Product Discovery"],
  "analysis_goal": "Understand where ProductOS should differentiate in PM workflow automation.",
  "constraints": ["Do not assume live web research"],
  "supporting_context": ["Focus on workflow automation, backlog readiness, and PM execution"]
}
```
- Response:
```json
{
  "market_summary": "The space is crowded with roadmap and prioritization tools, but fewer products connect discovery, execution readiness, and delivery workflows in one layer.",
  "strategic_recommendations": [
    "Lean into workflow automation rather than static planning surfaces",
    "Differentiate on execution readiness and Jira-connected operations"
  ],
  "differentiation_opportunities": [
    "Human-in-the-loop agentic workflows for PM operations",
    "Backlog health and execution readiness instead of roadmap-only planning"
  ],
  "blind_spots": [
    "Market messaging may underplay collaboration and governance needs"
  ],
  "results": [
    {
      "competitor_name": "Productboard",
      "competitor_summary": "Strong on roadmap communication and feedback consolidation, weaker on execution workflow depth.",
      "analysis": {
        "category": "direct",
        "confidence_score": 4,
        "threat_level": "high",
        "strengths": ["Established PM brand", "Strong feedback intake and prioritization workflows"],
        "weaknesses": ["Less execution-oriented", "Backlog transformation may require other tools"],
        "feature_gaps": ["Agentic backlog refinement", "Execution-ready workflow orchestration"],
        "positioning_summary": "Best fit for roadmap-centric product planning organizations.",
        "recommended_response": "Position ProductOS around discovery-to-delivery execution, not just roadmap planning."
      }
    }
  ]
}
```
- Behavior: uses the OpenAI Responses API, automatically applies the active `competitor_analysis` skill, analyzes only the provided product context plus named competitors, and fails explicitly when AI output is incomplete or unavailable

### `POST /api/agents/feature-prioritizer`
- Purpose: reusable agent that evaluates and ranks one or more persisted project features
- Request:
```json
{
  "project_id": "uuid",
  "source_type": "project_feature",
  "feature_ids": ["uuid", "uuid"],
  "prioritization_goal": "Recommend what should move next into story generation.",
  "constraints": ["Optimize for retention impact this quarter"],
  "supporting_context": ["Platform team capacity is limited this sprint"]
}
```
- Response:
```json
{
  "prioritization_summary": "Feature A should move first because it has the strongest near-term retention impact with manageable effort.",
  "results": [
    {
      "feature": {
        "id": "uuid",
        "project_id": "uuid",
        "source_type": "prompt",
        "source_title": "string",
        "source_summary": "string",
        "status": "draft",
        "generator_type": "feature_prioritizer",
        "skill_id": "uuid",
        "skill_name": "Default Feature Prioritization Skill",
        "title": "string",
        "summary": "string",
        "body": {
          "problem_statement": "string",
          "user_segment": "string",
          "proposed_solution": "string",
          "user_value": "string",
          "business_value": "string",
          "functional_requirements": ["string"],
          "non_functional_requirements": ["string"],
          "dependencies": ["string"],
          "success_metrics": ["string"],
          "priority": "high|medium|low"
        },
        "prioritization": {
          "framework": "impact_vs_effort",
          "impact_score": 5,
          "effort_score": 2,
          "strategic_alignment_score": 4,
          "urgency_score": 4,
          "confidence_score": 3,
          "overall_priority_score": 4,
          "recommended_rank": 1,
          "priority_bucket": "high",
          "rationale": ["Strong retention upside", "Dependencies are manageable"],
          "tradeoffs": ["Requires moderate analytics work"],
          "recommendation": "Move this feature into story generation next."
        },
        "created_at": "iso",
        "updated_at": "iso"
      },
      "prioritization": {
        "framework": "impact_vs_effort",
        "impact_score": 5,
        "effort_score": 2,
        "strategic_alignment_score": 4,
        "urgency_score": 4,
        "confidence_score": 3,
        "overall_priority_score": 4,
        "recommended_rank": 1,
        "priority_bucket": "high",
        "rationale": ["Strong retention upside", "Dependencies are manageable"],
        "tradeoffs": ["Requires moderate analytics work"],
        "recommendation": "Move this feature into story generation next."
      },
      "prioritization_summary": "High-impact with comparatively manageable effort."
    }
  ]
}
```
- Behavior: uses the OpenAI Responses API, automatically applies the active `feature_prioritization` skill, ranks the selected persisted features, persists prioritization metadata back into `project_features.prioritization`, and returns ranked recommendation results without reordering Jira automatically

### `POST /api/agents/story-generator`
- Purpose: reusable agent that generates implementation-ready stories from a persisted project feature
- Request:
```json
{
  "project_id": "uuid",
  "source_type": "feature",
  "source_feature_id": "uuid",
  "story_count_hint": 4,
  "constraints": ["Keep analytics work separate"],
  "supporting_context": ["This feature will ship behind a flag"]
}
```
- Response:
```json
{
  "stories": [
    {
      "story_id": "uuid",
      "derived_from_artifact_id": "uuid",
      "status": "draft",
      "title": "string",
      "user_story": "As a ... I want ... so that ...",
      "as_a": "string",
      "i_want": "string",
      "so_that": "string",
      "description": "string",
      "acceptance_criteria": ["string"],
      "edge_cases": ["string"],
      "dependencies": ["string"],
      "priority": "high|medium|low"
    }
  ]
}
```
- Behavior: uses the OpenAI Responses API, automatically applies the active `story_spec` skill, persists generated stories into the project story store, and fails explicitly when AI is unavailable or generation fails

### `POST /api/agents/story-refiner`
- Purpose: reusable agent that evaluates and refines one or more persisted project stories
- Request:
```json
{
  "project_id": "uuid",
  "source_type": "project_story",
  "story_ids": ["uuid", "uuid"],
  "refinement_goal": "Make these stories sprint-ready.",
  "constraints": ["Preserve the original user intent"],
  "supporting_context": ["This feature is shipping behind a flag"]
}
```
- Response:
```json
{
  "results": [
    {
      "story": {
        "id": "uuid",
        "project_id": "uuid",
        "source_type": "feature",
        "source_feature_id": "uuid",
        "status": "draft",
        "generator_type": "story_refiner",
        "skill_id": "uuid",
        "skill_name": "Default Story Refinement Skill",
        "title": "string",
        "user_story": "string",
        "as_a": "string",
        "i_want": "string",
        "so_that": "string",
        "description": "string",
        "acceptance_criteria": ["string"],
        "edge_cases": ["string"],
        "dependencies": ["string"],
        "priority": "high|medium|low",
        "jira_issue_key": null,
        "jira_issue_url": null,
        "jira_issue_type": null,
        "created_at": "iso",
        "updated_at": "iso"
      },
      "evaluation": {
        "clarity_score": 4,
        "acceptance_criteria_score": 3,
        "completeness_score": 4,
        "edge_case_score": 2,
        "dependency_score": 3,
        "implementation_readiness_score": 3,
        "overall_score": 3,
        "needs_refinement": true,
        "strengths": ["Clear user intent"],
        "gaps": ["Missing rollout edge cases"],
        "refinement_reasons": ["Acceptance criteria too vague"]
      },
      "refinement_summary": "Tightened scope and made acceptance criteria testable."
    }
  ]
}
```
- Behavior: uses the OpenAI Responses API, automatically applies the active `story_refinement` skill, evaluates each story first, persists refined content back into the project story store, and returns both the updated stories and their evaluation scores

### `POST /api/agents/story-slicer`
- Purpose: reusable agent that splits one persisted project story into smaller persisted child stories
- Request:
```json
{
  "project_id": "uuid",
  "source_type": "project_story",
  "source_story_id": "uuid",
  "target_story_count_hint": 3,
  "constraints": ["Keep each child independently deliverable"],
  "supporting_context": ["This work should remain sprint-sized"]
}
```
- Response:
```json
{
  "source_story": {
    "id": "uuid",
    "project_id": "uuid",
    "source_type": "feature",
    "source_feature_id": "uuid",
    "source_story_id": null,
    "status": "sliced",
    "generator_type": "story_refiner",
    "skill_id": "uuid",
    "skill_name": "Default Story Refinement Skill",
    "title": "string"
  },
  "stories": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "source_type": "project_story",
      "source_feature_id": "uuid",
      "source_story_id": "uuid",
      "status": "draft",
      "generator_type": "story_slicer",
      "skill_id": "uuid",
      "skill_name": "Default Story Slicing Skill",
      "title": "string",
      "user_story": "string",
      "as_a": "string",
      "i_want": "string",
      "so_that": "string",
      "description": "string",
      "acceptance_criteria": ["string"],
      "edge_cases": ["string"],
      "dependencies": ["string"],
      "priority": "high|medium|low",
      "jira_issue_key": null,
      "jira_issue_url": null,
      "jira_issue_type": null,
      "created_at": "iso",
      "updated_at": "iso"
    }
  ],
  "slicing_summary": "Split the original story into smaller implementation-ready child stories."
}
```
- Behavior: uses the OpenAI Responses API, automatically applies the active `story_slicing` skill, persists sliced child stories into the project story store, links each child to the source story via `source_story_id`, and marks the original story as `sliced`

## Project Features

Project features are first-class project assets generated by reusable agents or future manual/project flows.

### `GET /api/project-features?project_id={project_id}`
- Response: `{ "features": [ ...ProjectFeatureSummary ] }`

### `GET /api/project-features/{feature_id}`
- Response: `ProjectFeatureResponse`

### `PATCH /api/project-features/{feature_id}`
- Request: any subset of:
  - `source_type`
  - `source_title`
  - `source_summary`
  - `source_details`
  - `desired_outcome`
  - `constraints`
  - `supporting_context`
  - `status`
  - `generator_type`
  - `skill_id`
  - `skill_name`
  - `title`
  - `summary`
  - `body`
  - `jira_issue_key`
  - `jira_issue_url`
  - `jira_issue_type`
- Response: updated `ProjectFeatureResponse`

### `POST /api/jira/export-feature`
- Request:
```json
{
  "project_key": "SCRUM",
  "feature": {
    "feature_id": "uuid",
    "status": "draft",
    "title": "string",
    "summary": "string",
    "body": { }
  }
}
```
- Response: `{ "issue_key": "SCRUM-123", "issue_url": "https://.../browse/SCRUM-123", "issue_type": "Epic" }`
- Behavior: exports the generated feature as a Jira Epic when available, falls back to Task only if Epic is unavailable, and updates the persisted project feature row with Jira sync metadata when the `feature_id` belongs to a stored project feature

## Project Stories

Project stories are first-class project assets generated by reusable story agents or future sync/import flows.

### `GET /api/project-stories?project_id={project_id}&source_feature_id={feature_id}&source_story_id={story_id}`
- Query params:
  - `project_id` optional
  - `source_feature_id` optional
  - `source_story_id` optional
  - `status` optional
- Response: `{ "stories": [ ...ProjectStorySummary ] }`

### `GET /api/project-stories/{story_id}`
- Response: `ProjectStoryResponse`

### `PATCH /api/project-stories/{story_id}`
- Request: any subset of:
  - `source_type`
  - `source_feature_id`
  - `source_story_id`
  - `status`
  - `generator_type`
  - `skill_id`
  - `skill_name`
  - `title`
  - `user_story`
  - `as_a`
  - `i_want`
  - `so_that`
  - `description`
  - `acceptance_criteria`
  - `edge_cases`
  - `dependencies`
  - `priority`
  - `jira_issue_key`
  - `jira_issue_url`
  - `jira_issue_type`
- Response: updated `ProjectStoryResponse`

## Projects

Projects are the intended top-level container for discovery and delivery work. Workshops and workflow runs should be created inside a project whenever the UI already has project context.

### `POST /api/projects`
- Request: `{ "name": "Rider Growth", "slug": "rider-growth", "description": "Growth discovery and delivery", "status": "active", "average_velocity_per_sprint": 24 }`
- Response: `{ "id": "uuid", "name": "Rider Growth", "slug": "rider-growth", "description": "Growth discovery and delivery", "status": "active", "workshop_count": 0, "workflow_count": 0, "active_workflow_count": 0, "feature_count": 0, "initiative_count": 0, "story_count": 0, "created_at": "...", "updated_at": "..." }`

### `GET /api/projects?status=active`
- Response: `{ "projects": [{ ...ProjectSummary }] }`

### `GET /api/projects/{project_id}`
- Response: `ProjectResponse`
- Includes:
  - `average_velocity_per_sprint`
  - `team_member_count`

### `PATCH /api/projects/{project_id}`
- Request: any subset of `{ "name", "slug", "description", "status", "average_velocity_per_sprint" }`
- Response: updated `ProjectResponse`

### `GET /api/projects/{project_id}/team`
- Response:
```json
{
  "project_id": "uuid",
  "average_velocity_per_sprint": 24,
  "minimum_ready_backlog_target": 48,
  "team_members": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "full_name": "Ava Patel",
      "role_key": "pm",
      "role_label": "Product Manager",
      "discipline": "product",
      "seniority": "senior",
      "allocation_pct": 100,
      "created_at": "iso",
      "updated_at": "iso"
    }
  ]
}
```

## Workshops

Workshops are now a first-class discovery entity that belongs to a project.

### `POST /api/workshops`
- Request:
```json
{
  "project_id": "uuid",
  "title": "April Rider Discovery Workshop",
  "status": "active",
  "source_provider": "mural",
  "source_resource_id": "mural_123",
  "source_resource_name": "Rider discovery board",
  "source_url": "https://app.mural.co/...",
  "transcript": "optional raw transcript",
  "notes": "optional notes",
  "source_payload": {},
  "insights_payload": {},
  "journey_payload": {},
  "import_meta": {}
}
```
- Response: `WorkshopResponse`

### `GET /api/workshops?project_id=uuid&status=active`
- Query params:
  - `project_id` optional
  - `status` optional
- Response: `{ "workshops": [ ...WorkshopSummary ] }`

### `GET /api/workshops/{workshop_id}`
- Response: `WorkshopResponse`

### `PATCH /api/workshops/{workshop_id}`
- Request: any subset of:
  - `title`
  - `status`
  - `source_provider`
  - `source_resource_id`
  - `source_resource_name`
  - `source_url`
  - `transcript`
  - `notes`
  - `source_payload`
  - `insights_payload`
  - `journey_payload`
  - `import_meta`
  - `current_workflow_id`
  - `latest_workflow_step`
  - `latest_workflow_status`
- Response: updated `WorkshopResponse`

### `POST /api/workshop/analyze`
- Request: `{ "title": "string", "transcript": "string", "notes": "string | null" }`
- Response: `{ "workshop_id": "uuid", "insights": { "action_items": [], "decisions": [], "pain_points": [], "opportunities": [] } }`

### `POST /api/initiative/generate`
- Request: `{ "workshop_id": "uuid", "insights": { ... } }`
- Response: `{ "initiatives": [{ "title": "...", "description": "...", "problem_statement": "...", "priority": "high|medium|low" }] }`

### `POST /api/opportunity/synthesize`
- Request: `{ "title": "string", "insights": { ... } | null, "journey": { "stages": [...] } | null }`
- Response: `{ "opportunities": [{ "id": "opp_1", "title": "...", "problem_statement": "...", "why_it_matters": "...", "confidence": 87, "impact": "high|medium|low", "evidence": [{ "text": "...", "category": "negative_moments", "stage": "Entice" }] }] }`
- Behavior: uses the OpenAI Responses API and fails explicitly when AI is unavailable or generation fails

### `POST /api/opportunity/validate`
- Request: `{ "title": "string | null", "opportunities": [...], "approved_ids": ["opp_1"], "discarded_ids": ["opp_2"] }`
- Response: `{ "approved": [...], "discarded_ids": ["opp_2"], "total_candidates": 3, "total_approved": 1 }`

### `POST /api/solution-shaping/synthesize`
- Request: `{ "opportunities": [{ "id": "opp_1", "title": "...", "problem_statement": "...", "why_it_matters": "...", "confidence": 87, "impact": "high", "evidence": [...] }] }`
- Response: `{ "shaped": [{ "id": "shaped-opp_1", "derived_from_opportunity_id": "opp_1", "recommended_type": "Feature|Initiative|Enhancement|No action", "title": "...", "problem_statement": "...", "rationale": "...", "scope": "Medium - 2-4 sprints" }] }`
- Behavior: uses the OpenAI Responses API and fails explicitly when AI is unavailable or generation fails

### `POST /api/solution-shaping/confirm`
- Request: `{ "shaped": [{ "derived_from_opportunity_id": "opp_1", "recommended_type": "Feature", "chosen_type": "Feature", ... }] }`
- Response: `{ "shaped": [...], "actionable_count": 1, "deferred_count": 0 }`

### `POST /api/artifacts/generate`
- Request: `{ "shaped": [{ "id": "shaped-1", "derived_from_opportunity_id": "opp_1", "recommended_type": "Feature", "chosen_type": "Feature", "title": "...", "problem_statement": "...", "rationale": "...", "scope": "Small - 1-2 sprints" }] }`
- Response: `{ "artifacts": [{ "artifact_id": "artifact_1", "artifact_type": "initiative|feature|enhancement", "derived_from_solution_id": "shaped-1", "status": "draft", "title": "...", "summary": "...", "body": { ...type-specific fields... } }] }`
- Behavior: uses the OpenAI Responses API; `feature` artifacts also follow the active `feature_spec` skill

Feature body shape now includes canonical PM fields:
- `problem_statement`
- `user_segment`
- `proposed_solution`
- `user_value`
- `business_value`
- `functional_requirements`
- `non_functional_requirements`
- `dependencies`
- `success_metrics`
- `priority`

Compatibility note:
- feature bodies still also include `user_problem` and `solution_overview` for the current UI, but `problem_statement` and `proposed_solution` are now the preferred fields going forward

### `POST /api/artifacts/approve`
- Request: `{ "artifacts": [...], "approved_ids": ["artifact_1"], "rejected_ids": ["artifact_2"] }`
- Response: `{ "artifacts": [...approved artifacts only...], "approved_count": 1, "rejected_count": 1, "total_candidates": 2 }`

### `POST /api/stories/slice`
- Request: `{ "artifacts": [...approved artifacts...] }`
- Response: `{ "stories": [{ "story_id": "story_1", "derived_from_artifact_id": "artifact_1", "status": "draft", "title": "...", "user_story": "As a ..., I want ..., so that ...", "as_a": "...", "i_want": "...", "so_that": "...", "description": "...", "acceptance_criteria": [], "edge_cases": [], "dependencies": [], "priority": "high|medium|low" }] }`
- Behavior: uses the OpenAI Responses API and fails explicitly when AI is unavailable or generation fails

## Async Generation Jobs

These endpoints are the preferred path for long-running AI work so the UI can stay responsive and subscribe to real-time status updates.

### `POST /api/jobs/opportunity-synthesis`
- Request: same as `POST /api/opportunity/synthesize`
- Response: `{ "job": { "id": "uuid", "job_type": "opportunity_synthesis", "status": "queued", "progress_stage": "queued", "progress_message": "Queued for AI opportunity synthesis.", "input_payload": { ... }, "result_payload": null, "error_message": null, "created_at": "...", "updated_at": "...", "completed_at": null } }`

### `POST /api/jobs/feature-generation`
- Request: same as `POST /api/agents/feature-generator`
- Response: same job wrapper with `job_type = "feature_generation"`

### `POST /api/jobs/solution-shaping`
- Request: same as `POST /api/solution-shaping/synthesize`
- Response: same job wrapper with `job_type = "solution_shaping"`

### `POST /api/jobs/artifact-generation`
- Request: same as `POST /api/artifacts/generate`
- Response: same job wrapper with `job_type = "artifact_generation"`

### `POST /api/jobs/story-slicing`
- Request: same as `POST /api/stories/slice`
- Response: same job wrapper with `job_type = "story_slicing"`

### `GET /api/jobs/{job_id}`
- Response: `{ "id": "uuid", "job_type": "...", "status": "queued|running|completed|failed|cancelled", "progress_stage": "queued|running|completed|failed", "progress_message": "...", "input_payload": { ... }, "result_payload": { ... } | null, "error_message": "..." | null, "created_at": "...", "updated_at": "...", "completed_at": "..." | null }`

### `WS /api/jobs/ws/{job_id}`
- WebSocket stream for live job updates
- Event payload:
```json
{
  "event": "job.updated",
  "job": {
    "id": "uuid",
    "job_type": "story_slicing",
    "status": "running",
    "progress_stage": "running",
    "progress_message": "Queued for AI story slicing.",
    "input_payload": { "...": "..." },
    "result_payload": null,
    "error_message": null,
    "created_at": "2026-04-13T00:00:00Z",
    "updated_at": "2026-04-13T00:00:01Z",
    "completed_at": null
  }
}
```
- Notes:
  - first message is sent immediately on connect with the current job snapshot
  - for the first backend pass, progress is honest but coarse: `queued`, `running`, `completed`, `failed`
  - richer sub-stages can be added later as the long-running services emit them

### `POST /api/stories/approve`
- Request: `{ "stories": [...], "approved_ids": ["story_1"], "rejected_ids": ["story_2"] }`
- Response: `{ "stories": [...approved stories only...], "approved_count": 1, "rejected_count": 1, "total_candidates": 2 }`

### `POST /api/connectors/jira/connect`
- Request: `{ "base_url": "https://your-domain.atlassian.net", "email": "pm@company.com", "api_token": "..." }`
- Response: `{ "connected": true, "base_url": "...", "email": "...", "display_name": "Jane PM", "account_id": "..." }`

### `GET /api/connectors/jira/connect`
- Response: `{ "provider": "jira", "authorization_url": "https://auth.atlassian.com/authorize?...","state": "..." }`
- Behavior: preferred Jira auth flow for MVP now that backend OAuth app credentials are configured

### `GET /api/connectors/jira/callback?code=...&state=...`
- Behavior: exchanges the Atlassian OAuth code, stores the Jira session, then redirects browser back to the web app callback route

### `GET /api/connectors/jira/status`
- Response: `{ "connected": false, "base_url": "", "email": "" }` when disconnected, or connected session metadata when authenticated

### `POST /api/connectors/jira/disconnect`
- Response: `{ "connected": false }`

### `GET /api/connectors/jira/projects`
- Response: `{ "projects": [{ "id": "10000", "key": "PROD", "name": "ProductOS", "project_type_key": "software" }] }`

### `GET /api/connectors`
- Response:
```json
{
  "connectors": [
    {
      "provider": "mural",
      "label": "Mural",
      "category": "discovery",
      "connected": true,
      "display_name": "Jane PM",
      "username": "jane@company.com",
      "base_url": null,
      "account_id": null,
      "state": "oauth_state",
      "last_connected_at": "2026-04-14T00:00:00Z",
      "last_synced_at": "2026-04-14T00:10:00Z",
      "last_synced_resource_name": "User personas",
      "metadata": {}
    },
    {
      "provider": "jira",
      "label": "Jira",
      "category": "delivery",
      "connected": true,
      "display_name": "Jane PM",
      "username": "jane@company.com",
      "base_url": "https://example.atlassian.net",
      "account_id": "abc123",
      "state": "oauth_state",
      "last_connected_at": "2026-04-14T00:00:00Z",
      "last_synced_at": null,
      "last_synced_resource_name": null,
      "metadata": {
        "cloud_id": "..."
      }
    }
  ]
}
```
- Purpose: global integration hub for discovery and delivery connectors

### `POST /api/connectors/mural/disconnect`
- Response: `{ "connected": false }`

## Workflow Runs

These endpoints create a first-class backend source of truth for workshop flows so the UI can restore, list, and resume workflows by `workflow_id` instead of relying on browser-only storage.

### `POST /api/workflows`
- Request:
```json
{
  "workflow_type": "workshop",
  "workflow_definition_key": "discovery_to_delivery",
  "workflow_definition_label": "Discovery to Delivery",
  "project_id": "uuid | null",
  "workshop_id": "uuid | null",
  "title": "Q2 Planning Workshop",
  "source_provider": "mural",
  "source_resource_id": "mural_123",
  "source_resource_name": "User personas",
  "current_step": "workshop",
  "status": "active",
  "state_payload": {
    "workshop": {},
    "opportunities": []
  }
}
```
- Response:
```json
{
  "id": "uuid",
  "workflow_type": "workshop",
  "workflow_definition_key": "discovery_to_delivery",
  "workflow_definition_label": "Discovery to Delivery",
  "project_id": "uuid | null",
  "workshop_id": "uuid | null",
  "title": "Q2 Planning Workshop",
  "source_provider": "mural",
  "source_resource_id": "mural_123",
  "source_resource_name": "User personas",
  "current_step": "workshop",
  "status": "active",
  "state_payload": {},
  "created_at": "...",
  "updated_at": "..."
}
```

### `GET /api/workflows?workflow_type=workshop&workflow_definition_key=discovery_to_delivery&project_id=uuid&workshop_id=uuid`
- Query params:
  - `workflow_type` optional
  - `workflow_definition_key` optional
  - `project_id` optional
  - `workshop_id` optional
- Response: `{ "workflows": [ ...WorkflowRunResponse ] }`

### `GET /api/workflows/{workflow_id}`
- Response: `WorkflowRunResponse`

### `PATCH /api/workflows/{workflow_id}`
- Request:
```json
{
  "workflow_definition_key": "discovery_to_delivery",
  "workflow_definition_label": "Discovery to Delivery",
  "project_id": "uuid | null",
  "workshop_id": "uuid | null",
  "current_step": "stories",
  "status": "active",
  "state_payload": {
    "workshop": {},
    "opportunity_pipeline_data": {},
    "shaping_pipeline_data": {},
    "artifact_pipeline_data": {},
    "stories_pipeline_data": {}
  }
}
```
- Response: updated `WorkflowRunResponse`
- Intended use:
  - keep workflow progress durable across refreshes
  - resume a specific workflow from the Workshop list page
  - decouple saved workflow state from whichever Mural was most recently opened

### `GET /api/workflows/feature-hardening/source?project_key=ABC`
- Query params:
  - `project_key` required Jira project key
- Response:
```json
{
  "features": [
    {
      "issue_key": "ABC-123",
      "issue_url": "https://.../browse/ABC-123",
      "project_key": "ABC",
      "issue_type": "Epic",
      "status_name": "Backlog",
      "title": "Reduce booking abandonment",
      "description_text": "Existing Jira description flattened to text"
    }
  ]
}
```

### `POST /api/workflows/feature-hardening/run`
- Request:
```json
{
  "project_id": "uuid",
  "workflow_id": "uuid | null",
  "source_type": "jira_project",
  "jira_project_key": "ABC",
  "issue_keys": ["ABC-123", "ABC-124"],
  "refinement_goal": "Make these epics story-generation ready",
  "constraints": ["Preserve business intent"],
  "supporting_context": ["Quarterly retention focus"]
}
```
- Response:
```json
{
  "workflow_id": "uuid | null",
  "jira_project_key": "ABC",
  "hardening_summary": "Evaluated 2 Jira epics. 1 needed hardening. Average readiness score: 3.5/5.",
  "results": [
    {
      "issue_key": "ABC-123",
      "issue_url": "https://.../browse/ABC-123",
      "source_feature": {
        "issue_key": "ABC-123",
        "issue_url": "https://.../browse/ABC-123",
        "project_key": "ABC",
        "issue_type": "Epic",
        "status_name": "Backlog",
        "title": "Reduce booking abandonment",
        "description_text": "Existing Jira description flattened to text"
      },
      "evaluation": {
        "problem_clarity_score": 4,
        "solution_clarity_score": 3,
        "requirement_completeness_score": 2,
        "dependency_score": 3,
        "success_metrics_score": 2,
        "implementation_readiness_score": 3,
        "overall_score": 3,
        "needs_refinement": true,
        "strengths": [],
        "gaps": [],
        "refinement_reasons": []
      },
      "refined_feature": {
        "feature_id": "ABC-123",
        "status": "draft",
        "title": "Reduce booking abandonment",
        "summary": "Refined summary",
        "body": {
          "problem_statement": "",
          "user_segment": "",
          "proposed_solution": "",
          "user_value": "",
          "business_value": "",
          "functional_requirements": [],
          "non_functional_requirements": [],
          "dependencies": [],
          "success_metrics": [],
          "priority": ""
        }
      },
      "refinement_summary": "Clarified scope and measurable outcomes."
    }
  ]
}
```

### `POST /api/workflows/feature-hardening/publish`
- Request:
```json
{
  "project_id": "uuid",
  "workflow_id": "uuid | null",
  "jira_project_key": "ABC",
  "results": [
    {
      "issue_key": "ABC-123",
      "refined_feature": {
        "feature_id": "ABC-123",
        "status": "draft",
        "title": "Reduce booking abandonment",
        "summary": "Refined summary",
        "body": {
          "problem_statement": "",
          "user_segment": "",
          "proposed_solution": "",
          "user_value": "",
          "business_value": "",
          "functional_requirements": [],
          "non_functional_requirements": [],
          "dependencies": [],
          "success_metrics": [],
          "priority": ""
        }
      }
    }
  ]
}
```
- Response:
```json
{
  "workflow_id": "uuid | null",
  "results": [
    {
      "issue_key": "ABC-123",
      "issue_url": "https://.../browse/ABC-123",
      "issue_type": "Epic",
      "updated": true
    }
  ]
}
```

### `GET /api/workflows/backlog-refinement/source?project_id=uuid&project_key=SCRUM`
- Query params:
  - `project_id` required ProductOS project id
  - `project_key` required Jira project key
- Response:
```json
{
  "jira_project_key": "SCRUM",
  "total_story_points": 34,
  "features": [
    {
      "issue_key": "SCRUM-25",
      "issue_url": "https://.../browse/SCRUM-25",
      "project_key": "SCRUM",
      "issue_type": "Epic",
      "status_name": "Idea",
      "priority_name": "Highest",
      "title": "Airport Pickup Guidance",
      "description_text": "Existing Jira description flattened to text",
      "story_count": 3,
      "total_story_points": 26
    }
  ],
  "stories": [
    {
      "issue_key": "SCRUM-26",
      "issue_url": "https://.../browse/SCRUM-26",
      "project_key": "SCRUM",
      "issue_type": "Story",
      "status_name": "To Do",
      "priority_name": "Medium",
      "title": "Airport pickup guidance UI",
      "description_text": "Detailed Jira story description flattened to text",
      "parent_issue_key": "SCRUM-25",
      "parent_title": "Airport Pickup Guidance",
      "story_points": 5
    }
  ]
}
```

### `POST /api/workflows/backlog-refinement/analyze`
- Request:
```json
{
  "project_id": "uuid",
  "workflow_id": "uuid | null",
  "source_type": "jira_project",
  "jira_project_key": "SCRUM",
  "feature_issue_keys": ["SCRUM-25", "SCRUM-24"]
}
```
- Response:
```json
{
  "workflow_id": "uuid | null",
  "jira_project_key": "SCRUM",
  "health": {
    "average_velocity_per_sprint": 24,
    "minimum_ready_backlog_target": 48,
    "total_backlog_story_points": 34,
    "total_ready_story_points": 21,
    "backlog_point_shortfall": 27,
    "feature_count": 6,
    "story_count": 8
  },
  "generate": [
    {
      "issue_key": "SCRUM-22",
      "issue_url": "https://.../browse/SCRUM-22",
      "item_type": "feature",
      "title": "Fare Lock During Booking",
      "reason": "No stories exist yet for this feature, so story generation is needed."
    }
  ],
  "refine": [
    {
      "issue_key": "SCRUM-30",
      "issue_url": "https://.../browse/SCRUM-30",
      "item_type": "story",
      "parent_issue_key": "SCRUM-24",
      "title": "Preset reuse analytics instrumentation",
      "story_points": null,
      "reason": "Story needs stronger detail or estimation before it is truly ready."
    }
  ],
  "slice": [
    {
      "issue_key": "SCRUM-28",
      "issue_url": "https://.../browse/SCRUM-28",
      "item_type": "story",
      "parent_issue_key": "SCRUM-25",
      "title": "Airport pickup fallback ops flow",
      "story_points": 13,
      "reason": "Story is oversized and should be sliced into smaller delivery units."
    }
  ],
  "ready": [
    {
      "issue_key": "SCRUM-26",
      "issue_url": "https://.../browse/SCRUM-26",
      "item_type": "story",
      "parent_issue_key": "SCRUM-25",
      "title": "Airport pickup guidance UI",
      "story_points": 5,
      "reason": "Story is estimated, sufficiently detailed, and ready to stay in the backlog."
    }
  ],
  "summary": "Checked 6 prioritized features and 8 backlog stories. Ready backlog points: 21/48. Buckets — Generate: 5, Refine: 3, Slice: 1, Ready: 4."
}
```

### `POST /api/workflows/backlog-refinement/execute`
- Request:
```json
{
  "project_id": "uuid",
  "workflow_id": "uuid | null",
  "jira_project_key": "SCRUM",
  "generate_issue_keys": ["SCRUM-22"],
  "refine_issue_keys": ["SCRUM-30"],
  "slice_issue_keys": ["SCRUM-28"]
}
```
- Response:
```json
{
  "workflow_id": "uuid | null",
  "jira_project_key": "SCRUM",
  "execution": {
    "generate_count": 1,
    "refine_count": 1,
    "slice_count": 1,
    "approved_total": 3,
    "created_story_count": 3,
    "updated_story_count": 2,
    "sliced_story_count": 1
  },
  "results": [
    {
      "bucket": "generate",
      "source_issue_key": "SCRUM-22",
      "status": "completed",
      "message": "Generated and created 3 stories.",
      "created_issues": [
        {
          "issue_key": "SCRUM-40",
          "issue_url": "https://.../browse/SCRUM-40",
          "project_key": "SCRUM",
          "issue_type": "Story",
          "title": "Fare lock happy path",
          "story_points": 5
        }
      ]
    },
    {
      "bucket": "slice",
      "source_issue_key": "SCRUM-28",
      "status": "completed",
      "message": "Split the original story into 3 smaller stories.",
      "updated_issue": {
        "issue_key": "SCRUM-28",
        "issue_url": "https://.../browse/SCRUM-28",
        "project_key": "SCRUM",
        "issue_type": "Story",
        "title": "Airport guidance pre-arrival confirmation",
        "story_points": 3
      },
      "created_issues": [
        {
          "issue_key": "SCRUM-41",
          "issue_url": "https://.../browse/SCRUM-41",
          "project_key": "SCRUM",
          "issue_type": "Story",
          "title": "Airport guidance live wayfinding",
          "story_points": 3
        },
        {
          "issue_key": "SCRUM-42",
          "issue_url": "https://.../browse/SCRUM-42",
          "project_key": "SCRUM",
          "issue_type": "Story",
          "title": "Airport guidance proactive reminder triggers",
          "story_points": 2
        }
      ]
    }
  ],
  "summary": "Executed backlog refinement — Generate: 1, Refine: 1, Slice: 1. Created 3 Jira stories, updated 2, sliced 1."
}
```

### `POST /api/jobs/backlog-refinement-analysis`
- Purpose: async variant of backlog refinement analysis
- Request: same as `POST /api/workflows/backlog-refinement/analyze`
- Response: `GenerationJobAcceptedResponse`

### `POST /api/jobs/backlog-refinement-execution`
- Purpose: async variant of backlog refinement execution
- Request: same as `POST /api/workflows/backlog-refinement/execute`
- Response: `GenerationJobAcceptedResponse`

### `POST /api/jira/export`
- Request: `{ "project_key": "PROD", "stories": [...approved stories...], "parent_strategy": "none|feature-as-epic|initiative-as-epic", "artifacts": [...approved artifacts...] }`
- Response: `{ "issues": [{ "story_id": "story_1", "issue_key": "PROD-101", "issue_url": "https://.../browse/PROD-101", "parent_issue_key": "PROD-100" }] }`

### `POST /api/feature/generate`
- Request: `{ "initiatives": [...] }`
- Response: `{ "features": [{ "title": "...", "description": "...", "business_value": "...", "initiative_title": "..." }] }`

### `POST /api/prd/generate`
- Request: `{ "feature": { ... } }`
- Response: `{ "prd": { "overview": "...", "problem": "...", "solution": "...", "scope": [], "assumptions": [] } }`

### `POST /api/story/generate`
- Request: `{ "feature": { ... }, "prd": { ... } | null }`
- Response: `{ "stories": [{ "title": "...", "description": "...", "acceptance_criteria": [], "edge_cases": [], "priority": "...", "dependencies": [] }] }`

### `POST /api/story/refine`
- Request: `{ "stories": [...] }`
- Response: `{ "stories": [...] }`

### `POST /api/story/slice`
- Request: `{ "stories": [...] }`
- Response: `{ "stories": [...] }`

### `POST /api/jira/push`
- Request: `{ "project_key": "string | null", "stories": [...] }`
- Response: `{ "issues": [{ "story_title": "...", "issue_key": "...", "issue_url": "..." }] }`

## Connectors

### `GET /api/connectors/mural/connect`
- Response: `{ "provider": "mural", "authorization_url": "...", "state": "..." }`

### `GET /api/connectors/mural/callback?code=...&state=...`
- Behavior: exchanges the OAuth code, persists the connection, then redirects browser to the web app callback route
- Redirect target: `http://localhost:5173/oauth/mural/callback?provider=mural&state=...&connected=true&username=...&full_name=...`

### `GET /api/connectors/mural/status?state=...`
- Response: same as callback response

### `GET /api/connectors/mural/workspaces?state=...`
- Response: `{ "provider": "mural", "workspaces": [{ "id": "...", "name": "...", "member_count": 0 }] }`

### `GET /api/connectors/mural/workspaces/{workspace_id}/rooms?state=...`
- Response: `{ "provider": "mural", "rooms": [{ "id": "...", "name": "...", "workspace_id": "..." }] }`

### `GET /api/connectors/mural/workspaces/{workspace_id}/murals?state=...`
- Response: `{ "provider": "mural", "murals": [{ "id": "...", "name": "...", "workspace_id": "...", "room_id": "...", "last_modified": "..." }] }`

### `GET /api/connectors/mural/murals/{mural_id}/widgets?state=...`
- Response: `{ "provider": "mural", "widgets": [{ "id": "...", "type": "...", "text": "...", "title": "...", "parent_id": "...", "raw": {} }] }`

### `POST /api/connectors/mural/murals/{mural_id}/import?state=...`
- Response: `{ "provider": "mural", "mural_id": "...", "mural_name": "...", "imported_widget_count": 0, "extracted_text_count": 0, "extracted_text": [], "insights": { ... }, "journey": { "stages": [{ "stage": "Entice", "categories": { "experience_steps": [], "interactions": [], "goals_and_motivations": [], "positive_moments": [], "negative_moments": [], "areas_of_opportunity": [] } }], "uncategorized": [] } }`

## Errors
- FastAPI validation errors use standard HTTP `422`
- Runtime and application errors should return `{ "detail": "..." }`
