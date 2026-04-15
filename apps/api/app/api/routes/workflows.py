from fastapi import APIRouter, Depends, Query

from app.api.deps import get_pipeline_service
from app.schemas.workflow_runs import (
    WorkflowRunCreateRequest,
    WorkflowRunListResponse,
    WorkflowRunResponse,
    WorkflowRunUpdateRequest,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("", response_model=WorkflowRunResponse)
async def create_workflow(
    payload: WorkflowRunCreateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkflowRunResponse:
    return service.create_workflow_run(payload)


@router.get("", response_model=WorkflowRunListResponse)
async def list_workflows(
    workflow_type: str | None = Query(default=None),
    project_id: str | None = Query(default=None),
    workshop_id: str | None = Query(default=None),
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkflowRunListResponse:
    return service.list_workflow_runs(workflow_type, project_id, workshop_id)


@router.get("/{workflow_id}", response_model=WorkflowRunResponse)
async def get_workflow(
    workflow_id: str,
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkflowRunResponse:
    return service.get_workflow_run(workflow_id)


@router.patch("/{workflow_id}", response_model=WorkflowRunResponse)
async def update_workflow(
    workflow_id: str,
    payload: WorkflowRunUpdateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkflowRunResponse:
    return service.update_workflow_run(workflow_id, payload)
