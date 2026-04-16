from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import HTTPException, status

from app.repositories.connector_repository import ConnectorRepository
from app.repositories.project_feature_repository import ProjectFeatureRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.project_story_repository import ProjectStoryRepository
from app.repositories.skill_repository import SkillRepository
from app.repositories.workshop_repository import WorkshopRepository
from app.repositories.workflow_repository import WorkflowRepository
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.artifacts import (
    ArtifactApproveRequest,
    ArtifactApproveResponse,
    ArtifactGenerateRequest,
    ArtifactGenerateResponse,
    GeneratedArtifact,
    StoryApproveRequest,
    StoryApproveResponse,
    StoryDraft,
    StorySliceWorkflowRequest,
    StorySliceWorkflowResponse,
)
from app.schemas.agents import (
    FeatureGeneratorRequest,
    FeatureGeneratorResponse,
    StoryGeneratorRequest,
    StoryGeneratorResponse,
)
from app.schemas.common import InsightBundle, StoryArtifact
from app.schemas.feature import Feature, FeatureGenerateRequest, FeatureGenerateResponse
from app.schemas.initiative import Initiative, InitiativeGenerateRequest, InitiativeGenerateResponse
from app.schemas.jira import JiraPushRequest, JiraPushResponse, JiraPushResult
from app.schemas.jira_connector import (
    JiraConnectRequest,
    JiraConnectResponse,
    JiraExportRequest,
    JiraExportResponse,
    JiraFeatureExportRequest,
    JiraFeatureExportResponse,
    JiraProjectsResponse,
)
from app.schemas.connector_hub import ConnectorListResponse, ConnectorSummary
from app.schemas.opportunity import (
    OpportunityCandidate,
    OpportunityEvidence,
    OpportunitySynthesizeRequest,
    OpportunitySynthesizeResponse,
    OpportunityValidateRequest,
    OpportunityValidateResponse,
)
from app.schemas.prd import PRDDocument, PRDGenerateRequest, PRDGenerateResponse
from app.schemas.projects import (
    ProjectCreateRequest,
    ProjectListResponse,
    ProjectResponse,
    ProjectSummary,
    ProjectUpdateRequest,
)
from app.schemas.project_features import (
    ProjectFeatureCreateRequest,
    ProjectFeatureListResponse,
    ProjectFeatureResponse,
    ProjectFeatureSummary,
    ProjectFeatureUpdateRequest,
)
from app.schemas.project_stories import (
    ProjectStoryCreateRequest,
    ProjectStoryListResponse,
    ProjectStoryResponse,
    ProjectStorySummary,
    ProjectStoryUpdateRequest,
)
from app.schemas.skills import SkillCreateRequest, SkillListResponse, SkillResponse, SkillSummary, SkillUpdateRequest
from app.schemas.story import (
    StoryGenerateRequest,
    StoryGenerateResponse,
    StoryRefineRequest,
    StoryRefineResponse,
    StorySliceRequest,
    StorySliceResponse,
)
from app.schemas.workshop import WorkshopAnalyzeRequest, WorkshopAnalyzeResponse
from app.schemas.workshop import (
    WorkshopCreateRequest,
    WorkshopListResponse,
    WorkshopResponse,
    WorkshopSummary,
    WorkshopUpdateRequest,
)
from app.schemas.workflow_runs import (
    WorkflowRunCreateRequest,
    WorkflowRunListResponse,
    WorkflowRunResponse,
    WorkflowRunUpdateRequest,
)
from app.services.mural_service import MuralService
from app.services.artifact_generation_llm_service import ArtifactGenerationLLMService
from app.services.feature_generation_llm_service import FeatureGenerationLLMService
from app.services.feature_spec_skill import default_feature_spec_skill
from app.services.jira_service import JiraService
from app.services.opportunity_llm_service import OpportunityLLMService
from app.services.solution_shaping_llm_service import SolutionShapingLLMService
from app.services.story_slicing_llm_service import StorySlicingLLMService
from app.services.story_generation_llm_service import StoryGenerationLLMService
from app.services.story_spec_skill import default_story_spec_skill
from app.schemas.solution_shaping import (
    ShapedSolution,
    SolutionShapingConfirmRequest,
    SolutionShapingConfirmResponse,
    SolutionShapingSynthesizeRequest,
    SolutionShapingSynthesizeResponse,
)


