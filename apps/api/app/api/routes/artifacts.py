from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_pipeline_service
from app.schemas.artifacts import (
    ArtifactApproveRequest,
    ArtifactApproveResponse,
    ArtifactGenerateRequest,
    ArtifactGenerateResponse,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/generate", response_model=ArtifactGenerateResponse)
async def generate_artifacts(
    payload: ArtifactGenerateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> ArtifactGenerateResponse:
    try:
        return service.generate_artifacts(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/approve", response_model=ArtifactApproveResponse)
async def approve_artifacts(
    payload: ArtifactApproveRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> ArtifactApproveResponse:
    return service.approve_artifacts(payload)
