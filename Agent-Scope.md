# Agent Scope

## Purpose

This document defines the first planned set of reusable ProductOS agents.

Important distinction:
- The existing `Workshop -> Validation -> Shaping -> Artifacts -> Stories -> Jira` flow remains a guided workflow.
- The agents in this document are independent reusable task agents.
- They should be callable from UI directly and, later, from external events such as Jira status changes.

Product principle:
- `ProductOS` is the intelligence and transformation layer.
- `Jira` remains the system of record for delivery work.
- Later, `Confluence` or a similar tool can remain the system of record for docs if needed.

## Agent Model

Each agent should be defined by:
- `Purpose`: what problem it solves
- `Inputs`: what object(s) it accepts
- `Outputs`: what it creates or updates
- `Mode`: single-item, bulk, or both
- `Trigger`: manual now, contextual later, event-based later
- `Review`: whether human approval is required before sync

## Planned V1 Agents

### 1. Feature Generator

- Purpose: turn an opportunity, requirement, or prompt into a structured feature or epic draft
- Inputs:
  - approved opportunity
  - manual requirement
  - project context
- Outputs:
  - feature draft
- Mode:
  - single
- Trigger:
  - manual
- Review:
  - yes
- Notes:
  - This is the main reusable entry point for creating new features outside the workshop flow.

#### Initial Contract

Request:

```json
{
  "project_id": "uuid",
  "source_type": "prompt|opportunity|requirement",
  "source_title": "Frequent riders abandon booking at destination entry",
  "source_summary": "Riders struggle to enter destinations quickly during booking.",
  "source_details": "Optional longer problem statement or copied requirement context.",
  "desired_outcome": "Generate a PM-ready feature draft that can later be reviewed or sent into story generation.",
  "constraints": ["Must work for both saved and recent destinations"],
  "supporting_context": ["Observed in rider research", "Higher impact on frequent commuters"]
}
```

Response:

```json
{
  "feature": {
    "feature_id": "feature_agent_1",
    "status": "draft",
    "title": "Smart Destination Suggestions",
    "summary": "Surface relevant destination suggestions during booking.",
    "body": {
      "problem_statement": "...",
      "user_segment": "...",
      "proposed_solution": "...",
      "user_value": "...",
      "business_value": "...",
      "functional_requirements": ["..."],
      "non_functional_requirements": ["..."],
      "dependencies": ["..."],
      "success_metrics": ["..."],
      "priority": "high|medium|low"
    }
  }
}
```

Async job support also exists for this agent so the UI can follow the same long-running pattern as the workshop AI flow.

### 2. Feature Refiner

- Purpose: improve and strengthen an existing feature or epic
- Inputs:
  - persisted project feature
  - later Jira epic
  - later manual feature input
- Outputs:
  - refined feature
- Mode:
  - single initially
  - bulk supported by backend contract
- Trigger:
  - manual initially
  - event-based later
- Review:
  - yes
- Notes:
  - This should improve scope, requirements, dependencies, and success metrics.

#### Initial Contract

Request:

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

Response:

