# Architecture Overview

## Monorepo Boundaries
- `apps/api`: ProductOS API application
- `apps/web`: ProductOS web application
- `packages/contracts`: shared request/response and integration contracts
- `packages/domain`: shared business-domain abstractions and reusable logic
- `infra/supabase`: database and platform infrastructure assets

## Current MVP Flow
`workshop -> insights -> initiatives -> features -> prd -> stories -> refine -> slice -> jira`

## Why This Is More Enterprise-Ready
- Separates deployable applications from shared code and infrastructure
- Leaves room for future workers, agents, and additional product surfaces
- Avoids coupling UI code, API implementation, and data concerns into one layer
- Gives Supabase a clear infrastructure boundary instead of hiding it inside the API app
