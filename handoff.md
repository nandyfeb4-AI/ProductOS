# Handoff — ProductOS

This file is the active source of truth for Claude Code UI work and Codex backend work.

If anything in older chat history conflicts with this file, this file wins.

## Active Skill + Agent Context

The first reusable agent is now shipped:

- `Feature Generator`

And the first reusable cross-project skill is now shipped:

- `Feature Spec Skill`

Important distinction:

- workflow = guided multi-step path
- agent = reusable focused task that can be run independently
- skill = reusable cross-project behavior definition that shapes how an agent or workflow writes output

### Current Shipped State

- global left-nav `Skills` page exists
- active `Feature Spec Skill` is editable in UI
- `Feature Generator` automatically uses the active `feature_spec` skill
- workflow `feature` artifact generation also automatically uses the active `feature_spec` skill
- project `Agents` tab shows the active feature spec skill in project context
- `Feature Generator` page shows which skill it is using

### Backend Available

- `POST /api/agents/feature-generator`
- `POST /api/jobs/feature-generation`
- `GET /api/jobs/{job_id}`
- `WS /api/jobs/ws/{job_id}`
- `POST /api/skills`
- `GET /api/skills`
- `GET /api/skills/{skill_id}`
- `PATCH /api/skills/{skill_id}`

### Current Product Rule

- skills are global and reusable across all projects
- the currently active `feature_spec` skill is the one that shapes feature writing everywhere
- project context should surface which skill is in effect, even though selection is currently global

### What Claude Should Do Next

If more UI work is needed around this area, build on top of the current model instead of reworking it:

- keep `Skills` as a left-nav global surface
- keep `Feature Spec Skill` as the first editable skill
- do not rename `Skills` back to templates
- future feature-related agents should reuse the same `feature_spec` skill pattern
- future story-related agents should likely introduce a parallel `story_spec` or `story_slicing` skill instead of hardcoding prompt structure

## Active Product Direction

ProductOS is moving from a `Workshop-first` app to a `Project-first` app.

The intended hierarchy is:

- `Dashboard`
- `Projects`
- inside a `Project`
  - `Overview`
  - `Workshops`
  - `Workflows`
  - `Agents`
  - `Backlog`
  - `Roadmap`
  - `Delivery`

Important product principle:

- ProductOS is the orchestration and AI execution layer.
- It should help PMs generate, refine, slice, compare, and approve work.
- It should not become a second permanent system of record for docs and stories.
- Final docs should sync to Confluence later.
- Final delivery work should sync to Jira.

## What Is Already Shipped

### Backend

- async job foundation for long-running AI steps
  - opportunity synthesis
  - solution shaping
  - artifact generation
  - story slicing
- websocket job updates
- connector persistence
  - Mural
  - Jira
- workflow run persistence
- Jira OAuth, token refresh, project discovery, and export
- dashboard summary endpoint backed by persisted workflow data

### Frontend

- current workshop pipeline flow:
  - Workshop
  - Validation
  - Shaping
  - Artifacts
  - Stories
  - Jira
- global `Connectors` page
- `Workflow List` page
- persisted workflow resume/view flow
- actual dashboard top-level counts are now backed by API data instead of hardcoded demo numbers

## Newly Shipped Backend Foundation For Project-First Redesign

These APIs are now live and are the current foundation Claude should build against.

### Projects

- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/{project_id}`
- `PATCH /api/projects/{project_id}`

Project response shape:

- `id`
- `name`
- `slug`
- `description`
- `status`
- `workshop_count`
- `workflow_count`
- `active_workflow_count`
- `feature_count`
- `initiative_count`
- `story_count`
- `created_at`
- `updated_at`

Notes:

- counts are currently derived from project-scoped workflow payloads
- there is still not yet a separate normalized `artifacts` or `stories` table
- workshops are now first-class

### Workshops

Workshops are now a first-class entity.

- `POST /api/workshops`
- `GET /api/workshops`
- `GET /api/workshops/{workshop_id}`
- `PATCH /api/workshops/{workshop_id}`

Workshop response shape includes:

- `id`
- `project_id`
- `title`
- `status`
- source metadata
- `transcript`
- `notes`
- `source_payload`
- `insights_payload`
- `journey_payload`
- `import_meta`
- `current_workflow_id`
- `latest_workflow_step`
- `latest_workflow_status`
- `workflow_count`
- `created_at`
- `updated_at`

Intended model now:

- `Project`
  - has many `Workshops`
- `Workshop`
  - has many `Workflow Runs`
- `Workflow Run`
  - belongs to both `project_id` and `workshop_id`

### Workflow Runs

Workflow runs now support both project scoping and workshop scoping.

- `POST /api/workflows`
- `GET /api/workflows`
- `GET /api/workflows/{workflow_id}`
- `PATCH /api/workflows/{workflow_id}`

New workflow field:

- `project_id`
- `workshop_id`

New query support:

- `GET /api/workflows?workflow_type=workshop&project_id={project_id}`
- `GET /api/workflows?workflow_type=workshop&project_id={project_id}&workshop_id={workshop_id}`

Meaning:

- a workflow can now belong to a project
- a workflow can now also belong to a specific workshop
- workshop flows should be created under a selected project and workshop in the redesigned UI

### Database

New migration added:

- `infra/supabase/migrations/20260415_004_projects.sql`

It adds:

- `projects` table
- `workflow_runs.project_id`

## Current UI Work Claude Should Do Next

This is the active UI target now.

### 1. Replace Placeholder `Projects` view with a real Projects experience

Build a real `Projects` page instead of the placeholder in `App.jsx`.

Minimum first pass:

- page title and summary
- list of projects from `GET /api/projects`
- create project CTA
- empty state when no projects exist
- project cards should show:
  - name
  - description
  - status
  - workshop count
  - workflow count
  - feature count
  - story count
  - last updated

### 2. Introduce a Project detail shell

When a user opens a project, that project becomes the context for downstream actions.

Recommended first-pass project detail navigation:

- `Overview`
- `Workshops`
- `Workflows`
- `Backlog`
- `Roadmap`

It is okay for some tabs to remain placeholder sections in this first pass, but the shell should exist.

### 3. Move Workshop creation under Project context

The current `Workshop` entry should no longer behave like the top-level default creation path.

Instead:

- user creates or opens a project first
- inside that project they can create a workshop record first
- then start or resume workflow runs under that workshop

For the first pass, that means:

- when starting a new workshop from project context:
  - call `POST /api/workshops`
  - then call `POST /api/workflows` with both `project_id` and `workshop_id`
- keep the existing workshop pipeline screens, but scoped to the chosen project/workshop
- save the new workshop id somewhere durable in the current UI session just like the current workflow id

### 4. Replace the current "workflows as workshops" behavior in project detail

The project detail page currently uses workflow runs as the visible workshop list.

That should now change:

- `Project > Workflows` should become `Project > Workshops`
- the list should come from `GET /api/workshops?project_id=...`
- each workshop card should show:
  - title
  - status
  - source provider/resource
  - latest workflow step/status
  - workflow count
  - last updated
- opening a workshop can either:
  - resume its latest workflow
  - or route to a workshop-specific detail view later

For this pass, it is okay if opening a workshop simply resumes the latest workflow when one exists.

### 5. Make Workflow List aware of workshop context too

Update the `Workflow List` page so it can work in two modes:

- global mode
- project-scoped mode
- workshop-scoped mode when needed

When opened inside a project:

- load workflows with `project_id`
- show only that project’s workflows

When opened for a specific workshop later:

- load workflows with `project_id` + `workshop_id`
- show the runs for that workshop

### 6. Keep current pipeline behavior stable

Do not break the already-working pipeline while doing the redesign.

Important:

- current async job flow stays as-is
- current Jira export flow stays as-is
- current connectors behavior stays as-is

The redesign should reorganize entry/navigation/context first, not re-implement the generation pipeline.

## Design Guidance For Claude

- The new UI should feel project-centered, not workshop-centered.
- Workshop becomes a first-class discovery object inside a project.
- Projects should feel like the durable home for work.
- Workflow runs should feel like the execution history of a workshop, not the workshop itself.
- Do not create permanent separate “Docs” and “Stories” internal silos as primary nav destinations.
- ProductOS should feel like an operating layer that prepares and syncs work outward.

## Near-Term Product Direction After This UI Pass

These are not necessarily for the immediate next Claude pass, but they should inform design decisions now.

- add reusable `Agents` as a first-class surface
  - Story Generator
  - Story Slicer
  - Refinement Agent
  - PRD Agent
- those agents should run in project context
- later, allow agents to operate on synced Jira items, not only pre-export ProductOS drafts
- likely future model:
  - Jira remains source of truth for stories after sync
  - ProductOS can pull a Jira story, refine or split it, then push updates/new stories back

## Notes For Codex

- backend project foundation is already in place
- if Claude needs more backend support next, likely follow-ups are:
  - project-scoped dashboard summaries
  - project detail aggregate endpoint if UI needs richer summary data
  - eventually separate `workshops` table if we want workshops and workflow runs to diverge cleanly

## Historical Context

Older UI/backend changes were completed around:

- async AI jobs
- connectors hub
- workflow run persistence
- Jira export hardening
- dashboard actual counts

Those are now considered stable foundations, not the current redesign target.
