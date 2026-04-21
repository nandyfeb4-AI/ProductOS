# Handoff — ProductOS

This file is the active source of truth for Claude Code UI work and Codex backend work.

If anything in older chat history conflicts with this file, this file wins.

## Global Product Rule

- fail fast, fail clearly
- do not fabricate fallback data for AI-driven workflow results
- if an agent, evaluator, or workflow step returns missing, malformed, or incomplete output:
  - stop the flow
  - surface a clear error message to the user
  - do not silently substitute placeholder scores, fake readiness, or synthetic refined content
- user decisions in ProductOS must be based on real validated output, not optimistic fallbacks

## Active Backlog Refinement Workflow Context

The next human-in-the-loop agentic workflow backend is now in place:

- `Backlog Refinement`

This is intentionally a workflow, not a standalone agent.

It uses:

- Jira backlog stories as the source of truth
- project team velocity / backlog target from the Team area
- routing logic that places work into execution buckets before the PM approves

### Backend Now Available

- workflow definition:
  - `workflow_type = backlog_refinement`
  - defaults to:
    - `workflow_definition_key = backlog_refinement`
    - `workflow_definition_label = Backlog Refinement`
- `GET /api/workflows/backlog-refinement/source?project_id={project_id}&project_key={jira_project_key}`
- `POST /api/workflows/backlog-refinement/analyze`
- `POST /api/workflows/backlog-refinement/execute`
- `POST /api/jobs/backlog-refinement-analysis`
- `POST /api/jobs/backlog-refinement-execution`

### Response Shape Notes

- `GET /api/workflows/backlog-refinement/source` returns:
  - `jira_project_key`
  - `features`
  - `stories`
  - `total_story_points`
- `POST /api/workflows/backlog-refinement/analyze` returns:
  - `workflow_id`
  - `jira_project_key`
  - `health`
  - top-level bucket arrays:
    - `generate`
    - `refine`
    - `slice`
    - `ready`
  - `summary`
- `GET /api/projects/{project_id}/team` returns:
  - `average_velocity_per_sprint`
  - `minimum_ready_backlog_target`
  - `team_members`

### Current MVP Model

- source system is Jira only for this first pass
- source items are:
  - Jira epics/features
  - Jira backlog stories/tasks
- story points are read from Jira and summed at the backlog level
- project velocity comes from:
  - `GET /api/projects/{project_id}/team`
- backlog target is:
  - `2 x average_velocity_per_sprint`
- this target is a minimum healthy backlog floor
- it is not a ceiling and does not block refinement when backlog points exceed it
- the workflow currently:
  1. reads prioritized Jira epics and backlog stories
  2. measures ready backlog points against target
  3. routes items into buckets:
     - `generate`
     - `refine`
     - `slice`
     - `ready`
  4. lets the PM approve the bucketed plan
- execution is now wired to actually mutate Jira backlog items:
   - `generate` creates new Jira stories under the selected feature/epic
   - `refine` updates the selected Jira story in place
   - `slice` rewrites the original Jira story as one smaller split story and creates new sibling Jira stories for the remaining split scope
- execution is intentionally processed one approved item at a time to avoid overwhelming the LLM or Jira

### Current Routing Rules

- feature with no stories:
  - `generate`
- feature with fewer than 3 linked stories:
  - `generate`
- story with missing story points:
  - `refine`
- story that fails the stronger `Story Refiner` quality evaluation:
  - `refine`
- story with story points greater than 8:
  - `slice`
- story with acceptable size and strong `Story Refiner` evaluation:
  - `ready`

Important routing note:

- backlog refinement now reuses the stronger `Story Refiner` evaluation path and active skill during analysis
- this means `Ready` should no longer be treated as a shallow structural pass
- stories are evaluated in small internal backend batches for reliability, but the UI should still present analysis as one continuous run
- do not surface internal batching mechanics to the user unless we later add explicit detailed job telemetry

### State Payload Keys

