# Production Hardening

This document captures the production hardening work we should prioritize as ProductOS moves from internal experimentation to customer-facing workflows.

The goal is simple:

- keep AI-driven workflows trustworthy
- protect user decisions from incorrect or fabricated data
- reduce instability before it reaches customers
- make failures contained, recoverable, and observable

## Core Rule

- fail fast, fail clearly
- do not fabricate fallback data for AI-driven workflow results
- do not silently substitute placeholder scores, fake readiness, or synthetic refined content
- if an agent or workflow step returns missing, malformed, or incomplete output:
  - stop the affected step
  - surface a clear error
  - preserve state so the run can be retried or resumed safely

## Reliability Principles

### 1. Keep steps small and bounded

- prefer one item at a time or very small backend batches for LLM-backed evaluation/refinement
- impose strict payload-size limits
- avoid large multi-item structured outputs when the result must be complete and trustworthy
- keep prompts scoped to a single decision whenever possible

### 2. Treat LLMs as unreliable upstreams

- every LLM call should be assumed to be capable of:
  - timing out
  - returning malformed JSON
  - omitting requested items
  - returning semantically incomplete output
- design orchestration around this assumption instead of around ideal behavior

### 3. Prefer async jobs over long blocking requests

- expensive analysis and execution should use queued async jobs
- jobs should emit progress and store checkpoints
- frontend should poll or subscribe to progress instead of waiting on a single long request

### 4. Persist checkpoints everywhere

At minimum, each workflow should persist:

- source snapshot
- analysis result
- approved plan
- per-item execution progress
- completion summary
- failure message and failing item

This allows:

- retry from failure point
- auditability
- support/debugging
- safe resume flows

### 5. Validate outputs deterministically

LLM output should always pass through:

- schema validation
- completeness validation
- domain-rule validation
- business guardrails

Examples:

- every requested story must have a returned result
- story points must be one of the allowed values
- required sections must be present
- issue keys referenced in execution must exist in the source snapshot

### 6. Fail safely, not vaguely

User-facing states should clearly distinguish:

- running
- retrying
- partial progress
- needs attention
- failed
- completed

Avoid ambiguous states like:

- empty UI with no explanation
- optimistic success banner after partial failure
- fabricated “ready” or “refined” outputs when the model did not actually return them

### 7. Design for resumability

If a workflow processes multiple items:

- one failed item should not force full rework of already completed items
- completed items should stay completed
- failed items should be retryable
- the system should know exactly which step and item failed

### 8. Make observability a first-class requirement

Track at least:

- workflow success rate
- per-agent success rate
- average latency per step
- malformed output rate
- omitted-item rate
- retry count
- upstream Jira/API failure rate
- job failure reasons by type

Add alerts for:

- sudden spike in malformed output
- high job failure rate
- degraded Jira dependency health
- unusually slow workflow execution

## Workflow Hardening Priorities

### Backlog Refinement

This workflow is especially sensitive because PMs may act on its routing decisions.

Hardening priorities:

- keep story evaluation in very small internal batches
- persist per-story analysis progress
- make execution retryable per bucket item
- preserve source snapshot for reproducibility
- block execution when analysis output is incomplete or invalid
- surface exact failure messages in UI

### Feature Hardening

Hardening priorities:

- process Jira epics individually or in very small batches
- persist hardening results before publish
- make publish idempotent
- distinguish clearly between “analyzed”, “reviewed”, and “published”

### Story Refiner / Story Slicer / Story Generator

Hardening priorities:

- strict validation of returned structure
- reject incomplete results
- preserve original source before mutation
- ensure update/publish operations are idempotent

## Recommended Production Patterns

### A. Internal batching, single-run UX

- backend may batch items internally for reliability
- UI should still present one continuous workflow run
- progress can be coarse:
  - `Analyzing 2 of 5 stories`
- internal batching should not leak as a confusing product concept

### B. Per-item retries

- retries should happen at the smallest safe unit
- for backlog refinement, that usually means:
  - one story
  - one feature
  - one Jira publish/update action

### C. Idempotent execution

Any execution step that mutates external systems should be retry-safe.

Examples:

- creating Jira stories should avoid duplicates on retry
- updating a Jira story should be safe to rerun
- publish steps should be resumable after interruption

### D. Circuit breakers and rate limiting

- do not keep hammering unstable dependencies
- pause or degrade gracefully when:
  - Jira is failing
  - OpenAI responses are repeatedly malformed
  - latency crosses safety thresholds

### E. Explicit retry vs explicit human attention

Not every failure should auto-retry.

Good candidates for automatic retry:

- transient network failure
- temporary upstream disconnect
- timeout on a single item

Better candidates for human attention:

- repeated malformed LLM output
- schema-valid but business-invalid output
- missing critical source data

## Near-Term Hardening Checklist

These are the highest-value next steps:

- add transient retry handling for Jira network disconnects
- persist per-item progress in backlog refinement execution
- add clear UI failure states for backlog refinement analysis/execution
- add metrics/logging for omitted-item and malformed-output failures
- review other agent services for optimistic fallback behavior and remove it
- add retry-safe execution semantics for Jira updates/creates where needed
- reduce any remaining large structured multi-item LLM requests

## Medium-Term Hardening Checklist

- introduce circuit breaker behavior for unstable upstream dependencies
- add resumable workflow execution at the per-item level
- add admin/debug visibility into workflow failures
- add automated alerts for failure spikes
- add structured reliability dashboards per workflow

## Product Positioning Reminder

ProductOS should not be framed as:

- “sometimes unstable because AI is unpredictable”

It should be designed and presented as:

- reliable orchestration around probabilistic AI components

The customer-facing system must be:

- deterministic in workflow control
- explicit about failures
- recoverable when something goes wrong
- trustworthy enough for PM decision support

## Caveat

This document is a future hardening plan, not a promise that all items are already implemented.

We should revisit and reprioritize this list as:

- more workflows are added
- real production traffic reveals bottlenecks
- external integrations expand beyond Jira
