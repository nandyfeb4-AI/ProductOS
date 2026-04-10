from uuid import uuid4

from app.schemas.common import InsightBundle, StoryArtifact
from app.schemas.feature import Feature, FeatureGenerateRequest, FeatureGenerateResponse
from app.schemas.initiative import Initiative, InitiativeGenerateRequest, InitiativeGenerateResponse
from app.schemas.jira import JiraPushRequest, JiraPushResponse, JiraPushResult
from app.schemas.prd import PRDDocument, PRDGenerateRequest, PRDGenerateResponse
from app.schemas.story import (
    StoryGenerateRequest,
    StoryGenerateResponse,
    StoryRefineRequest,
    StoryRefineResponse,
    StorySliceRequest,
    StorySliceResponse,
)
from app.schemas.workshop import WorkshopAnalyzeRequest, WorkshopAnalyzeResponse


class PipelineService:
    """Temporary MVP scaffolding for the stepwise PM generation pipeline."""

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