- `backlog_refinement_source`
- `backlog_refinement_analysis`
- `backlog_refinement_execution`

### What Claude Should Do Next

Build the first UI for the `Backlog Refinement` workflow.

Recommended first pass:

- add a new workflow definition card on the `Workflows` page:
  - `Backlog Refinement`
- create a dedicated workflow page/surface for it
- source step:
  - pick Jira project
  - load source data from:
    - `GET /api/workflows/backlog-refinement/source`
  - show:
    - source `total_story_points`
    - velocity from `GET /api/projects/{project_id}/team`
    - target ready backlog points from `GET /api/projects/{project_id}/team`
- analysis step:
  - use the async endpoint:
    - `POST /api/jobs/backlog-refinement-analysis`
  - restore/poll using the existing job websocket/polling pattern
- review step:
  - visualize routed work into buckets:
    - `Generate`
    - `Refine`
    - `Slice`
    - `Ready`
  - use the top-level arrays returned by the analyze response:
    - `generate`
    - `refine`
    - `slice`
    - `ready`
  - show backlog health summary:
    - ready points
    - target points
    - shortfall
- approval step:
  - allow the PM to approve which items should stay in each actionable bucket
  - submit approval using the async job endpoint:
    - `POST /api/jobs/backlog-refinement-execution`
  - do not keep execution as a long blocking synchronous page action
  - use the existing job websocket/polling pattern for execution progress and completion too

- done / results step:
  - show execution summary returned from the execute response:
    - `execution.created_story_count`
    - `execution.updated_story_count`
    - `execution.sliced_story_count`
  - show per-item execution results from:
    - `results`
  - for each result, show:
    - bucket
    - source issue key
    - status
    - created Jira issues
    - updated Jira issue
    - message

Important slice behavior note:

- custom slicing should now behave like a real split even without Jira's native split action
- when a story is sliced:
  - the original Jira story remains active
  - the original Jira story is updated to the first smaller split story
  - additional split stories are created as new sibling Jira stories
- UI language should not say the original story was replaced or merely marked as sliced
- for slice results, emphasize:
  - updated original story
  - newly created sibling stories

Important:

- keep this first pass explicitly human-in-the-loop
- the workflow now does execute the approved buckets after approval
- but keep the user approval gate before execution
- the main goal of this pass is:
  - inspect
  - route
  - visualize
  - approve
  - execute
- the bucket visualization should make routing legible and trustworthy

## Active Team Capacity Context

The next prerequisite backend foundation is now in place:

- `Project Team Capacity`

This is intentionally not an agent or workflow yet.

It exists to support future backlog-management workflows, especially:

- `Backlog Refinement`

### Backend Now Available

- `GET /api/projects/{project_id}`
  - now includes:
    - `average_velocity_per_sprint`
    - `team_member_count`
- `PATCH /api/projects/{project_id}`
  - now accepts:
    - `average_velocity_per_sprint`
- `GET /api/projects/{project_id}/team`

### Current MVP Model

- every project has a project-level average velocity
- default velocity is:
  - `24`
- every project now has a seeded cross-functional team of 9 members
- current team response includes:
  - `project_id`
  - `average_velocity_per_sprint`
  - `minimum_ready_backlog_target`
  - `team_members`
- backlog target is currently derived as:
  - `2 x average_velocity_per_sprint`

### Seeded Team Shape

- Product Manager
- Product Designer
- Frontend Engineer
- Backend Engineer
- Full Stack Engineer
- QA Engineer
- DevOps Engineer
- Data Analyst
- Tech Lead

### What Claude Should Do Next

Build the first real `Team` area instead of the current placeholder.

Recommended first pass:

- replace the current Team placeholder page with a real team-capacity page
- load the active project team from:
  - `GET /api/projects/{project_id}/team`
- show:
  - project team members
  - role / discipline
  - seniority
  - allocation
  - project average velocity
  - derived ready-backlog target
