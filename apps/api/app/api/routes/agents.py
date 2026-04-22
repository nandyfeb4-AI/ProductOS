from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_pipeline_service
from app.schemas.agents import (
    CompetitorAnalysisRequest,
    CompetitorAnalysisResponse,
    FeatureGeneratorRequest,
    FeatureGeneratorResponse,
    FeaturePrioritizerRequest,
    FeaturePrioritizerResponse,
    FeatureRefinerRequest,
    FeatureRefinerResponse,
    StoryGeneratorRequest,
    StoryGeneratorResponse,
    StoryRefinerRequest,
    StoryRefinerResponse,
    StorySlicerRequest,
    StorySlicerResponse,
    UserResearchRequest,
    UserResearchResponse,
)
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/competitor-analysis", response_model=CompetitorAnalysisResponse)
async def run_competitor_analysis(
    payload: CompetitorAnalysisRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> CompetitorAnalysisResponse:
    try:
        return service.run_competitor_analysis(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/user-research", response_model=UserResearchResponse)
async def run_user_research(
    payload: UserResearchRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> UserResearchResponse:
    try:
        return service.run_user_research(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/feature-generator", response_model=FeatureGeneratorResponse)
async def run_feature_generator(
    payload: FeatureGeneratorRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> FeatureGeneratorResponse:
    try:
        return service.run_feature_generator(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/feature-refiner", response_model=FeatureRefinerResponse)
async def run_feature_refiner(
    payload: FeatureRefinerRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> FeatureRefinerResponse:
    try:
        return service.run_feature_refiner(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/feature-prioritizer", response_model=FeaturePrioritizerResponse)
async def run_feature_prioritizer(
    payload: FeaturePrioritizerRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> FeaturePrioritizerResponse:
    try:
        return service.run_feature_prioritizer(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/story-generator", response_model=StoryGeneratorResponse)
async def run_story_generator(
    payload: StoryGeneratorRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> StoryGeneratorResponse:
    try:
        return service.run_story_generator(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/story-refiner", response_model=StoryRefinerResponse)
async def run_story_refiner(
    payload: StoryRefinerRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> StoryRefinerResponse:
    try:
        return service.run_story_refiner(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/story-slicer", response_model=StorySlicerResponse)
async def run_story_slicer(
    payload: StorySlicerRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> StorySlicerResponse:
    try:
        return service.run_story_slicer(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
