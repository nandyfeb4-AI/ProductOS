from fastapi import APIRouter, Depends

from app.api.deps import get_pipeline_service
from app.schemas.story import (
    StoryGenerateRequest,
    StoryGenerateResponse,
    StoryRefineRequest,
    StoryRefineResponse,
    StorySliceRequest,
    StorySliceResponse,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/generate", response_model=StoryGenerateResponse)
async def generate_stories(
    payload: StoryGenerateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> StoryGenerateResponse:
    return service.generate_stories(payload)


@router.post("/refine", response_model=StoryRefineResponse)
async def refine_stories(
    payload: StoryRefineRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> StoryRefineResponse:
    return service.refine_stories(payload)


@router.post("/slice", response_model=StorySliceResponse)
async def slice_stories(
    payload: StorySliceRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> StorySliceResponse:
    return service.slice_stories(payload)