- allow editing project average velocity using:
  - `PATCH /api/projects/{project_id}`
- show the backlog target clearly as:
  - `Minimum ready backlog target = 2 x velocity`
- keep team members read-only for this first pass

Important:

- do not build full team-member CRUD yet
- do not infer velocity from member allocations yet
- do not turn this into sprint planning yet
- this is a prerequisite capacity layer for future `Backlog Refinement`

Frontend helper already available at:

- `apps/web/src/api/projects.js`

## Active Feature Prioritization Context

The next reusable agent backend is now in place:

- `Feature Prioritizer`

And the next reusable cross-project skill is now in place:

- `Feature Prioritization Skill`

### Backend Now Available

- `POST /api/agents/feature-prioritizer`
- `POST /api/jobs/feature-prioritization`
- `GET /api/project-features?project_id={project_id}`
- `GET /api/project-features/{feature_id}`
- `PATCH /api/project-features/{feature_id}`

### Current MVP Model

- `Feature Prioritizer` takes persisted project features as input
- request shape is:
  - `project_id`
  - `source_type = project_feature`
  - `feature_ids`
  - optional `prioritization_goal`
  - optional `constraints`
  - optional `supporting_context`
- it automatically uses the active global `feature_prioritization` skill
- it evaluates each selected feature using a prioritization framework
- it persists prioritization metadata back into `project_features.prioritization`
- it returns both:
  - updated persisted feature data
  - ranked prioritization assessment
  - per-item prioritization summary
  - overall prioritization summary

### What Claude Should Do Next

Build the first project-level Feature Prioritization UI using persisted project features as the source.

Recommended first pass:

- add `Feature Prioritizer` to the project `Agents` tab
- allow selection of one or more persisted project features
- show the active `Feature Prioritization Skill` in the prioritizer context
- extend the `Skills` page to surface `feature_prioritization` alongside the existing feature, story generation, story refinement, story slicing, and feature refinement skills
- make the result view show:
  - ranked features
  - framework
  - score breakdown
  - priority bucket
  - rationale / tradeoffs
  - recommendation
  - overall prioritization summary
- from the project `Features` surface, add a contextual action to send persisted features into `Feature Prioritizer`

Important:

- keep this v1 scoped to persisted `project_features`
- do not fake Jira/manual inputs in UI yet
- do not create net-new features from this agent
- do not treat this as a drag-and-drop Jira reorder tool
- backend contract supports one or many features, and the UI can start with multi-select if convenient
- frontend helper is already available at:
  - `apps/web/src/api/agents.js`
  - `apps/web/src/api/projectFeatures.js`

## Active Feature Hardening Workflow Context

The next human-in-the-loop agentic workflow backend is now in place:

- `Feature Hardening`

This is intentionally a workflow, not a standalone agent.

It uses:

- Jira epics as the source of truth
- `Feature Refiner` behavior under the hood for evaluation + hardening
- an explicit review step before syncing changes back to Jira

### Backend Now Available

- workflow definition:
  - `workflow_type = feature_hardening`
  - defaults to:
    - `workflow_definition_key = feature_hardening`
    - `workflow_definition_label = Feature Hardening`
- `GET /api/workflows/feature-hardening/source?project_key={jira_project_key}`
- `POST /api/workflows/feature-hardening/run`
- `POST /api/workflows/feature-hardening/publish`
- `POST /api/jobs/feature-hardening`
- existing generic workflow-run APIs still apply:
  - `POST /api/workflows`
  - `GET /api/workflows`
  - `PATCH /api/workflows/{workflow_id}`
  - `GET /api/workflows/{workflow_id}`

### Current MVP Model

- source system is Jira only for this first pass
- source items are existing Jira epics
- PM should not re-enter the feature manually
- workflow shape is:
  - choose Jira project
  - pull epics
  - select epics to harden
  - run AI hardening
  - review scores + refined feature output
  - publish approved changes back to Jira
