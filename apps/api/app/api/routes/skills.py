from fastapi import APIRouter, Depends, Query

from app.api.deps import get_pipeline_service
from app.schemas.skills import (
    SkillCreateRequest,
    SkillListResponse,
    SkillResponse,
    SkillUpdateRequest,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("", response_model=SkillResponse)
async def create_skill(
    payload: SkillCreateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> SkillResponse:
    return service.create_skill(payload)


@router.get("", response_model=SkillListResponse)
async def list_skills(
    skill_type: str | None = Query(default=None),
    active_only: bool | None = Query(default=None),
    service: PipelineService = Depends(get_pipeline_service),
) -> SkillListResponse:
    return service.list_skills(skill_type, active_only)


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(
    skill_id: str,
    service: PipelineService = Depends(get_pipeline_service),
) -> SkillResponse:
    return service.get_skill(skill_id)


@router.patch("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: str,
    payload: SkillUpdateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> SkillResponse:
    return service.update_skill(skill_id, payload)
