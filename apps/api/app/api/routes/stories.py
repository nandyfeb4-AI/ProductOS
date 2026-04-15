from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_pipeline_service
from app.schemas.artifacts import (
    StoryApproveRequest,
    StoryApproveResponse,
    StorySliceWorkflowRequest,
    StorySliceWorkflowResponse,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/slice", response_model=StorySliceWorkflowResponse)
async def slice_workflow_stories(
    payload: StorySliceWorkflowRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> StorySliceWorkflowResponse:
    try:
        return service.slice_artifact_stories(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/approve", response_model=StoryApproveResponse)
async def approve_workflow_stories(
    payload: StoryApproveRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> StoryApproveResponse:
    return service.approve_stories(payload)