- `Feature Hardening` stores workflow state in `workflow_runs.state_payload`
- current workflow state keys are:
  - `feature_hardening_source`
  - `feature_hardening_results`
  - `feature_hardening_publish`
- current step progression is:
  - `source`
  - `review`
  - `sync`

### Request Shapes

- source listing:
  - `GET /api/workflows/feature-hardening/source?project_key=ABC`

- hardening run:
  - `project_id`
  - optional `workflow_id`
  - `source_type = jira_project`
  - `jira_project_key`
  - `issue_keys`
  - optional `refinement_goal`
  - optional `constraints`
  - optional `supporting_context`

- publish:
  - `project_id`
  - optional `workflow_id`
  - `jira_project_key`
  - `results`
    - each item includes:
      - `issue_key`
      - `refined_feature`

### What Claude Should Do Next

Build the first UI for the new `Feature Hardening` workflow.

Recommended first pass:

- add a second workflow definition card on the `Workflows` page:
  - `Feature Hardening`
- keep `Discovery to Delivery` intact
- do not treat `Feature Hardening` as an agent page
- create a dedicated workflow UI surface/page for `Feature Hardening`
- starting the workflow should:
  - create a workflow run with:
    - `workflow_type = feature_hardening`
    - project-scoped `project_id`
  - then move into the workflow page
- in the source step:
  - let the PM pick a Jira project
  - load epics from:
    - `GET /api/workflows/feature-hardening/source`
  - allow selecting a subset for hardening
- for the hardening action:
  - use the async endpoint:
    - `POST /api/jobs/feature-hardening`
  - and existing job polling / websocket patterns
- in the review step, show:
  - original Jira epic
  - evaluation scores
  - needs-refinement signal
  - refinement summary
  - refined feature output
- in the publish step:
  - let the PM explicitly push approved hardened features back to Jira
  - use:
    - `POST /api/workflows/feature-hardening/publish`
- resuming a `Feature Hardening` run should restore from `state_payload`
- update workflow resume/navigation logic so it is no longer hardcoded only for the discovery pipeline

Important:

- this is still human-in-the-loop
- do not auto-publish to Jira
- do not ask the PM to retype feature input
- do not invent non-Jira sources yet
- do not fold this into the `Agents` tab
- use the workflow framing:
  - workflow = orchestrated PM routine
  - agent = standalone reusable capability

Frontend helper already available at:

- `apps/web/src/api/workflows.js`

## Active Workflow Definitions Context

Workflow executions now have an explicit relationship to the agentic workflow they belong to.

This is the first step toward making the `Workflows` surface show named workflow types such as `Discovery to Delivery` instead of only generic workshop runs.

### Backend Now Available

- `workflow_runs` now stores:
  - `workflow_definition_key`
  - `workflow_definition_label`
- `POST /api/workflows`
  - accepts optional:
    - `workflow_definition_key`
    - `workflow_definition_label`
- `PATCH /api/workflows/{workflow_id}`
  - accepts optional:
    - `workflow_definition_key`
    - `workflow_definition_label`
- `GET /api/workflows`
  - supports optional:
    - `workflow_definition_key`

### Current MVP Model

- the existing workshop-led end-to-end flow is the first named agentic workflow:
  - `workflow_definition_key = discovery_to_delivery`
  - `workflow_definition_label = Discovery to Delivery`
- new workshop workflow runs now default to that workflow definition
- existing persisted workshop workflow runs are backfilled to that same definition
- `workflow_type` still exists and remains `workshop`
- think of the model as:
  - `workflow_type`
    - low-level technical run family
  - `workflow_definition_key`
    - product-level workflow template / agentic workflow identity

### What Claude Should Do Next

Rework the UI so the `Workflows` surface reflects workflow definitions, not just flat run records.

Recommended first pass:

- keep `Workflows` as the left-nav / project-nav label
- inside the page, introduce workflow definition cards or sections
- the first workflow definition should be:
  - `Discovery to Delivery`
