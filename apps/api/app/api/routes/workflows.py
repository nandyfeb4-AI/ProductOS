from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_pipeline_service
from app.schemas.feature_hardening import (
    FeatureHardeningPublishRequest,
    FeatureHardeningPublishResponse,
    FeatureHardeningRunRequest,
    FeatureHardeningRunResponse,
    JiraFeatureSourceListResponse,
)
from app.schemas.backlog_refinement import (
    BacklogRefinementAnalyzeRequest,
    BacklogRefinementAnalyzeResponse,
    BacklogRefinementExecuteRequest,
    BacklogRefinementExecuteResponse,
    BacklogRefinementSourceResponse,
)
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
    workflow_definition_key: str | None = Query(default=None),
    project_id: str | None = Query(default=None),
    workshop_id: str | None = Query(default=None),
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkflowRunListResponse:
    return service.list_workflow_runs(workflow_type, workflow_definition_key, project_id, workshop_id)


@router.get("/feature-hardening/source", response_model=JiraFeatureSourceListResponse)
async def list_feature_hardening_source(
    project_key: str = Query(...),
    service: PipelineService = Depends(get_pipeline_service),
) -> JiraFeatureSourceListResponse:
    return service.get_jira_project_features(project_key)


@router.post("/feature-hardening/run", response_model=FeatureHardeningRunResponse)
async def run_feature_hardening(
    payload: FeatureHardeningRunRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> FeatureHardeningRunResponse:
    return service.run_feature_hardening(payload)


@router.post("/feature-hardening/publish", response_model=FeatureHardeningPublishResponse)
async def publish_feature_hardening(
    payload: FeatureHardeningPublishRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> FeatureHardeningPublishResponse:
    return service.publish_feature_hardening(payload)


@router.get("/backlog-refinement/source", response_model=BacklogRefinementSourceResponse)
async def get_backlog_refinement_source(
    project_id: str = Query(...),
    project_key: str = Query(...),
    service: PipelineService = Depends(get_pipeline_service),
) -> BacklogRefinementSourceResponse:
    return service.get_backlog_refinement_source(project_id, project_key)


@router.post("/backlog-refinement/analyze", response_model=BacklogRefinementAnalyzeResponse)
async def analyze_backlog_refinement(
    payload: BacklogRefinementAnalyzeRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> BacklogRefinementAnalyzeResponse:
    try:
        return service.analyze_backlog_refinement(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/backlog-refinement/execute", response_model=BacklogRefinementExecuteResponse)
async def execute_backlog_refinement(
    payload: BacklogRefinementExecuteRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> BacklogRefinementExecuteResponse:
    try:
        return service.execute_backlog_refinement(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


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
