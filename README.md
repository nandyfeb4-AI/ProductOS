# ProductOS

Autonomous Product Management Platform MVP.

## Stack
- API app: FastAPI
- Web app: React + Vite
- Database platform: Supabase
- Visual connector pilot: Mural OAuth + mural import

## Repository Structure
- `apps/api/`: runtime API application for the PM workflow pipeline
- `apps/web/`: runtime web application for the MVP workflow UI
- `packages/contracts/`: shared API and integration contracts
- `packages/domain/`: shared business-domain concepts and reusable logic
- `infra/supabase/`: Supabase project assets, migrations, and schema planning
- `docs/`: architecture and technical documentation

## Why This Layout
This repository is organized as a platform monorepo, not a prototype split. Deployable applications, shared contracts, domain logic, and infrastructure each get their own boundary so we can add workers, agents, and more surfaces later without another repo restructure.

## MVP Flow
`workshop -> initiative -> feature -> prd -> story -> refine -> slice -> jira`

## Quick Start

### API
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

Set these Mural variables in the repo root `.env` before testing the connector:
```bash
MURAL_CLIENT_ID=...
MURAL_CLIENT_SECRET=...
MURAL_REDIRECT_URI=http://localhost:8001/api/connectors/mural/callback
MURAL_SCOPES="identity:read workspaces:read rooms:read murals:read"
FRONTEND_APP_URL=http://localhost:5173
```

For Supabase-backed connector persistence, also set:
```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_DB_URL=postgresql://...
```

Apply the SQL in `infra/supabase/migrations/20260412_001_connector_persistence.sql` to create the connector tables.

### Web
```bash
cd apps/web
npm install
npm run dev
```