- group or frame the current workshop runs under that workflow definition
- stop presenting the current workflow as a generic unnamed workflow
- on workflow cards/lists, use:
  - `workflow_definition_label`
  - not just `workflow_type`
- when loading workflow runs for the current workshop flow, filter by:
  - `workflow_definition_key = discovery_to_delivery`
- update any “new workflow” or “resume workflow” copy so it refers to:
  - `Discovery to Delivery`
  - not a generic workflow name

Important:

- do not invent additional workflow definitions in UI yet
- do not remove the existing run-history behavior
- this pass is mostly an information architecture / labeling improvement backed by the new workflow-definition fields
- frontend helper already supports the new filter in:
  - `apps/web/src/api/workflows.js`

## Active Generated Features Context

Generated features are now first-class persisted project assets.

Important distinction:

- a feature generator page result is no longer just page/session state
- each successful `Feature Generator` run now saves a row into the project feature store
- Jira export for generated features updates that same persisted row with Jira sync metadata

### Backend Now Available

- `GET /api/project-features?project_id={project_id}`
- `GET /api/project-features/{feature_id}`
- `PATCH /api/project-features/{feature_id}`
- `POST /api/jira/export-feature`

### Current Behavior

- `POST /api/jobs/feature-generation` still generates the feature asynchronously
- when the job completes, the feature is persisted in DB automatically
- returned `feature.feature_id` is now the persisted project feature UUID
- `Project.feature_count` and dashboard `features` counts now include persisted project features
- pushing a generated feature to Jira updates:
  - `status = exported`
  - `jira_issue_key`
  - `jira_issue_url`
  - `jira_issue_type`

### What Claude Should Do Next

Build the UI for persisted generated features under project context instead of treating the Feature Generator result as a transient one-off page.

Recommended first pass:

- add a real `Features` surface inside project context
- show persisted features from `GET /api/project-features?project_id=...`
- each feature card/list row should show:
  - title
  - summary
  - status
  - source type
  - skill name
  - updated time
  - Jira issue key if exported
- keep the existing Feature Generator page for creation
- after generation, users should be able to return to a project-level feature list/history and reopen a generated feature
- do not rely on `sessionStorage` as the main history mechanism anymore
- frontend helper is already available at:
  - `apps/web/src/api/projectFeatures.js`

## Active Story Generator Context

The next reusable agent backend is now in place:

- `Story Generator`

And the next reusable cross-project skill is now in place:

- `Story Spec Skill`

### Backend Now Available

- `POST /api/agents/story-generator`
- `POST /api/jobs/story-generation`
- `GET /api/project-stories?project_id={project_id}`
- `GET /api/project-stories?project_id={project_id}&source_feature_id={feature_id}`
- `GET /api/project-stories/{story_id}`
- `PATCH /api/project-stories/{story_id}`

### Current MVP Model

- `Story Generator` takes a persisted project feature as input
- request shape is:
  - `project_id`
  - `source_type = feature`
  - `source_feature_id`
  - optional `story_count_hint`
  - optional `constraints`
  - optional `supporting_context`
- it automatically uses the active global `story_spec` skill
- each successful run persists stories into the project story store

### What Claude Should Do Next

Build the first project-level Story Generator UI using the persisted feature list as the source.

Recommended first pass:

- add `Story Generator` to the project `Agents` tab
- allow the user to choose a persisted feature as the source input
- show the active `Story Spec Skill` in project/agent context just like Feature Generator does for the Feature Spec Skill
- after generation, present the generated stories clearly and let the user return to project context
- add a project-level stories surface later if needed, but first make the generator flow usable from project features
- frontend helper is already available at:
  - `apps/web/src/api/projectStories.js`

Important:

- keep the story shape aligned with the existing workflow story structure
- do not introduce a second story format
- `Story Refiner` and `Story Slicer` should be able to build on these persisted project stories later

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
