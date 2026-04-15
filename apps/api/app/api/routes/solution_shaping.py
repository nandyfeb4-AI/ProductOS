from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_pipeline_service
from app.schemas.solution_shaping import (
    SolutionShapingConfirmRequest,
    SolutionShapingConfirmResponse,
    SolutionShapingSynthesizeRequest,
    SolutionShapingSynthesizeResponse,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/synthesize", response_model=SolutionShapingSynthesizeResponse)
async def synthesize_solution_shapes(
    payload: SolutionShapingSynthesizeRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> SolutionShapingSynthesizeResponse:
    try:
        return service.synthesize_solution_shapes(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/confirm", response_model=SolutionShapingConfirmResponse)
async def confirm_solution_shapes(
    payload: SolutionShapingConfirmRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> SolutionShapingConfirmResponse:
    return service.confirm_solution_shapes(payload)
