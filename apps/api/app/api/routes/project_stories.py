from fastapi import APIRouter, Depends, Query

from app.api.deps import get_pipeline_service
from app.schemas.project_stories import (
    ProjectStoryCreateRequest,
    ProjectStoryListResponse,
    ProjectStoryResponse,
    ProjectStoryUpdateRequest,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("", response_model=ProjectStoryResponse)
async def create_project_story(
    payload: ProjectStoryCreateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectStoryResponse:
    return service.create_project_story(payload)


@router.get("", response_model=ProjectStoryListResponse)
async def list_project_stories(
    project_id: str | None = Query(default=None),
    source_feature_id: str | None = Query(default=None),
    source_story_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectStoryListResponse:
    return service.list_project_stories(project_id, source_feature_id, source_story_id, status)


@router.get("/{story_id}", response_model=ProjectStoryResponse)
async def get_project_story(
    story_id: str,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectStoryResponse:
    return service.get_project_story(story_id)


@router.patch("/{story_id}", response_model=ProjectStoryResponse)
async def update_project_story(
    story_id: str,
    payload: ProjectStoryUpdateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectStoryResponse:
    return service.update_project_story(story_id, payload)
