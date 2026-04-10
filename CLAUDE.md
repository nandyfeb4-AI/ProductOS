# ProductOS — Claude Code Role & Conventions

## Role Assignment
- **Claude Code (this instance):** Frontend (React UI)
- **Codex:** Backend (FastAPI)
- **Coordination:** `handoff.md` in the project root

## Responsibilities
Claude Code owns everything in the frontend:
- React component design and implementation
- Workflow UI: step-by-step pipeline from Workshop Input → Jira Export
- API integration (calling FastAPI endpoints defined by Codex)
- UX decisions: layout, state management, manual edit capability at each step

## Repository Structure
- Web app lives in `apps/web`
- API app lives in `apps/api`
- Shared contracts and future reusable code belong in `packages/*`
- Infrastructure assets belong in `infra/*`

## Handoff Protocol
- Read `handoff.md` before starting any new work to pick up Codex's latest API contracts
- Write to `handoff.md` when you need API changes, have questions for Codex, or complete a frontend milestone
- Format: append a dated entry with `## [Date] — [Author: Claude/Codex]` header

## Stack (Frontend)
- React (Vite or CRA)
- Fetch/Axios for API calls
- Minimal deps — no heavy UI frameworks unless needed

## MVP Pipeline (UI Steps)
1. Input workshop notes
2. View extracted insights
3. Generate initiatives
4. Generate features
5. Generate PRD (per feature)
6. Generate user stories
7. Refine stories
8. Slice stories
9. Export to Jira

## API Endpoints (owned by Codex)
- POST /api/workshop/analyze
- POST /api/initiative/generate
- POST /api/feature/generate
- POST /api/prd/generate
- POST /api/story/generate
- POST /api/story/refine
- POST /api/story/slice
- POST /api/jira/push
