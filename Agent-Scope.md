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
  - feature
- Outputs:
  - refined feature
- Mode:
  - single initially
  - bulk later
- Trigger:
  - manual initially
  - event-based later
- Review:
  - yes
- Notes:
  - This should improve scope, requirements, dependencies, and success metrics.

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

### 4. Story Refiner

- Purpose: improve one or more stories
- Inputs:
  - story
  - story set
- Outputs:
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

### 5. Story Slicer

- Purpose: split a large story or set of stories into smaller implementable stories
- Inputs:
  - story
  - story set
- Outputs:
  - smaller stories
- Mode:
  - single
  - bulk
- Trigger:
  - manual initially
  - Jira status/event later
- Review:
  - yes
- Notes:
  - This is different from re-slicing an entire feature.
  - It focuses on decomposition of selected stories.

### 6. Prioritization Agent

- Purpose: rank features or stories and explain the rationale
- Inputs:
  - feature set
  - story set
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
  - This should not silently reorder Jira.
  - It should generate recommendations first.

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