class PipelineService:
    """Temporary MVP scaffolding for the stepwise PM generation pipeline."""

    JOURNEY_LABELS = {
        "experience_steps": "Experience steps",
        "interactions": "Interactions",
        "goals_and_motivations": "Goals and motivations",
        "positive_moments": "Positive moments",
        "negative_moments": "Negative moments",
        "areas_of_opportunity": "Areas of opportunity",
    }
    logger = logging.getLogger(__name__)

    def __init__(self) -> None:
        self.opportunity_llm_service = OpportunityLLMService()
        self.solution_shaping_llm_service = SolutionShapingLLMService()
        self.artifact_generation_llm_service = ArtifactGenerationLLMService()
        self.feature_generation_llm_service = FeatureGenerationLLMService()
        self.story_generation_llm_service = StoryGenerationLLMService()
        self.story_slicing_llm_service = StorySlicingLLMService()
        self.jira_service = JiraService()
        self.connector_repository = ConnectorRepository()
        self.project_feature_repository = ProjectFeatureRepository()
        self.project_story_repository = ProjectStoryRepository()
        self.project_repository = ProjectRepository()
        self.skill_repository = SkillRepository()
        self.workshop_repository = WorkshopRepository()
        self.workflow_repository = WorkflowRepository()
        self.mural_service = MuralService()

    def analyze_workshop(self, payload: WorkshopAnalyzeRequest) -> WorkshopAnalyzeResponse:
        transcript = f"{payload.transcript}\n{payload.notes or ''}".lower()
        insights = InsightBundle(
            action_items=["Review extracted workshop themes"],
            decisions=["Align on MVP backlog generation workflow"],
            pain_points=["Product conversations are hard to convert into delivery-ready work"],
            opportunities=["Use AI to accelerate workshop-to-backlog conversion"],
        )
        if "jira" in transcript:
            insights.opportunities.append("Support direct Jira export for delivery handoff")
        return WorkshopAnalyzeResponse(workshop_id=str(uuid4()), insights=insights)

    def generate_initiatives(
        self, payload: InitiativeGenerateRequest
    ) -> InitiativeGenerateResponse:
        initiatives = [
            Initiative(
                title="Automate workshop synthesis",
                description="Turn workshop notes into structured product insights.",
                problem_statement="Teams lose time manually distilling discussions into PM outputs.",
                priority="high",
            )
        ]
        if payload.insights.opportunities:
            initiatives.append(
                Initiative(
                    title="Accelerate backlog creation",
                    description="Convert insights into prioritised initiatives and backlog candidates.",
                    problem_statement="PMs need a faster path from discovery to execution.",
                    priority="high",
                )
            )
        return InitiativeGenerateResponse(initiatives=initiatives)

    def synthesize_opportunities(
        self, payload: OpportunitySynthesizeRequest
    ) -> OpportunitySynthesizeResponse:
        if not self.opportunity_llm_service.enabled:
            raise RuntimeError("AI opportunity synthesis is unavailable. Configure the OpenAI API key and retry.")

        evidence_by_category = self._collect_evidence(payload)
        try:
            llm_candidates = self.opportunity_llm_service.synthesize(payload, evidence_by_category)
        except Exception as exc:
            self.logger.exception("AI opportunity synthesis failed")
            raise RuntimeError("AI opportunity synthesis failed. Please retry.") from exc
        if llm_candidates:
            return OpportunitySynthesizeResponse(opportunities=llm_candidates)

        opportunities: list[OpportunityCandidate] = []

        explicit_opportunities = evidence_by_category.get("areas_of_opportunity", [])
        pain_points = evidence_by_category.get("negative_moments", [])
        interactions = evidence_by_category.get("interactions", [])
        goals = evidence_by_category.get("goals_and_motivations", [])
        positive_moments = evidence_by_category.get("positive_moments", [])
        experience_steps = evidence_by_category.get("experience_steps", [])

        for index, evidence in enumerate(explicit_opportunities, start=1):
            title = self._title_from_text(evidence.text)
            paired_pain = pain_points[min(index - 1, len(pain_points) - 1)] if pain_points else None
            supporting = [evidence]
            if paired_pain is not None:
                supporting.append(paired_pain)
            supporting.extend(interactions[:1])
            supporting.extend(goals[:1])

            problem_parts = []
            if paired_pain is not None:
                problem_parts.append(paired_pain.text)
            if interactions:
                problem_parts.append(interactions[0].text)
            problem_statement = (
                "Users experience " + " and ".join(problem_parts)
                if problem_parts
                else f"Users need a better experience around {title.lower()}."
            )

            opportunities.append(
                OpportunityCandidate(
                    id=f"opp_{index}",
                    title=title,
                    problem_statement=problem_statement,
                    why_it_matters=self._build_why_it_matters(
                        paired_pain=paired_pain,
                        opportunity=evidence,
                        goals=goals[:1],
                        positive_moments=positive_moments[:1],
                        stage=evidence.stage,
                    ),
                    confidence=self._score_confidence(supporting),
                    impact=self._score_impact(paired_pain=paired_pain, opportunity=evidence),
                    evidence=self._dedupe_evidence(supporting),
                )
            )

        if not opportunities and (pain_points or payload.insights):
            opportunities.extend(
                self._fallback_opportunities(
                    payload=payload,
                    pain_points=pain_points,
                    interactions=interactions,
                    goals=goals,
                    experience_steps=experience_steps,
                )
            )

        return OpportunitySynthesizeResponse(opportunities=opportunities)

    def validate_opportunities(
        self, payload: OpportunityValidateRequest
    ) -> OpportunityValidateResponse:
        approved_ids = set(payload.approved_ids)
        approved = [
            opportunity
            for opportunity in payload.opportunities
            if opportunity.id and opportunity.id in approved_ids
        ]
        return OpportunityValidateResponse(
            approved=approved,
            discarded_ids=payload.discarded_ids,
            total_candidates=len(payload.opportunities),
            total_approved=len(approved),
        )

    def synthesize_solution_shapes(
        self, payload: SolutionShapingSynthesizeRequest
    ) -> SolutionShapingSynthesizeResponse:
        if not self.solution_shaping_llm_service.enabled:
            raise RuntimeError("AI solution shaping is unavailable. Configure the OpenAI API key and retry.")
        try:
            shaped = self.solution_shaping_llm_service.synthesize(payload)
        except Exception as exc:
            self.logger.exception("AI solution shaping failed")
            raise RuntimeError("AI solution shaping failed. Please retry.") from exc
        if not shaped:
            raise RuntimeError("AI solution shaping returned no results. Please retry.")
        return SolutionShapingSynthesizeResponse(shaped=shaped)

    def confirm_solution_shapes(
        self, payload: SolutionShapingConfirmRequest
    ) -> SolutionShapingConfirmResponse:
        actionable_count = sum(
            1 for item in payload.shaped if (item.chosen_type or item.recommended_type) != "No action"
        )
        deferred_count = len(payload.shaped) - actionable_count
        return SolutionShapingConfirmResponse(
            shaped=payload.shaped,
            actionable_count=actionable_count,
            deferred_count=deferred_count,
        )

    def generate_artifacts(
        self, payload: ArtifactGenerateRequest
    ) -> ArtifactGenerateResponse:
        actionable = [
            item for item in payload.shaped if (item.chosen_type or item.recommended_type) != "No action"
        ]
        if not self.artifact_generation_llm_service.enabled:
            raise RuntimeError("AI artifact generation is unavailable. Configure the OpenAI API key and retry.")
        try:
            generated = self.artifact_generation_llm_service.generate(
                ArtifactGenerateRequest(shaped=actionable),
                feature_spec_skill=self._get_active_feature_spec_skill(),
            )
        except Exception as exc:
            self.logger.exception("AI artifact generation failed")
            raise RuntimeError("AI artifact generation failed. Please retry.") from exc
        if not generated:
            raise RuntimeError("AI artifact generation returned no results. Please retry.")
        return ArtifactGenerateResponse(artifacts=generated)

    def approve_artifacts(
        self, payload: ArtifactApproveRequest
    ) -> ArtifactApproveResponse:
        approved_ids = set(payload.approved_ids)
        approved = [
            artifact
            for artifact in payload.artifacts
            if artifact.artifact_id in approved_ids
        ]
        return ArtifactApproveResponse(
            artifacts=approved,
            approved_count=len(approved),
            rejected_count=len(payload.rejected_ids),
            total_candidates=len(payload.artifacts),
        )

    def slice_artifact_stories(
        self, payload: StorySliceWorkflowRequest
    ) -> StorySliceWorkflowResponse:
        if not self.story_slicing_llm_service.enabled:
            raise RuntimeError("AI story slicing is unavailable. Configure the OpenAI API key and retry.")
        try:
            stories = self.story_slicing_llm_service.slice(payload)
        except Exception as exc:
            self.logger.exception("AI story slicing failed")
            raise RuntimeError("AI story slicing failed. Please retry.") from exc
        if not stories:
            raise RuntimeError("AI story slicing returned no results. Please retry.")
        return StorySliceWorkflowResponse(stories=stories)

    def approve_stories(
        self, payload: StoryApproveRequest
    ) -> StoryApproveResponse:
        approved_ids = set(payload.approved_ids)
        approved = [
            story
            for story in payload.stories
            if story.story_id in approved_ids
        ]
        return StoryApproveResponse(
            stories=approved,
            approved_count=len(approved),
            rejected_count=len(payload.rejected_ids),
            total_candidates=len(payload.stories),
        )

    def connect_jira(self, payload: JiraConnectRequest) -> JiraConnectResponse:
        return self.jira_service.connect(payload)

    def get_jira_authorization_url(self) -> tuple[str, str]:
        return self.jira_service.get_authorization_url()

    def exchange_jira_code(self, code: str, state: str) -> JiraConnectResponse:
        return self.jira_service.exchange_code(code, state)

    def get_jira_status(self) -> JiraConnectResponse:
        return self.jira_service.status()

    def disconnect_jira(self) -> dict[str, bool]:
        return self.jira_service.disconnect()

    def get_jira_projects(self) -> JiraProjectsResponse:
        return self.jira_service.list_projects()

    def export_to_jira(self, payload: JiraExportRequest) -> JiraExportResponse:
        return self.jira_service.export(payload)

    def export_feature_to_jira(self, payload: JiraFeatureExportRequest) -> JiraFeatureExportResponse:
        result = self.jira_service.export_feature(payload)
        feature_row = self.project_feature_repository.get_feature(payload.feature.feature_id)
        if feature_row is not None:
            self.project_feature_repository.update_feature(
                payload.feature.feature_id,
                status="exported",
                jira_issue_key=result.issue_key,
                jira_issue_url=result.issue_url,
                jira_issue_type=result.issue_type,
            )
        return result

    def list_connectors(self) -> ConnectorListResponse:
        connected_rows = {row["provider"]: row for row in self.connector_repository.list_connector_overview()}
        connector_defs = [
            ("mural", "Mural", "discovery"),
            ("miro", "Miro", "discovery"),
            ("figjam", "FigJam", "discovery"),
            ("notion", "Notion", "knowledge"),
            ("jira", "Jira", "delivery"),
        ]
        connectors: list[ConnectorSummary] = []
        for provider, label, category in connector_defs:
            row = connected_rows.get(provider)
            metadata = row.get("metadata") if row else {}
            if provider == "jira" and not row:
                live_status = self.jira_service.status()
                if live_status.connected:
                    metadata = {
                        "base_url": live_status.base_url,
                        "account_id": live_status.account_id,
                        "email": live_status.email,
                        "display_name": live_status.display_name,
                    }
            connectors.append(
                ConnectorSummary(
                    provider=provider,
                    label=label,
                    category=category,
                    connected=bool(row) or (provider == "jira" and bool(metadata)),
                    display_name=(metadata or {}).get("display_name") or (row or {}).get("full_name"),
                    username=(metadata or {}).get("email") or (row or {}).get("username"),
                    full_name=(row or {}).get("full_name"),
                    base_url=(metadata or {}).get("base_url"),
                    account_id=(metadata or {}).get("account_id") or (row or {}).get("external_user_id"),
                    state=(row or {}).get("state"),
                    last_connected_at=(row or {}).get("updated_at"),
                    last_synced_at=(row or {}).get("last_synced_at"),
                    last_synced_resource_name=(row or {}).get("last_synced_resource_name"),
                    metadata=metadata or {},
                )
            )
        return ConnectorListResponse(connectors=connectors)

    def create_workflow_run(self, payload: WorkflowRunCreateRequest) -> WorkflowRunResponse:
        workshop_row = None
        resolved_project_id = str(payload.project_id) if payload.project_id is not None else None
        if payload.project_id is not None:
            self._ensure_project_exists(resolved_project_id)
        if payload.workshop_id is not None:
            workshop_row = self._get_workshop_required(str(payload.workshop_id))
            workshop_project_id = str(workshop_row["project_id"])
            if resolved_project_id is None:
                resolved_project_id = workshop_project_id
            elif resolved_project_id != workshop_project_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workflow project_id must match the workshop's project_id.",
                )
        row = self.workflow_repository.create_workflow(
            workflow_type=payload.workflow_type,
            project_id=resolved_project_id,
            workshop_id=str(payload.workshop_id) if payload.workshop_id is not None else None,
            title=payload.title,
            source_provider=payload.source_provider,
            source_resource_id=payload.source_resource_id,
            source_resource_name=payload.source_resource_name,
            current_step=payload.current_step,
            status=payload.status,
            state_payload=payload.state_payload,
        )
        if workshop_row is not None:
            self.workshop_repository.update_workshop(
                str(workshop_row["id"]),
                status=self._resolve_workshop_status_from_workflow(row["status"]),
                current_workflow_id=str(row["id"]),
                latest_workflow_step=row["current_step"],
                latest_workflow_status=row["status"],
            )
        return WorkflowRunResponse(**row)

    def list_workflow_runs(
        self,
        workflow_type: str | None = None,
        project_id: str | None = None,
        workshop_id: str | None = None,
    ) -> WorkflowRunListResponse:
        if project_id is not None:
            self._ensure_project_exists(project_id)
        if workshop_id is not None:
            self._ensure_workshop_exists(workshop_id)
        rows = self.workflow_repository.list_workflows(workflow_type, project_id, workshop_id)
        return WorkflowRunListResponse(workflows=[WorkflowRunResponse(**row) for row in rows])

    def get_workflow_run(self, workflow_id: str) -> WorkflowRunResponse:
        row = self.workflow_repository.get_workflow(workflow_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")
        return WorkflowRunResponse(**row)

    def update_workflow_run(self, workflow_id: str, payload: WorkflowRunUpdateRequest) -> WorkflowRunResponse:
        workshop_row = None
        if payload.project_id is not None:
            self._ensure_project_exists(str(payload.project_id))
        if payload.workshop_id is not None:
            workshop_row = self._get_workshop_required(str(payload.workshop_id))
            if payload.project_id is not None and str(payload.project_id) != str(workshop_row["project_id"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workflow project_id must match the workshop's project_id.",
                )
        row = self.workflow_repository.update_workflow(
            workflow_id,
            project_id=str(payload.project_id) if payload.project_id is not None else None,
            workshop_id=str(payload.workshop_id) if payload.workshop_id is not None else None,
            title=payload.title,
            source_provider=payload.source_provider,
            source_resource_id=payload.source_resource_id,
            source_resource_name=payload.source_resource_name,
            current_step=payload.current_step,
            status=payload.status,
            state_payload=payload.state_payload,
        )
        if row.get("workshop_id"):
            self.workshop_repository.update_workshop(
                str(row["workshop_id"]),
                status=self._resolve_workshop_status_from_workflow(row["status"]),
                current_workflow_id=str(row["id"]),
                latest_workflow_step=row["current_step"],
                latest_workflow_status=row["status"],
            )
        return WorkflowRunResponse(**row)

    def create_project(self, payload: ProjectCreateRequest) -> ProjectResponse:
        row = self.project_repository.create_project(
            name=payload.name,
            slug=payload.slug,
            description=payload.description,
            status=payload.status,
        )
        project = self.project_repository.get_project(str(row["id"]))
        if project is None:
            raise RuntimeError("Project lookup failed after create.")
        return ProjectResponse(**project)

    def list_projects(self, status: str | None = None) -> ProjectListResponse:
        rows = self.project_repository.list_projects(status)
        return ProjectListResponse(projects=[ProjectSummary(**row) for row in rows])

    def get_project(self, project_id: str) -> ProjectResponse:
        row = self.project_repository.get_project(project_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        return ProjectResponse(**row)

    def update_project(self, project_id: str, payload: ProjectUpdateRequest) -> ProjectResponse:
        self._ensure_project_exists(project_id)
        row = self.project_repository.update_project(
            project_id,
            name=payload.name,
            slug=payload.slug,
            description=payload.description,
            status=payload.status,
        )
        return ProjectResponse(**row)

    def create_workshop_record(self, payload: WorkshopCreateRequest) -> WorkshopResponse:
        self._ensure_project_exists(str(payload.project_id))
        row = self.workshop_repository.create_workshop(
            project_id=str(payload.project_id),
            title=payload.title,
            status=payload.status,
            source_provider=payload.source_provider,
            source_resource_id=payload.source_resource_id,
            source_resource_name=payload.source_resource_name,
            source_url=payload.source_url,
            transcript=payload.transcript,
            notes=payload.notes,
            source_payload=payload.source_payload,
            insights_payload=payload.insights_payload,
            journey_payload=payload.journey_payload,
            import_meta=payload.import_meta,
        )
        return WorkshopResponse(**row)

    def list_workshops(self, project_id: str | None = None, status_filter: str | None = None) -> WorkshopListResponse:
        if project_id is not None:
            self._ensure_project_exists(project_id)
        rows = self.workshop_repository.list_workshops(project_id, status_filter)
        return WorkshopListResponse(workshops=[WorkshopSummary(**row) for row in rows])

    def get_workshop(self, workshop_id: str) -> WorkshopResponse:
        row = self._get_workshop_required(workshop_id)
        return WorkshopResponse(**row)

    def update_workshop(self, workshop_id: str, payload: WorkshopUpdateRequest) -> WorkshopResponse:
        self._ensure_workshop_exists(workshop_id)
        row = self.workshop_repository.update_workshop(
            workshop_id,
            title=payload.title,
            status=payload.status,
            source_provider=payload.source_provider,
            source_resource_id=payload.source_resource_id,
            source_resource_name=payload.source_resource_name,
            source_url=payload.source_url,
            transcript=payload.transcript,
            notes=payload.notes,
            source_payload=payload.source_payload,
            insights_payload=payload.insights_payload,
            journey_payload=payload.journey_payload,
            import_meta=payload.import_meta,
            current_workflow_id=str(payload.current_workflow_id) if payload.current_workflow_id is not None else None,
            latest_workflow_step=payload.latest_workflow_step,
            latest_workflow_status=payload.latest_workflow_status,
        )
        return WorkshopResponse(**row)

    def create_skill(self, payload: SkillCreateRequest) -> SkillResponse:
        row = self.skill_repository.create_skill(
            name=payload.name,
            slug=payload.slug,
            skill_type=payload.skill_type,
            description=payload.description,
            is_active=payload.is_active,
            instructions=payload.instructions,
            required_sections=payload.required_sections,
            quality_bar=payload.quality_bar,
            integration_notes=payload.integration_notes,
        )
        return SkillResponse(**row)

    def list_skills(self, skill_type: str | None = None, active_only: bool | None = None) -> SkillListResponse:
        rows = self.skill_repository.list_skills(skill_type, active_only)
        return SkillListResponse(skills=[SkillSummary(**row) for row in rows])

    def get_skill(self, skill_id: str) -> SkillResponse:
        row = self.skill_repository.get_skill(skill_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found.")
        return SkillResponse(**row)

    def update_skill(self, skill_id: str, payload: SkillUpdateRequest) -> SkillResponse:
        if self.skill_repository.get_skill(skill_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found.")
        row = self.skill_repository.update_skill(
            skill_id,
            name=payload.name,
            slug=payload.slug,
            skill_type=payload.skill_type,
            description=payload.description,
            is_active=payload.is_active,
            instructions=payload.instructions,
            required_sections=payload.required_sections,
            quality_bar=payload.quality_bar,
            integration_notes=payload.integration_notes,
        )
        return SkillResponse(**row)

    def get_dashboard_summary(self) -> DashboardSummaryResponse:
        workshop_rows = self.workshop_repository.list_workshops()
        rows = self.workflow_repository.list_workflows("workshop")
        feature_rows = self.project_feature_repository.list_features()
        story_rows = self.project_story_repository.list_stories()

        workshops = len(workshop_rows)
        active_flows = sum(1 for row in rows if row.get("status") in {"active", "draft"})
        initiatives = 0
        features = len(feature_rows)
        ready_stories = len(story_rows)

        for row in rows:
            state_payload = row.get("state_payload") or {}
            artifacts = ((state_payload.get("artifact_pipeline_data") or {}).get("artifacts") or [])
            stories = ((state_payload.get("stories_pipeline_data") or {}).get("stories") or [])

            for artifact in artifacts:
                artifact_type = str(artifact.get("artifact_type", "")).lower()
                if artifact_type == "initiative":
                    initiatives += 1
                elif artifact_type == "feature":
                    features += 1

            ready_stories += len(stories)

        return DashboardSummaryResponse(
            workshops=workshops,
            initiatives=initiatives,
            features=features,
            ready_stories=ready_stories,
            active_flows=active_flows,
        )

    def create_project_feature(self, payload: ProjectFeatureCreateRequest) -> ProjectFeatureResponse:
        self._ensure_project_exists(str(payload.project_id))
        row = self.project_feature_repository.create_feature(
            project_id=str(payload.project_id),
            source_type=payload.source_type,
            source_title=payload.source_title,
            source_summary=payload.source_summary,
            source_details=payload.source_details,
            desired_outcome=payload.desired_outcome,
            constraints=payload.constraints,
            supporting_context=payload.supporting_context,
            status=payload.status,
            generator_type=payload.generator_type,
            skill_id=str(payload.skill_id) if payload.skill_id is not None else None,
            skill_name=payload.skill_name,
            title=payload.title,
            summary=payload.summary,
            body=payload.body,
            jira_issue_key=payload.jira_issue_key,
            jira_issue_url=payload.jira_issue_url,
            jira_issue_type=payload.jira_issue_type,
        )
        return ProjectFeatureResponse(**row)

    def create_project_story(self, payload: ProjectStoryCreateRequest) -> ProjectStoryResponse:
        self._ensure_project_exists(str(payload.project_id))
        if payload.source_feature_id is not None:
            self._ensure_project_feature_exists(str(payload.source_feature_id), str(payload.project_id))
        row = self.project_story_repository.create_story(
            project_id=str(payload.project_id),
            source_type=payload.source_type,
            source_feature_id=str(payload.source_feature_id) if payload.source_feature_id is not None else None,
            status=payload.status,
            generator_type=payload.generator_type,
            skill_id=str(payload.skill_id) if payload.skill_id is not None else None,
            skill_name=payload.skill_name,
            title=payload.title,
            user_story=payload.user_story,
            as_a=payload.as_a,
            i_want=payload.i_want,
            so_that=payload.so_that,
            description=payload.description,
            acceptance_criteria=payload.acceptance_criteria,
            edge_cases=payload.edge_cases,
            dependencies=payload.dependencies,
            priority=payload.priority,
            jira_issue_key=payload.jira_issue_key,
            jira_issue_url=payload.jira_issue_url,
            jira_issue_type=payload.jira_issue_type,
        )
        return ProjectStoryResponse(**row)

    def list_project_features(self, project_id: str | None = None, status: str | None = None) -> ProjectFeatureListResponse:
        if project_id is not None:
            self._ensure_project_exists(project_id)
        rows = self.project_feature_repository.list_features(project_id, status)
        return ProjectFeatureListResponse(features=[ProjectFeatureSummary(**row) for row in rows])

    def list_project_stories(
        self,
        project_id: str | None = None,
        source_feature_id: str | None = None,
        status: str | None = None,
    ) -> ProjectStoryListResponse:
        if project_id is not None:
            self._ensure_project_exists(project_id)
        if source_feature_id is not None:
            self._ensure_project_feature_exists(source_feature_id, project_id)
        rows = self.project_story_repository.list_stories(project_id, source_feature_id, status)
        return ProjectStoryListResponse(stories=[ProjectStorySummary(**row) for row in rows])

    def get_project_feature(self, feature_id: str) -> ProjectFeatureResponse:
        row = self.project_feature_repository.get_feature(feature_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project feature not found.")
        return ProjectFeatureResponse(**row)

    def get_project_story(self, story_id: str) -> ProjectStoryResponse:
        row = self.project_story_repository.get_story(story_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project story not found.")
        return ProjectStoryResponse(**row)

    def update_project_feature(self, feature_id: str, payload: ProjectFeatureUpdateRequest) -> ProjectFeatureResponse:
        if self.project_feature_repository.get_feature(feature_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project feature not found.")
        row = self.project_feature_repository.update_feature(
            feature_id,
            source_type=payload.source_type,
            source_title=payload.source_title,
            source_summary=payload.source_summary,
            source_details=payload.source_details,
            desired_outcome=payload.desired_outcome,
            constraints=payload.constraints,
            supporting_context=payload.supporting_context,
            status=payload.status,
            generator_type=payload.generator_type,
            skill_id=str(payload.skill_id) if payload.skill_id is not None else None,
            skill_name=payload.skill_name,
            title=payload.title,
            summary=payload.summary,
            body=payload.body,
            jira_issue_key=payload.jira_issue_key,
            jira_issue_url=payload.jira_issue_url,
            jira_issue_type=payload.jira_issue_type,
        )
        return ProjectFeatureResponse(**row)

    def update_project_story(self, story_id: str, payload: ProjectStoryUpdateRequest) -> ProjectStoryResponse:
        current = self.project_story_repository.get_story(story_id)
        if current is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project story not found.")
        if payload.source_feature_id is not None:
            self._ensure_project_feature_exists(str(payload.source_feature_id), str(current["project_id"]))
        row = self.project_story_repository.update_story(
            story_id,
            source_type=payload.source_type,
            source_feature_id=str(payload.source_feature_id) if payload.source_feature_id is not None else None,
            status=payload.status,
            generator_type=payload.generator_type,
            skill_id=str(payload.skill_id) if payload.skill_id is not None else None,
            skill_name=payload.skill_name,
            title=payload.title,
            user_story=payload.user_story,
            as_a=payload.as_a,
            i_want=payload.i_want,
            so_that=payload.so_that,
            description=payload.description,
            acceptance_criteria=payload.acceptance_criteria,
            edge_cases=payload.edge_cases,
            dependencies=payload.dependencies,
            priority=payload.priority,
            jira_issue_key=payload.jira_issue_key,
            jira_issue_url=payload.jira_issue_url,
            jira_issue_type=payload.jira_issue_type,
        )
        return ProjectStoryResponse(**row)

    def _ensure_project_exists(self, project_id: str) -> None:
        if self.project_repository.get_project(project_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    def _ensure_project_feature_exists(self, feature_id: str, project_id: str | None = None) -> dict:
        row = self.project_feature_repository.get_feature(feature_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project feature not found.")
        if project_id is not None and str(row["project_id"]) != str(project_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project feature does not belong to the specified project.")
        return row

    def _ensure_workshop_exists(self, workshop_id: str) -> None:
        if self.workshop_repository.get_workshop(workshop_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workshop not found.")

    def _get_workshop_required(self, workshop_id: str) -> dict:
        row = self.workshop_repository.get_workshop(workshop_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workshop not found.")
        return row

    def _get_active_feature_spec_skill(self) -> dict:
        return self.skill_repository.get_active_skill("feature_spec") or default_feature_spec_skill()

    def _get_active_story_spec_skill(self) -> dict:
        return self.skill_repository.get_active_skill("story_spec") or default_story_spec_skill()

    def _resolve_workshop_status_from_workflow(self, workflow_status: str | None) -> str | None:
        if workflow_status == "completed":
            return "completed"
        if workflow_status in {"active", "running"}:
            return "active"
        if workflow_status == "draft":
            return "draft"
        return None

    def generate_features(self, payload: FeatureGenerateRequest) -> FeatureGenerateResponse:
        features = [
            Feature(
                title=f"{initiative.title} Workspace",
                description=f"Workflow support for {initiative.description.lower()}",
                business_value="Reduces PM effort and improves requirement quality.",
                initiative_title=initiative.title,
            )
            for initiative in payload.initiatives
        ]
        return FeatureGenerateResponse(features=features)

    def run_feature_generator(self, payload: FeatureGeneratorRequest) -> FeatureGeneratorResponse:
        self._ensure_project_exists(str(payload.project_id))
        if not self.feature_generation_llm_service.enabled:
            raise RuntimeError("AI feature generation is unavailable. Configure the OpenAI API key and retry.")
        active_skill = self._get_active_feature_spec_skill()
        try:
            feature = self.feature_generation_llm_service.generate(
                payload,
                skill=active_skill,
            )
        except Exception as exc:
            self.logger.exception("AI feature generation failed")
            raise RuntimeError("AI feature generation failed. Please retry.") from exc
        persisted = self.project_feature_repository.create_feature(
            project_id=str(payload.project_id),
            source_type=payload.source_type,
            source_title=payload.source_title,
            source_summary=payload.source_summary,
            source_details=payload.source_details,
            desired_outcome=payload.desired_outcome,
            constraints=payload.constraints,
            supporting_context=payload.supporting_context,
            status=feature.status,
            generator_type="feature_generator",
            skill_id=str(active_skill.get("id")) if active_skill.get("id") else None,
            skill_name=active_skill.get("name"),
            title=feature.title,
            summary=feature.summary,
            body=feature.body,
        )
        feature = feature.model_copy(update={"feature_id": str(persisted["id"])})
        return FeatureGeneratorResponse(feature=feature)

    def run_story_generator(self, payload: StoryGeneratorRequest) -> StoryGeneratorResponse:
        self._ensure_project_exists(str(payload.project_id))
        source_feature = self._ensure_project_feature_exists(str(payload.source_feature_id), str(payload.project_id))
        if not self.story_generation_llm_service.enabled:
            raise RuntimeError("AI story generation is unavailable. Configure the OpenAI API key and retry.")
        active_skill = self._get_active_story_spec_skill()
        try:
            stories = self.story_generation_llm_service.generate(
                payload,
                ProjectFeatureResponse(**source_feature),
                skill=active_skill,
            )
        except Exception as exc:
            self.logger.exception("AI story generation failed")
            raise RuntimeError("AI story generation failed. Please retry.") from exc

        persisted = []
        for story in stories:
            row = self.project_story_repository.create_story(
                project_id=str(payload.project_id),
                source_type=payload.source_type,
                source_feature_id=str(payload.source_feature_id),
                status=story.status,
                generator_type="story_generator",
                skill_id=str(active_skill.get("id")) if active_skill.get("id") else None,
                skill_name=active_skill.get("name"),
                title=story.title,
                user_story=story.user_story,
                as_a=story.as_a,
                i_want=story.i_want,
                so_that=story.so_that,
                description=story.description,
                acceptance_criteria=story.acceptance_criteria,
                edge_cases=story.edge_cases,
                dependencies=story.dependencies,
                priority=story.priority,
            )
            persisted.append(story.model_copy(update={"story_id": str(row["id"])}))
        return StoryGeneratorResponse(stories=persisted)

    def generate_prd(self, payload: PRDGenerateRequest) -> PRDGenerateResponse:
        prd = PRDDocument(
            overview=f"PRD for {payload.feature.title}",
            problem="Product teams need a consistent, fast way to define work from raw inputs.",
            solution=payload.feature.description,
            scope=["Generate a lightweight product definition", "Support human editing"],
            assumptions=["Workshop insights are already approved", "Jira export remains optional"],
        )
        return PRDGenerateResponse(prd=prd)

    def generate_stories(self, payload: StoryGenerateRequest) -> StoryGenerateResponse:
        stories = [
            StoryArtifact(
                title=f"As a PM, I can review {payload.feature.title.lower()} output",
                description="Display generated feature artifacts for validation before export.",
                acceptance_criteria=[
                    "Generated artifacts are visible",
                    "User can review and edit content",
                ],
                edge_cases=["Generated content is incomplete"],
                priority="high",
            ),
            StoryArtifact(
                title=f"As a PM, I can export {payload.feature.title.lower()} artifacts",
                description="Send finalized stories to delivery systems.",
                acceptance_criteria=[
                    "Stories can be selected for export",
                    "Export response returns issue references",
                ],
                edge_cases=["Third-party export fails"],
                priority="medium",
            ),
        ]
        return StoryGenerateResponse(stories=stories)

    def refine_stories(self, payload: StoryRefineRequest) -> StoryRefineResponse:
        refined = []
        for story in payload.stories:
            description = story.description
            if not description.endswith("."):
                description = f"{description}."
            refined.append(story.model_copy(update={"description": description}))
        return StoryRefineResponse(stories=refined)

    def slice_stories(self, payload: StorySliceRequest) -> StorySliceResponse:
        sliced = []
        for story in payload.stories:
            sliced.append(story)
            if len(story.acceptance_criteria) > 1:
                sliced.append(
                    story.model_copy(
                        update={
                            "title": f"{story.title} - API slice",
                            "description": "Backend/API implementation slice.",
                            "acceptance_criteria": story.acceptance_criteria[:1],
                        }
                    )
                )
        return StorySliceResponse(stories=sliced)

    def push_to_jira(self, payload: JiraPushRequest) -> JiraPushResponse:
        project_key = payload.project_key or "DEMO"
        issues = [
            JiraPushResult(
                story_title=story.title,
                issue_key=f"{project_key}-{index}",
                issue_url=f"https://jira.example.com/browse/{project_key}-{index}",
            )
            for index, story in enumerate(payload.stories, start=1)
        ]
        return JiraPushResponse(issues=issues)

    def _collect_evidence(
        self, payload: OpportunitySynthesizeRequest
    ) -> dict[str, list[OpportunityEvidence]]:
        evidence_by_category = {
            "experience_steps": [],
            "interactions": [],
            "goals_and_motivations": [],
            "positive_moments": [],
            "negative_moments": [],
            "areas_of_opportunity": [],
        }
        seen: set[tuple[str, str, str]] = set()

        if payload.journey:
            for stage_data in payload.journey.stages:
                for category, items in stage_data.categories.model_dump().items():
                    for item in items:
                        key = (category, item.strip().lower(), stage_data.stage)
                        if not item or key in seen:
                            continue
                        seen.add(key)
                        evidence_by_category.setdefault(category, []).append(
                            OpportunityEvidence(text=item, category=category, stage=stage_data.stage)
                        )

        if payload.insights:
            category_map = {
                "pain_points": "negative_moments",
                "opportunities": "areas_of_opportunity",
                "action_items": "interactions",
            }
            for insight_key, category in category_map.items():
                for item in getattr(payload.insights, insight_key, []):
                    key = (category, item.strip().lower(), "")
                    if not item or key in seen:
                        continue
                    seen.add(key)
                    evidence_by_category.setdefault(category, []).append(
                        OpportunityEvidence(text=item, category=category)
                    )

        return evidence_by_category

    def _fallback_opportunities(
        self,
        payload: OpportunitySynthesizeRequest,
        pain_points: list[OpportunityEvidence],
        interactions: list[OpportunityEvidence],
        goals: list[OpportunityEvidence],
        experience_steps: list[OpportunityEvidence],
    ) -> list[OpportunityCandidate]:
        opportunities: list[OpportunityCandidate] = []
        source_pains = pain_points or [
            OpportunityEvidence(text=item, category="negative_moments")
            for item in (payload.insights.pain_points if payload.insights else [])
        ]

        for index, pain in enumerate(source_pains[:3], start=1):
            supporting = [pain]
            supporting.extend(interactions[:1])
            supporting.extend(goals[:1])
            supporting.extend(experience_steps[:1])
            opportunities.append(
                OpportunityCandidate(
                    id=f"opp_{index}",
                    title=f"Address {self._title_from_text(pain.text)}",
                    problem_statement=f"Users are blocked by {pain.text.lower()}.",
                    why_it_matters=(
                        "Reducing this friction will improve conversion and make the experience feel more reliable."
                    ),
                    confidence=self._score_confidence(supporting),
                    impact="high",
                    evidence=self._dedupe_evidence(supporting),
                )
            )
        return opportunities

    def _title_from_text(self, text: str) -> str:
        cleaned = text.strip().rstrip(".")
        if "(" in cleaned:
            cleaned = cleaned.split("(", 1)[0].strip()
        if not cleaned:
            return "Untitled opportunity"
        if len(cleaned) <= 60:
            return cleaned[0].upper() + cleaned[1:]
        return " ".join(cleaned.split()[:7]).strip()

    def _build_why_it_matters(
        self,
        paired_pain: OpportunityEvidence | None,
        opportunity: OpportunityEvidence,
        goals: list[OpportunityEvidence],
        positive_moments: list[OpportunityEvidence],
        stage: str | None,
    ) -> str:
        parts = []
        if paired_pain is not None:
            parts.append(f"it addresses {paired_pain.text.lower()}")
        if goals:
            parts.append(f"supports the user goal of {goals[0].text.lower()}")
        if positive_moments:
            parts.append(f"while preserving {positive_moments[0].text.lower()}")
        if stage:
            parts.append(f"at the {stage} stage")
        if not parts:
            return f"It creates a practical path to improve {opportunity.text.lower()}."
        return parts[0].capitalize() + (", " + ", ".join(parts[1:]) if len(parts) > 1 else "") + "."

    def _score_confidence(self, evidence: list[OpportunityEvidence]) -> int:
        score = 62 + min(len(self._dedupe_evidence(evidence)) * 8, 28)
        if any(item.category == "areas_of_opportunity" for item in evidence):
            score += 6
        return min(score, 96)

    def _score_impact(
        self,
        paired_pain: OpportunityEvidence | None,
        opportunity: OpportunityEvidence,
    ) -> str:
        text = f"{paired_pain.text if paired_pain else ''} {opportunity.text}".lower()
        if any(keyword in text for keyword in ("price", "alternative", "delay", "drop", "friction", "urgent", "trust")):
            return "high"
        if any(keyword in text for keyword in ("suggest", "notify", "guide", "simplify", "speed")):
            return "medium"
        return "low"

    def _dedupe_evidence(self, evidence: list[OpportunityEvidence]) -> list[OpportunityEvidence]:
        deduped: list[OpportunityEvidence] = []
        seen: set[tuple[str, str, str]] = set()
        for item in evidence:
            key = (item.category, item.text.strip().lower(), item.stage or "")
            if not item.text or key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped

    def _fallback_shaped_solution(self, opportunity: OpportunityCandidate) -> ShapedSolution:
        recommended_type = self._infer_solution_type(opportunity)
        return ShapedSolution(
            id=f"shaped-{opportunity.id or '0'}",
            derived_from_opportunity_id=opportunity.id or "opp_0",
            recommended_type=recommended_type,
            title=opportunity.title,
            problem_statement=opportunity.problem_statement,
            rationale=self._build_solution_rationale(opportunity, recommended_type),
            scope=self._build_solution_scope(opportunity, recommended_type),
        )

    def _infer_solution_type(self, opportunity: OpportunityCandidate) -> str:
        text = f"{opportunity.title} {opportunity.problem_statement} {opportunity.why_it_matters}".lower()
        if any(keyword in text for keyword in ("platform", "ecosystem", "portfolio", "cross-functional", "multi-team", "program")):
            return "Initiative"
        if any(keyword in text for keyword in ("engine", "service", "system", "journey", "strategy")) and opportunity.impact == "high":
            return "Initiative"
        if any(keyword in text for keyword in ("enhance", "improve", "optimize", "timing", "copy", "tune")):
            return "Enhancement"
        if opportunity.impact == "low":
            return "Enhancement"
        return "Feature"

    def _build_solution_rationale(self, opportunity: OpportunityCandidate, recommended_type: str) -> str:
        if recommended_type == "Initiative":
            return "This appears broad enough to span multiple features or teams, so it is better framed as an initiative than a single deliverable."
        if recommended_type == "Enhancement":
            return "This looks like an improvement to an existing capability rather than a standalone net-new feature."
        if recommended_type == "No action":
            return "This opportunity should be deferred until there is stronger evidence or a clearer path to execution."
        return "This is scoped tightly enough to be delivered as a discrete user-facing feature without forcing unnecessary initiative hierarchy."

    def _build_solution_scope(self, opportunity: OpportunityCandidate, recommended_type: str) -> str:
        if recommended_type == "Initiative":
            return "Large - multi-quarter, multi-feature effort"
        if recommended_type == "Enhancement":
            return "Small - targeted improvement in 1-2 sprints"
        if opportunity.impact == "high":
            return "Medium - 2-4 sprints"
        return "Small - 1-2 sprints"

    def _fallback_generated_artifact(
        self,
        item: ShapedSolution,
        index: int,
    ) -> GeneratedArtifact:
        artifact_type = (item.chosen_type or item.recommended_type or "Feature").lower()
        if artifact_type == "initiative":
            body = {
                "desired_outcome": f"Deliver a measurable improvement against {item.title.lower()}.",
                "success_metrics": [
                    "Improved conversion or engagement on the targeted journey",
                    "Clear downstream feature scope agreed by PM and engineering",
                ],
                "scope": {
                    "in_scope": [
                        "Cross-functional planning for the targeted problem area",
                        "Prioritized feature candidates and execution framing",
                    ],
                    "out_of_scope": ["Full rollout planning for unrelated journeys"],
                },
                "assumptions": [item.rationale] if item.rationale else [],
                "risks": ["Scope may be too broad without a clear first release cut"],
                "priority": "high",
            }
        elif artifact_type == "enhancement":
            body = {
                "current_capability": item.title,
                "current_issue": item.problem_statement,
                "proposed_improvement": item.rationale or f"Improve the existing {item.title.lower()} experience.",
                "expected_impact": "Reduced friction in the targeted user flow.",
                "affected_surfaces": ["Existing product experience"],
                "priority": "medium",
            }
        else:
            artifact_type = "feature"
            body = {
                "problem_statement": item.problem_statement,
                "user_problem": item.problem_statement,
                "user_segment": "Primary journey user",
                "proposed_solution": item.rationale or f"Introduce a bounded capability for {item.title.lower()}.",
                "solution_overview": item.rationale or f"Introduce a bounded capability for {item.title.lower()}.",
                "functional_requirements": [
                    f"Support the core {item.title.lower()} workflow",
                    "Provide visible feedback for success and failure states",
                ],
                "non_functional_requirements": [
                    "Instrumentation for adoption and conversion",
                    "Responsive behavior across supported surfaces",
                ],
                "user_value": "Helps users complete the journey with less effort.",
                "business_value": "Turns validated opportunity evidence into a scoped deliverable.",
                "dependencies": ["Design review", "Engineering sizing"],
                "success_metrics": [
                    "Adoption of the feature in the target journey",
                    "Improved conversion or reduced friction for the targeted step",
                ],
                "priority": "medium",
            }
        return GeneratedArtifact(
            artifact_id=f"artifact_{index}",
            artifact_type=artifact_type,
            derived_from_solution_id=item.id or f"shaped-{index}",
            status="draft",
            title=item.title,
            summary=item.problem_statement,
            body=body,
        )

    def _fallback_slice_for_artifact(self, artifact: GeneratedArtifact) -> list[StoryDraft]:
        artifact_title = artifact.title
        base = artifact.artifact_id
        role = self._fallback_infer_role(artifact)
        task = self._fallback_infer_task(artifact)
        outcome = self._fallback_infer_outcome(artifact)
        return [
            StoryDraft(
                story_id=f"{base}_story_1",
                derived_from_artifact_id=artifact.artifact_id,
                status="draft",
                title=f"Deliver the user-facing flow for {artifact_title}",
                user_story=f"As a {role}, I want to {task}, so that {outcome}.",
                as_a=role,
                i_want=f"to {task}",
                so_that=outcome,
                description=f"Implement the primary user-facing workflow for {artifact_title.lower()}, including the visible states and feedback needed for a {role} to {task}.",
                acceptance_criteria=[
                    f"Users can {task} in the intended user surface",
                    "Success, empty, and failure states are handled clearly",
                    "The visible interface supports the intended decision or action with concrete prompts or choices",
                ],
                edge_cases=["User abandons the flow midway"],
                dependencies=["Design alignment"],
                priority="high",
            ),
            StoryDraft(
                story_id=f"{base}_story_2",
                derived_from_artifact_id=artifact.artifact_id,
                status="draft",
                title=f"Implement supporting service and logic for {artifact_title}",
                user_story="As a platform stakeholder, I want the supporting service and business logic to be reliable, so that the feature behaves consistently in production.",
                as_a="platform stakeholder",
                i_want="the supporting service and business logic to be reliable",
                so_that="the feature behaves consistently in production",
                description=f"Implement the backend or business-logic slice needed for {artifact_title.lower()}, including interfaces, validation, and fallback behavior.",
                acceptance_criteria=[
                    "Core business logic is implemented behind a stable interface or API",
                    "Input and output contracts are defined and validated",
                    "Fallback behavior exists for invalid, missing, or low-confidence inputs",
                ],
                edge_cases=["Required upstream data is missing or delayed"],
                dependencies=["Engineering design", "Interface contract review"],
                priority="medium",
            ),
            StoryDraft(
                story_id=f"{base}_story_3",
                derived_from_artifact_id=artifact.artifact_id,
                status="draft",
                title=f"Instrument and operationalize {artifact_title}",
                user_story="As a product and engineering team member, I want measurement and operational readiness, so that we can release safely and learn from usage.",
                as_a="product and engineering team member",
                i_want="measurement and operational readiness",
                so_that="we can release safely and learn from usage",
                description=f"Add analytics, monitoring, and rollout support for {artifact_title.lower()}.",
                acceptance_criteria=[
                    "Key adoption and outcome events are tracked",
                    "Operational health checks exist for release confidence",
                    "Rollout or release safeguards are defined when relevant",
                ],
                edge_cases=["Telemetry or monitoring coverage is missing for a subset of flows"],
                dependencies=["Analytics schema", "QA validation"],
                priority="medium",
            ),
        ]

    def _fallback_infer_role(self, artifact: GeneratedArtifact) -> str:
        lowered = " ".join([artifact.title.lower(), artifact.summary.lower()])
        for token in ["buyer", "customer", "shopper", "rider", "commuter", "traveler", "admin", "operator"]:
            if token in lowered:
                return token
        return "user"

    def _fallback_infer_task(self, artifact: GeneratedArtifact) -> str:
        body = artifact.body or {}
        candidate = (
            body.get("proposed_solution")
            or body.get("solution_overview")
            or body.get("problem_statement")
            or artifact.summary
            or artifact.title
        )
        text = str(candidate).strip().rstrip(".")
        if not text:
            return f"use {artifact.title.lower()}"
        normalized = text[0].lower() + text[1:] if len(text) > 1 else text.lower()
        return normalized[3:] if normalized.startswith("to ") else normalized

    def _fallback_infer_outcome(self, artifact: GeneratedArtifact) -> str:
        body = artifact.body or {}
        candidate = body.get("user_value") or body.get("business_value") or artifact.summary or ""
        text = str(candidate).strip().rstrip(".")
        if not text:
            return "the task becomes faster and easier to complete"
        return text[0].lower() + text[1:] if len(text) > 1 else text.lower()
