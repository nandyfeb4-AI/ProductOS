# ProductOS

Autonomous Product Management Platform MVP.

## Stack
- API app: FastAPI
- Web app: React + Vite
- Database platform: Supabase

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

### Web
```bash
cd apps/web
npm install
npm run dev
```
