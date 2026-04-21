# Handoff — ProductOS

This file is the active source of truth for Claude Code UI work.

If older chat history conflicts with this file, this file wins.

## Global Product Rules

- fail fast, fail clearly
- do not fabricate fallback data for AI-driven results
- if an agent or workflow returns missing, malformed, or incomplete output:
  - stop the flow
  - surface a clear error message
  - do not silently substitute placeholder scores, fake summaries, or synthetic content
- do not imply live web research, citations, or monitored intelligence unless the backend truly does that

## Active UI Task

Build the first project-scoped UI for:

- `Agent Run History`

This is the only active UI handoff right now.

## Backend Already Available

- all async agent jobs now persist project-scoped run metadata in `generation_jobs`
- new route:
  - `GET /api/projects/{project_id}/agent-runs`
- optional query params:
  - `agent_key`
  - `status`

Frontend helper already available at:

- `apps/web/src/api/projects.js`

Relevant function:

- `getProjectAgentRuns(projectId, { agentKey, status })`

## Current MVP Model

- this is a read-only project history view for agent runs
- it is intentionally separate from workflow run history
- it includes runs for standalone agents only:
  - `Feature Generator`
  - `Feature Refiner`
  - `Feature Prioritizer`
  - `Story Generator`
  - `Story Refiner`
  - `Story Slicer`
  - `Competitor Analysis`
- workflow jobs should not be shown in this first pass

## Response Shape

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

## What Claude Should Build

### 1. Add a project-level agent runs surface

Preferred place:

- inside the project experience, alongside the existing `Agents` area

Good options:

- an `Agent Runs` section under the `Agents` tab
- or a right-side / lower history panel inside the project `Agents` tab

Keep it project-scoped.

### 2. Show run history grouped by agent

Recommended UX:

- group by `agent_label`
- newest runs first within each group
- show a simple count per group when helpful

### 3. Each run row/card should show

- agent label
- status
- created / updated time
- progress message when running
- failure message when failed

If completed:

- show a compact success state
- allow expanding to inspect the stored result payload

### 4. Provide lightweight filters

Helpful first-pass filters:

- all agents
- one selected agent
- status filter

Use the backend query params when filtering.

### 5. Do not overbuild resume/replay yet

For this first pass:

- do not add rerun/resume execution from history
- do not mutate runs
- do not merge workflow history into this view

This is a project-level observability/history surface only.

## Important UI Constraints

- do not mix workflow runs into this history view
- do not imply a run can be resumed unless that behavior truly exists
- do not fabricate summaries from missing result payloads
- if a run failed, show the real `error_message`
- if a run is still running, prefer `progress_message`

## Good Default Framing

Use language like:

- `Agent run history`
- `Track AI agent activity for this project`
- `View recent completed, running, and failed agent runs`

Avoid language like:

- `workflow history` for this section
- `resume any run`
- `autonomous memory`
