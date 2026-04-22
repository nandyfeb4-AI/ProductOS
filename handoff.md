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
- do not imply live web research, citations, monitored intelligence, or fresh user interviews unless the backend truly does that

## Active UI Task

Build the first UI for:

- `User Research`

This is the only active UI handoff right now.

## Backend Already Available

- `POST /api/agents/user-research`
- `POST /api/jobs/user-research`
- existing job polling / websocket pattern already used elsewhere in the app

Frontend helper already available at:

- `apps/web/src/api/agents.js`

Relevant functions:

- `runUserResearch(...)`
- `startUserResearchJob(...)`
- `getGenerationJob(...)`

## Current MVP Model

- this is a project-scoped, analysis-only agent
- it does not persist research entities yet
- it does not claim live research, browsing, or source-backed citations
- it synthesizes only:
  - provided research notes / snippets / summaries
  - provided target user
  - provided product context
  - optional goal / constraints / supporting context
- it automatically uses the active global `user_research` skill

## Request Shape

```json
{
  "project_id": "uuid",
  "source_type": "prompt",
  "product_name": "ProductOS",
  "product_summary": "AI-native product management platform for discovery, planning, backlog refinement, and delivery execution.",
  "target_user": "B2B SaaS product managers and product operations teams",
  "research_inputs": [
    "PMs spend too much time translating workshop notes into backlog-ready artifacts.",
    "Teams want AI help, but they still need review checkpoints before Jira updates happen.",
    "Current tools help with planning, but not with execution readiness."
  ],
  "research_goal": "Identify the strongest recurring pain points and opportunities in PM workflow operations.",
  "constraints": ["Do not assume live research or fresh interviews"],
  "supporting_context": ["Focus on discovery-to-delivery operations and execution readiness"]
}
```

Important:

- `research_inputs` is required
- keep this as provided-context user research synthesis
- do not invent external research inputs in UI

## Response Shape

```json
{
  "research_summary": "string",
  "user_segments": ["string"],
  "key_pain_points": ["string"],
  "unmet_needs": ["string"],
  "jobs_to_be_done": ["string"],
  "recommended_actions": ["string"],
  "risks_and_unknowns": ["string"],
  "results": [
    {
      "insight_title": "string",
      "insight_summary": "string",
      "evidence": ["string"],
      "implication": "string",
      "recommended_action": "string",
      "confidence_score": 4
    }
  ]
}
```

## What Claude Should Build

### 1. Add the agent to the project `Agents` tab

- add `User Research` as a selectable agent alongside the existing agents

### 2. Build a dedicated User Research page

Include a form for:

- product name
- product summary
- target user
- research inputs
- research goal
- optional constraints
- optional supporting context

Recommended UX:

- `research_inputs` can be a multiline list builder, chip input, or repeatable text blocks
- optimize for copying in interviews, notes, support themes, or workshop-derived user signals
- keep the form concise and synthesis-oriented
- frame the source as provided research context, not live research

### 3. Use the async job flow

- start with:
  - `startUserResearchJob(...)`
- use the existing websocket / polling pattern already used by other agents
- show:
  - queued
  - running
  - completed
  - failed

### 4. Result view

Show:

- research summary
- user segments
- key pain points
- unmet needs
- jobs to be done
- recommended actions
- risks and unknowns

Then show one card per insight with:

- insight title
- insight summary
- evidence
- implication
- recommended action
- confidence score

### 5. Skills page

Extend the `Skills` page to surface:

- `user_research`

Use the same pattern already used for the other global skills.

## Important UI Constraints

- do not present this as live user research or continuous user intelligence
- do not mention browsing, citations, or external validation in the UI unless the backend actually supports it
- do not create persistence flows, saved research records, or workflow orchestration in this first pass
- keep this as a standalone reusable agent page

## Good Default Framing

Use language like:

- `Synthesize provided research inputs into product insights`
- `Turn notes, interviews, and user signals into PM-ready findings`
- `Built from the research context you provide`

Avoid language like:

- `live user monitoring`
- `real-time research intelligence`
- `source-backed interviews`
