from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.artifacts import StoryDraft
from app.schemas.project_features import ProjectFeatureResponse
from app.schemas.project_stories import ProjectStoryResponse


class FeatureDraft(BaseModel):
    feature_id: str
    status: str = "draft"
    title: str
    summary: str = ""
    body: dict = Field(default_factory=dict)


class FeatureGeneratorRequest(BaseModel):
    project_id: UUID
    source_type: Literal["prompt", "opportunity", "requirement"] = "prompt"
    source_title: str
    source_summary: str
    source_details: str = ""
    desired_outcome: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class FeatureGeneratorResponse(BaseModel):
    feature: FeatureDraft


class FeatureRefinementEvaluation(BaseModel):
    problem_clarity_score: int
    solution_clarity_score: int
    requirement_completeness_score: int
    dependency_score: int
    success_metrics_score: int
    implementation_readiness_score: int
    overall_score: int
    needs_refinement: bool = True
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    refinement_reasons: list[str] = Field(default_factory=list)


class FeatureRefinementResult(BaseModel):
    feature: ProjectFeatureResponse
    evaluation: FeatureRefinementEvaluation
    refinement_summary: str = ""


class FeatureRefinerRequest(BaseModel):
    project_id: UUID
    source_type: Literal["project_feature"] = "project_feature"
    feature_ids: list[UUID] = Field(default_factory=list, min_length=1, max_length=8)
    refinement_goal: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class FeatureRefinerResponse(BaseModel):
    results: list[FeatureRefinementResult] = Field(default_factory=list)


class FeaturePrioritizationAssessment(BaseModel):
    framework: str = "impact_vs_effort"
    impact_score: int
    effort_score: int
    strategic_alignment_score: int
    urgency_score: int
    confidence_score: int
    overall_priority_score: int
    recommended_rank: int
    priority_bucket: str = "medium"
    rationale: list[str] = Field(default_factory=list)
    tradeoffs: list[str] = Field(default_factory=list)
    recommendation: str = ""


class FeaturePrioritizationResult(BaseModel):
    feature: ProjectFeatureResponse
    prioritization: FeaturePrioritizationAssessment
    prioritization_summary: str = ""


class FeaturePrioritizerRequest(BaseModel):
    project_id: UUID
    source_type: Literal["project_feature"] = "project_feature"
    feature_ids: list[UUID] = Field(default_factory=list, min_length=1, max_length=8)
    prioritization_goal: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class FeaturePrioritizerResponse(BaseModel):
    results: list[FeaturePrioritizationResult] = Field(default_factory=list)
    prioritization_summary: str = ""


class CompetitorAnalysisAssessment(BaseModel):
    category: str = "direct"
    confidence_score: int
    threat_level: str = "medium"
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    feature_gaps: list[str] = Field(default_factory=list)
    positioning_summary: str = ""
    recommended_response: str = ""


class CompetitorAnalysisResult(BaseModel):
    competitor_name: str
    competitor_summary: str = ""
    analysis: CompetitorAnalysisAssessment


class CompetitorAnalysisRequest(BaseModel):
    project_id: UUID
    source_type: Literal["prompt"] = "prompt"
    product_name: str
    product_summary: str
    target_market: str = ""
    known_competitors: list[str] = Field(default_factory=list, min_length=1, max_length=8)
    analysis_goal: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class CompetitorAnalysisResponse(BaseModel):
    market_summary: str = ""
    strategic_recommendations: list[str] = Field(default_factory=list)
    differentiation_opportunities: list[str] = Field(default_factory=list)
    blind_spots: list[str] = Field(default_factory=list)
    results: list[CompetitorAnalysisResult] = Field(default_factory=list)


class UserResearchInsight(BaseModel):
    insight_title: str
    insight_summary: str = ""
    evidence: list[str] = Field(default_factory=list)
    implication: str = ""
    recommended_action: str = ""
    confidence_score: int


class UserResearchRequest(BaseModel):
    project_id: UUID
    source_type: Literal["prompt"] = "prompt"
    product_name: str
    product_summary: str = ""
    target_user: str = ""
    research_inputs: list[str] = Field(default_factory=list, min_length=1, max_length=12)
    research_goal: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class UserResearchResponse(BaseModel):
    research_summary: str = ""
    user_segments: list[str] = Field(default_factory=list)
    key_pain_points: list[str] = Field(default_factory=list)
    unmet_needs: list[str] = Field(default_factory=list)
    jobs_to_be_done: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    risks_and_unknowns: list[str] = Field(default_factory=list)
    results: list[UserResearchInsight] = Field(default_factory=list)


class StoryGeneratorRequest(BaseModel):
    project_id: UUID
    source_type: Literal["feature"] = "feature"
    source_feature_id: UUID
    story_count_hint: int | None = None
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class StoryGeneratorResponse(BaseModel):
    stories: list[StoryDraft] = Field(default_factory=list)


class StoryRefinementEvaluation(BaseModel):
    clarity_score: int
    acceptance_criteria_score: int
    completeness_score: int
    edge_case_score: int
    dependency_score: int
    implementation_readiness_score: int
    overall_score: int
    needs_refinement: bool = True
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    refinement_reasons: list[str] = Field(default_factory=list)


class StoryRefinementResult(BaseModel):
    story: ProjectStoryResponse
    evaluation: StoryRefinementEvaluation
    refinement_summary: str = ""


class StoryRefinerRequest(BaseModel):
    project_id: UUID
    source_type: Literal["project_story"] = "project_story"
    story_ids: list[UUID] = Field(default_factory=list, min_length=1, max_length=8)
    refinement_goal: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class StoryRefinerResponse(BaseModel):
    results: list[StoryRefinementResult] = Field(default_factory=list)


class StorySlicerRequest(BaseModel):
    project_id: UUID
    source_type: Literal["project_story"] = "project_story"
    source_story_id: UUID
    target_story_count_hint: int | None = None
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class StorySlicerResponse(BaseModel):
    source_story: ProjectStoryResponse
    stories: list[ProjectStoryResponse] = Field(default_factory=list)
    slicing_summary: str = ""
