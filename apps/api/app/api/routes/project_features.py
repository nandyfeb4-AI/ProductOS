from fastapi import APIRouter, Depends, Query

from app.api.deps import get_pipeline_service
from app.schemas.project_features import (
    ProjectFeatureCreateRequest,
    ProjectFeatureListResponse,
    ProjectFeatureResponse,
    ProjectFeatureUpdateRequest,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("", response_model=ProjectFeatureResponse)
async def create_project_feature(
    payload: ProjectFeatureCreateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectFeatureResponse:
    return service.create_project_feature(payload)


@router.get("", response_model=ProjectFeatureListResponse)
async def list_project_features(
    project_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectFeatureListResponse:
    return service.list_project_features(project_id, status)


@router.get("/{feature_id}", response_model=ProjectFeatureResponse)
async def get_project_feature(
    feature_id: str,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectFeatureResponse:
    return service.get_project_feature(feature_id)


@router.patch("/{feature_id}", response_model=ProjectFeatureResponse)
async def update_project_feature(
    feature_id: str,
    payload: ProjectFeatureUpdateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> ProjectFeatureResponse:
    return service.update_project_feature(feature_id, payload)
