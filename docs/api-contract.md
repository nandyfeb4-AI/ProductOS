# API Contract

Base URL: `http://localhost:8000`

All endpoints return JSON and are synchronous for the MVP.

## Endpoints

### `POST /api/workshop/analyze`
- Request: `{ "title": "string", "transcript": "string", "notes": "string | null" }`
- Response: `{ "workshop_id": "uuid", "insights": { "action_items": [], "decisions": [], "pain_points": [], "opportunities": [] } }`

### `POST /api/initiative/generate`
- Request: `{ "workshop_id": "uuid", "insights": { ... } }`
- Response: `{ "initiatives": [{ "title": "...", "description": "...", "problem_statement": "...", "priority": "high|medium|low" }] }`

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

## Errors
- FastAPI validation errors use standard HTTP `422`
- Runtime and application errors should return `{ "detail": "..." }`

