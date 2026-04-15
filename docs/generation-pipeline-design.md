# Generation Pipeline Design

This document defines the next backend design after:

`Workshop import -> Opportunity validation -> Solution shaping`

The next product stages are:

`Artifact generation -> Artifact approval -> Story slicing -> Story approval -> Jira export`

## Product intent

The system should not jump straight from shaped solutions to Jira stories.

Instead:

1. Generate the right artifact type from each shaped solution
2. Let the PM review and approve the generated artifact
3. Slice approved artifacts into multiple implementation-ready stories
4. Let the PM review and approve those stories
5. Push approved stories to Jira

## Core principle

Every LLM generation step should be:

- schema-bound
- template-driven
- reviewable by the PM
- traceable back to the previous artifact

## Backend skill architecture

Before wiring the next UI, the backend should treat each generation step as a reusable skill/module rather than a single generic prompt.

These are application-level generation skills, not Codex skills.

Recommended backend skill modules:

- `artifact_generation_llm_service.py`
- `story_slicing_llm_service.py`
- `jira_mapping_service.py`
- `prompt_builders/initiative_prompt.py`
- `prompt_builders/feature_prompt.py`
- `prompt_builders/enhancement_prompt.py`
- `prompt_builders/story_slice_prompt.py`
- `prompt_builders/jira_export_prompt.py`

Each skill should provide:

- input schema
- template-specific prompt builder
- output schema
- fallback rules
- traceability fields linking output IDs to parent inputs

### Skill responsibilities

#### Initiative generation skill
- use only initiative template
- optimize for strategic framing, outcomes, success metrics, and scope boundaries

#### Feature generation skill
- use only feature template
- optimize for bounded capability definition, requirements, and dependencies

#### Enhancement generation skill
- use only enhancement template
- optimize for incremental improvements to an existing surface/capability

#### Story slicing skill
- convert approved artifacts into multiple implementable stories
- preserve linkage to parent artifact
- avoid oversized umbrella stories

#### Jira mapping skill
- convert approved stories into Jira-ready issue payloads
- map summary, description, acceptance criteria, labels, priority, and parent linkage

## Canonical entities

### 1. Shaped solution
Input from solution shaping.

```json
{
  "id": "shaped-opp_1",
  "derived_from_opportunity_id": "opp_1",
  "recommended_type": "Feature",
  "chosen_type": "Feature",
  "title": "Smart Notification Engine",
  "problem_statement": "...",
  "rationale": "...",
  "scope": "Medium - 2-4 sprints"
}
```

### 2. Generated artifact
The PM artifact generated from a shaped solution.

Common envelope:

```json
{
  "artifact_id": "artifact_123",
  "artifact_type": "initiative|feature|enhancement",
  "derived_from_solution_id": "shaped-opp_1",
  "status": "draft|approved|rejected",
  "title": "string",
  "summary": "string",
  "body": {}
}
```

### 3. Story slice
A Jira-ready implementation story derived from an approved artifact.

```json
{
  "story_id": "story_123",
  "derived_from_artifact_id": "artifact_123",
  "status": "draft|approved|rejected",
  "title": "string",
  "description": "string",
  "acceptance_criteria": [],
  "edge_cases": [],
  "priority": "high|medium|low",
  "dependencies": []
}
```

## Templates by artifact type

## Initiative template

Use when the shaped solution is broad, strategic, and likely spans multiple features or teams.

```json
{
  "title": "string",
  "summary": "string",
  "problem_statement": "string",
  "desired_outcome": "string",
  "success_metrics": ["string"],
  "scope": {
    "in_scope": ["string"],
    "out_of_scope": ["string"]
  },
  "assumptions": ["string"],
  "risks": ["string"],
  "priority": "high|medium|low",
  "linked_opportunities": ["opp_1"]
}
```

## Feature template

Use when the shaped solution is a bounded user-facing capability.

```json
{
  "title": "string",
  "summary": "string",
  "user_problem": "string",
  "solution_overview": "string",
  "user_value": "string",
  "business_value": "string",
  "functional_requirements": ["string"],
  "non_functional_requirements": ["string"],
  "dependencies": ["string"],
  "constraints": ["string"],
  "priority": "high|medium|low",
  "linked_opportunities": ["opp_1"],
  "parent_initiative_id": "initiative_123 | null"
}
```

## Enhancement template

Use when the shaped solution is an improvement to an existing capability.

```json
{
  "title": "string",
  "summary": "string",
  "current_capability": "string",
  "current_issue": "string",
  "proposed_improvement": "string",
  "expected_impact": "string",
  "affected_surfaces": ["string"],
  "dependencies": ["string"],
  "constraints": ["string"],
  "priority": "high|medium|low",
  "linked_opportunities": ["opp_1"],
  "parent_feature_id": "feature_123 | null"
}
```

## Story template

Use for sliced implementation-ready delivery units.

```json
{
  "title": "string",
  "description": "string",
  "acceptance_criteria": ["string"],
  "edge_cases": ["string"],
  "dependencies": ["string"],
  "priority": "high|medium|low"
}
```

## Backend endpoint design

## 1. Artifact generation

### `POST /api/artifacts/generate`

Generate initiative, feature, or enhancement drafts from shaped solutions.

Request:

