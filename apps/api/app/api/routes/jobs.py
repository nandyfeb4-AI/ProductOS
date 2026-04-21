from __future__ import annotations

from fastapi import APIRouter, Depends, WebSocket

from app.api.deps import get_job_service, get_pipeline_service
from app.schemas.agents import (
    FeatureGeneratorRequest,
    FeaturePrioritizerRequest,
    FeatureRefinerRequest,
    StoryGeneratorRequest,
    StoryRefinerRequest,
    StorySlicerRequest,
)
from app.schemas.artifacts import ArtifactGenerateRequest, StorySliceWorkflowRequest
from app.schemas.backlog_refinement import BacklogRefinementAnalyzeRequest, BacklogRefinementExecuteRequest
from app.schemas.feature_hardening import FeatureHardeningRunRequest
from app.schemas.jobs import GenerationJob, GenerationJobAcceptedResponse
from app.schemas.opportunity import OpportunitySynthesizeRequest
from app.schemas.solution_shaping import SolutionShapingSynthesizeRequest
from app.services.job_service import JobService
from app.services.pipeline_service import PipelineService


router = APIRouter()


@router.post("/backlog-refinement-analysis", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_backlog_refinement_analysis(
    payload: BacklogRefinementAnalyzeRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="backlog_refinement_analysis",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for backlog refinement analysis.",
        running_stage="running",
        running_message="Analyzing backlog coverage and routing stories into refinement buckets.",
        runner=lambda: service.analyze_backlog_refinement(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/backlog-refinement-execution", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_backlog_refinement_execution(
    payload: BacklogRefinementExecuteRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="backlog_refinement_execution",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for backlog refinement execution.",
        running_stage="running",
        running_message="Executing backlog refinement plan across generate, refine, and slice buckets.",
        runner=lambda: service.execute_backlog_refinement(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/opportunity-synthesis", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_opportunity_synthesis(
    payload: OpportunitySynthesizeRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="opportunity_synthesis",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI opportunity synthesis.",
        running_stage="running",
        running_message="Synthesizing AI opportunity candidates.",
        runner=lambda: service.synthesize_opportunities(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/solution-shaping", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_solution_shaping(
    payload: SolutionShapingSynthesizeRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="solution_shaping",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI solution shaping.",
        running_stage="running",
        running_message="Shaping approved opportunities into solution recommendations.",
        runner=lambda: service.synthesize_solution_shapes(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/artifact-generation", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_artifact_generation(
    payload: ArtifactGenerateRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="artifact_generation",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI artifact generation.",
        running_stage="running",
        running_message="Generating structured initiative, feature, or enhancement artifacts.",
        runner=lambda: service.generate_artifacts(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/story-slicing", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_story_slicing(
    payload: StorySliceWorkflowRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="story_slicing",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI story slicing.",
        running_stage="running",
        running_message="Generating implementation-ready stories from approved artifacts.",
        runner=lambda: service.slice_artifact_stories(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/feature-generation", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_feature_generation(
    payload: FeatureGeneratorRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="feature_generation",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI feature generation.",
        running_stage="running",
        running_message="Generating a PM-ready feature draft from the provided source material.",
        runner=lambda: service.run_feature_generator(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/feature-refinement", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_feature_refinement(
    payload: FeatureRefinerRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="feature_refinement",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI feature refinement.",
        running_stage="running",
        running_message="Evaluating and refining the selected features.",
        runner=lambda: service.run_feature_refiner(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/feature-hardening", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_feature_hardening(
    payload: FeatureHardeningRunRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="feature_hardening",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI feature hardening.",
        running_stage="running",
        running_message="Evaluating Jira epics and hardening the selected features.",
        runner=lambda: service.run_feature_hardening(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/feature-prioritization", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_feature_prioritization(
    payload: FeaturePrioritizerRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="feature_prioritization",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI feature prioritization.",
        running_stage="running",
        running_message="Evaluating selected features and recommending a ranked priority order.",
        runner=lambda: service.run_feature_prioritizer(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/story-generation", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_story_generation(
    payload: StoryGeneratorRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="story_generation",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI story generation.",
        running_stage="running",
        running_message="Generating implementation-ready stories from the selected feature.",
        runner=lambda: service.run_story_generator(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/story-refinement", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_story_refinement(
    payload: StoryRefinerRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="story_refinement",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI story refinement.",
        running_stage="running",
        running_message="Evaluating and refining the selected stories.",
        runner=lambda: service.run_story_refiner(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.post("/story-slicing-agent", response_model=GenerationJobAcceptedResponse, status_code=202)
async def start_story_slicing_agent(
    payload: StorySlicerRequest,
    service: PipelineService = Depends(get_pipeline_service),
    job_service: JobService = Depends(get_job_service),
) -> GenerationJobAcceptedResponse:
    job = job_service.enqueue(
        job_type="story_slicer",
        input_payload=payload.model_dump(mode="json"),
        queued_stage="queued",
        queued_message="Queued for AI story slicing.",
        running_stage="running",
        running_message="Splitting the selected story into smaller implementation-ready stories.",
        runner=lambda: service.run_story_slicer(payload),
    )
    return GenerationJobAcceptedResponse(job=job)


@router.get("/{job_id}", response_model=GenerationJob)
async def get_generation_job(
    job_id: str,
    job_service: JobService = Depends(get_job_service),
) -> GenerationJob:
    return job_service.get_job(job_id)


@router.websocket("/ws/{job_id}")
async def stream_generation_job(
    websocket: WebSocket,
    job_id: str,
) -> None:
    job_service = get_job_service()
    await job_service.stream(job_id, websocket)
