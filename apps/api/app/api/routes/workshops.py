from fastapi import APIRouter, Depends, Query

from app.api.deps import get_pipeline_service
from app.schemas.workshop import (
    WorkshopCreateRequest,
    WorkshopListResponse,
    WorkshopResponse,
    WorkshopUpdateRequest,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("", response_model=WorkshopResponse)
async def create_workshop_record(
    payload: WorkshopCreateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkshopResponse:
    return service.create_workshop_record(payload)


@router.get("", response_model=WorkshopListResponse)
async def list_workshops(
    project_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkshopListResponse:
    return service.list_workshops(project_id, status)


@router.get("/{workshop_id}", response_model=WorkshopResponse)
async def get_workshop_record(
    workshop_id: str,
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkshopResponse:
    return service.get_workshop(workshop_id)


@router.patch("/{workshop_id}", response_model=WorkshopResponse)
async def update_workshop_record(
    workshop_id: str,
    payload: WorkshopUpdateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkshopResponse:
    return service.update_workshop(workshop_id, payload)
