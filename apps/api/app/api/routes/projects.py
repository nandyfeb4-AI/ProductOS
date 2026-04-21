from fastapi import APIRouter, Depends, Query

from app.api.deps import get_pipeline_service
from app.schemas.projects import (
    ProjectCreateRequest,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.schemas.team import ProjectTeamResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("", response_model=ProjectResponse)
async def create_project(
    payload: ProjectCreateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectResponse:
    return service.create_project(payload)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    status: str | None = Query(default=None),
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectListResponse:
    return service.list_projects(status)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectResponse:
    return service.get_project(project_id)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectResponse:
    return service.update_project(project_id, payload)


@router.get("/{project_id}/team", response_model=ProjectTeamResponse)
async def get_project_team(
    project_id: str,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectTeamResponse:
    return service.get_project_team(project_id)