```json
{
  "results": [
    {
      "feature": {
        "id": "uuid",
        "project_id": "uuid",
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

Important v1 scope:
- start with persisted `project_features`
- refine the same feature, do not create a new one
- backend contract supports one or many features
- UI can start with single-select

### 3. Story Generator

- Purpose: generate delivery-ready stories from a feature
- Inputs:
  - feature
  - later possibly requirement or synced Jira epic
- Outputs:
  - story set
- Mode:
  - single feature -> multiple stories
- Trigger:
  - manual
- Review:
  - yes
- Notes:
  - This is the reusable form of story generation outside the guided workshop pipeline.

#### Story Generation Scaling Strategy

Story generation should remain bounded per run, even when the UI is async.

Important principle:
- async execution improves waiting and responsiveness
- it does not remove model context limits or output-token limits

Recommended operating model:
- use `Story Generator` for a single feature at a time
- generate an initial bounded batch of stories
- default expectation should be roughly `3 to 5` meaningful stories for a normal feature
- practical single-run ceiling should stay conservative, around `8` stories, unless the story shape becomes much smaller

Why not allow unlimited single-run generation:
- larger story batches increase the risk of truncated or malformed structured output
- acceptance criteria, edge cases, and dependencies become weaker as output size grows
- the model may over-decompose one feature into artificial or noisy stories
- large strict-JSON outputs become more variable and less reliable

Future-safe expansion model:
- do not solve “more stories needed” by allowing very large one-shot generation
- instead, support iterative bounded generation passes

Preferred later flow:
1. generate an initial story set
2. let the PM review it
3. allow follow-up generation such as:
   - `Generate More Stories`
   - `Generate Technical Stories`
   - `Generate Edge-Case Stories`
   - `Generate Rollout / Ops Stories`
   - `Generate Missing Coverage`

Later implementation direction:
- persist each story-generation run with lineage to the source feature
- include already-generated stories as context in future runs
- instruct the model to avoid duplicates and generate only missing or complementary stories

Product stance:
- single-run story generation should stay quality-first and bounded
- broader decomposition should happen through iterative expansion, not one oversized generation request

### 4. Story Refiner

- Purpose: improve one or more stories
- Inputs:
  - persisted project story
  - persisted project story set
  - later: Jira stories pulled into ProductOS
  - later: manual story input
- Outputs:
  - evaluated story or story set
  - refined story or refined story set
- Mode:
  - single
  - bulk
- Trigger:
  - manual initially
  - Jira status/event later
- Review:
  - yes
- Notes:
  - This agent includes:
    - tightening scope
    - improving wording
    - improving acceptance criteria
    - identifying dependencies
    - surfacing edge cases
  - It should evaluate quality first and then refine based on the gaps.

#### Initial Contract

Request:

```json
{
  "project_id": "uuid",
  "source_type": "project_story",
  "story_ids": ["uuid", "uuid"],
  "refinement_goal": "Make these stories sprint-ready for engineering grooming.",
  "constraints": ["Do not change the original user intent"],
  "supporting_context": ["This feature ships behind a flag"]
}
```

Response:

```json
{
  "results": [
    {
      "story": {
        "id": "uuid",
        "project_id": "uuid",
        "title": "string",
        "description": "string"
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

Important v1 scope:
- start with persisted `project_stories`
- support both single-story and bulk refinement
- do not create net-new stories in this agent
- do not silently push to Jira

### 5. Story Slicer

- Purpose: split a large story or set of stories into smaller implementable stories
- Inputs:
  - story
  - later story set
- Outputs:
  - smaller stories
- Mode:
  - single initially
  - bulk later
- Trigger:
  - manual initially
  - Jira status/event later
- Review:
  - yes
- Notes:
  - This is different from re-slicing an entire feature.
  - It focuses on decomposition of selected stories.

#### Initial Contract

Request:

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

Response:

```json
{
  "source_story": {
    "id": "uuid",
    "project_id": "uuid",
    "title": "Original story",
    "status": "sliced"
  },
  "stories": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "source_story_id": "uuid",
      "title": "Child story 1",
      "description": "string"
    }
  ],
  "slicing_summary": "Split the original story into smaller implementation-ready child stories."
}
```

Important v1 scope:
- start with one persisted `project_story`
- persist sliced child stories into `project_stories`
- link each child story back to the original via `source_story_id`
- keep the original story available and mark it as `sliced`
- do not auto-delete or auto-sync anything

### 6. Prioritization Agent

- Purpose: rank persisted project features and explain the rationale
- Inputs:
  - feature set
  - project context
- Outputs:
  - prioritized list
  - rationale
- Mode:
  - bulk
- Trigger:
  - manual
- Review:
  - yes
- Notes:
  - Start as a feature-only agent, not a story prioritization agent.
  - Default framework should be Impact vs Effort, expressed through a reusable skill.
  - This should not silently reorder Jira.
  - It should generate recommendations first and persist them onto the feature records.

### 7. Roadmap Planner

- Purpose: propose sequencing and roadmap grouping for approved features
- Inputs:
  - prioritized features
  - project context
- Outputs:
  - roadmap proposal
- Mode:
  - bulk
- Trigger:
  - manual
- Review:
  - yes
- Notes:
  - Later this can integrate with Jira Product Discovery or Jira if roadmap sync is desired.

### 8. Backlog Cleanup Agent

- Purpose: identify stale, duplicate, weak, oversized, or incomplete backlog items
- Inputs:
  - Jira backlog
  - ProductOS project context
- Outputs:
  - cleanup recommendations
- Mode:
  - bulk
- Trigger:
  - manual initially
  - event/rule-based later
- Review:
  - yes
- Notes:
  - This is useful later, but not required for the first agent implementation pass.

## Agents Not Prioritized For V1

The following are intentionally not separate v1 agents:

### Acceptance Criteria Generator

Not separate because:
- this belongs inside `Story Refiner`

### PRD Generator

Not a v1 priority because:
- current operating model is centered around strong feature/epic definition plus stories in Jira
- dedicated PRD generation may be useful later, but is not core to the initial agent system

### PRD Refiner

Not a v1 priority for the same reason as above.

## Trigger Types

### Manual Trigger

The user explicitly selects:
- project
- object(s)
- agent

This should be the first supported trigger mode for all v1 agents.

### Contextual Trigger

The user triggers an agent from within a relevant UI surface, for example:
- feature detail
- story detail
- project backlog view
- workflow result page

This should come after manual trigger support is stable.

### Event Trigger

The system triggers an agent from an external event or internal rule, for example:
- Jira status changes
- stale backlog conditions
- oversized story detection
- missing acceptance criteria

This is a later-stage capability and should not be built before the manual versions are reliable.

## Recommended MVP Build Order

1. Feature Generator
2. Feature Refiner
3. Story Generator
4. Story Refiner
5. Story Slicer
6. Prioritization Agent
7. Roadmap Planner

## UI Direction

The current workflow remains as a guided path.

In parallel, ProductOS should later gain an `Agents` area where users can:
- choose a project
- choose one or more objects
- choose an agent
- review output
- optionally sync approved results to Jira

This means:
- workflows remain guided and end-to-end
- agents remain reusable and focused

## Future Orchestration

Once the reusable agents are stable, ProductOS can later introduce a higher-level orchestration layer, likely a `PM Agent`, that:
- observes project/work item state
- decides what needs attention
- routes relevant items to the correct agents
- proposes next steps

This orchestration layer should come after the individual agents are implemented and trusted.

### Working Architecture Direction

The likely shape of the system is:
- `Task Agents`
  - focused reusable capabilities such as `Feature Generator`, `Story Generator`, `Story Refiner`, and `Story Slicer`
- `PM Workflows`
  - recurring multi-step PM routines such as backlog refinement, feature-to-delivery handoff, release preparation, and roadmap planning
- `PM Orchestrator`
  - a higher-level coordinating agent that identifies which PM workflow applies and sequences the relevant task agents

Example later workflow:
- `Backlog Refinement Workflow`
  - assess a selected backlog set
  - run `Story Refiner` where quality is weak
  - run `Story Slicer` where stories are too large
  - return a cleaned review set
  - later sync approved changes back to Jira

Important caveat:
- this is a directional architecture note, not a locked implementation plan
- it must be revisited after a few more agents are built and used
- we should validate the actual PM usage patterns before hardening this into a formal orchestration system