```json
{
  "shaped": [
    {
      "id": "shaped-opp_1",
      "derived_from_opportunity_id": "opp_1",
      "recommended_type": "Feature",
      "chosen_type": "Feature",
      "title": "Smart Notification Engine",
      "problem_statement": "...",
      "rationale": "...",
      "scope": "Medium - 2-4 sprints"
    }
  ]
}
```

Response:

```json
{
  "artifacts": [
    {
      "artifact_id": "artifact_123",
      "artifact_type": "feature",
      "derived_from_solution_id": "shaped-opp_1",
      "status": "draft",
      "title": "Smart Notification Engine",
      "summary": "string",
      "body": {
        "user_problem": "string",
        "solution_overview": "string",
        "user_value": "string",
        "business_value": "string",
        "functional_requirements": ["string"],
        "non_functional_requirements": ["string"],
        "dependencies": ["string"],
        "constraints": ["string"],
        "priority": "high"
      }
    }
  ]
}
```

Behavior:

- route each shaped solution by `chosen_type`
- use the corresponding artifact template
- return one artifact draft per actionable shaped solution
- ignore `No action`

## 2. Artifact approval

### `POST /api/artifacts/approve`

Request:

```json
{
  "artifacts": [...],
  "approved_ids": ["artifact_123"],
  "rejected_ids": []
}
```

Response:

```json
{
  "approved": [...],
  "rejected_ids": [],
  "total_candidates": 1,
  "total_approved": 1
}
```

Behavior:

- update statuses for approval workflow
- return only approved artifacts for downstream slicing

## 3. Story slicing

### `POST /api/stories/slice`

Request:

```json
{
  "artifacts": [...]
}
```

Response:

```json
{
  "stories": [
    {
      "story_id": "story_123",
      "derived_from_artifact_id": "artifact_123",
      "status": "draft",
      "title": "As a user, I receive timely ride suggestions",
      "description": "string",
      "acceptance_criteria": ["string"],
      "edge_cases": ["string"],
      "dependencies": ["string"],
      "priority": "high"
    }
  ]
}
```

Behavior:

- use artifact type + scope to determine slicing
- prefer multiple focused stories over one oversized story
- preserve linkage to the source artifact

## 4. Story approval

### `POST /api/stories/approve`

Request:

```json
{
  "stories": [...],
  "approved_ids": ["story_123"],
  "rejected_ids": []
}
```

Response:

```json
{
  "approved": [...],
  "rejected_ids": [],
  "total_candidates": 3,
  "total_approved": 2
}
```

## 5. Jira connection

We should support a Jira connector, but Jira should be treated as a **delivery connector**, not a visual connector.

That means Jira authentication should not live on the `Workshop Intelligence` screen beside Miro / FigJam / Mural.

Recommended placement:

- primary: `Jira Export` screen
- secondary later: a dedicated `Connectors / Integrations` settings area that shows all active connections

For the MVP, the Jira connection UX should live inside the `Jira Export` step.

Why:

- Jira is an output target, not an input source for workshop evidence
- the PM only needs it once artifacts and stories are approved
- this keeps the early workflow focused on discovery and shaping rather than delivery setup

### Connection/config endpoints

### `POST /api/connectors/jira/connect`

Request:

```json
{
  "base_url": "https://your-domain.atlassian.net",
  "email": "pm@company.com",
  "api_token": "string"
}
```

Response:

```json
{
  "connected": true,
  "cloud_id": "string | null",
  "display_name": "string | null"
}
```

### `GET /api/connectors/jira/projects`

Response:

```json
{
  "projects": [
    {
      "key": "PROD",
      "name": "ProductOS"
    }
  ]
}
```

## 6. Jira export

### `POST /api/jira/export`

Request:

```json
{
  "project_key": "PROD",
  "stories": [...],
  "parent_strategy": "none|initiative-as-epic|feature-as-epic"
}
```

Response:

```json
{
  "issues": [
    {
      "story_id": "story_123",
      "issue_key": "PROD-101",
      "issue_url": "https://your-domain.atlassian.net/browse/PROD-101"
    }
  ]
}
```

Behavior:

- create Jira issues only from approved stories
- optionally create parent epic structure based on chosen export strategy
- return issue keys and URLs

## Recommended UI placement for Jira

### Do not place Jira here
- visual tool connector strip on `Workshop Intelligence`

### Place Jira here
- `Jira Export` screen, with:
  - connection status
  - connect/authenticate form
  - project picker
  - export preview
  - push button

### Future optional placement
- global `Integrations` or `Connectors` management page
- this would show:
  - Mural / Miro / FigJam as discovery connectors
  - Jira as a delivery connector
  - connection health / reconnect / disconnect state

## LLM generation strategy

Each generation endpoint should be:

- prompt-driven by artifact template
- schema-bound in the response
- traceable back to input IDs

Suggested internal services:

- `artifact_generation_llm_service.py`
- `story_slicing_llm_service.py`
- `jira_mapping_service.py`

## UI sequence requested from frontend

The next UI screens after Solution Shaping should be:

1. `Artifact Generation`
- show generated initiative / feature / enhancement drafts
- allow edit / approve / reject

2. `Story Slicing`
- show generated stories grouped by source artifact
- allow edit / approve / reject

3. `Jira Export`
- choose Jira project
- preview issues
- push approved stories

## Immediate implementation order

Recommended backend build order:

1. `POST /api/artifacts/generate`
2. `POST /api/artifacts/approve`
3. `POST /api/stories/slice`
4. `POST /api/stories/approve`
5. Jira connector + `POST /api/jira/export`
