from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_pipeline_service
from app.schemas.opportunity import (
    OpportunitySynthesizeRequest,
    OpportunitySynthesizeResponse,
    OpportunityValidateRequest,
    OpportunityValidateResponse,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/synthesize", response_model=OpportunitySynthesizeResponse)
async def synthesize_opportunities(
    payload: OpportunitySynthesizeRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> OpportunitySynthesizeResponse:
    try:
        return service.synthesize_opportunities(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/validate", response_model=OpportunityValidateResponse)
async def validate_opportunities(
    payload: OpportunityValidateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> OpportunityValidateResponse:
    return service.validate_opportunities(payload)
