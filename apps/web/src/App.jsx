import { useCallback, useEffect, useState } from "react";
import AppShell              from "./components/layout/AppShell";
import Dashboard             from "./pages/Dashboard";
import JiraOAuthCallback     from "./pages/JiraOAuthCallback";
import MuralOAuthCallback    from "./pages/MuralOAuthCallback";
import WorkshopIntelligence  from "./pages/WorkshopIntelligence";
import OpportunityValidation from "./pages/OpportunityValidation";
import SolutionShaping       from "./pages/SolutionShaping";
import ArtifactGeneration    from "./pages/ArtifactGeneration";
import StorySlicing          from "./pages/StorySlicing";
import JiraExport            from "./pages/JiraExport";
import Connectors            from "./pages/Connectors";
import WorkflowList          from "./pages/WorkflowList";
import Projects                from "./pages/Projects";
import ProjectDetail           from "./pages/ProjectDetail";
import FeatureGeneratorAgent   from "./pages/FeatureGeneratorAgent";
import Skills                  from "./pages/Skills";
import Placeholder             from "./pages/Placeholder";

// ─── Stable placeholder components (defined outside to keep references stable) ─
const PlaceholderBacklog = () => <Placeholder title="Backlog" />;
const PlaceholderTeam    = () => <Placeholder title="Team" />;
const PlaceholderReports = () => <Placeholder title="Reports" />;

const VIEWS = {
  dashboard:         Dashboard,
  workshop:          WorkshopIntelligence,
  opportunity:       OpportunityValidation,
  shaping:           SolutionShaping,
  artifacts:         ArtifactGeneration,
  stories:           StorySlicing,
  jira:              JiraExport,
  connectors:        Connectors,
  workflows:         WorkflowList,
  projects:          Projects,
  skills:            Skills,
  "project-detail":       ProjectDetail,
  "feature-generator":    FeatureGeneratorAgent,
  backlog:           PlaceholderBacklog,
  team:              PlaceholderTeam,
  reports:           PlaceholderReports,
};

export default function App() {
  const [activeView, setActiveView] = useState(
    () => sessionStorage.getItem("workflow_active_view") ?? "dashboard"
  );
  const [activeProject, setActiveProject] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("active_project") ?? "null"); }
    catch { return null; }
  });
  const [, setLocationNonce] = useState(0);
  const path = window.location.pathname;

  useEffect(() => {
    sessionStorage.setItem("workflow_active_view", activeView);
  }, [activeView]);

  // navigate(view) — standard navigation
  // navigate(view, project) — navigates and sets the active project context
  const handleNavigate = useCallback((view, project) => {
    if (project !== undefined) {
      setActiveProject(project);
      try { sessionStorage.setItem("active_project", JSON.stringify(project)); } catch {}
    }
    setActiveView(view);
  }, []);

  if (path === "/oauth/mural/callback") {
    return <MuralOAuthCallback onDone={() => {
      const origin = localStorage.getItem("oauth_mural_origin") ?? "workshop";
      localStorage.removeItem("oauth_mural_origin");
      handleNavigate(origin);
      setLocationNonce(n => n + 1);
    }} />;
  }

  if (path === "/oauth/jira/callback") {
    return <JiraOAuthCallback onDone={() => {
      const origin = localStorage.getItem("oauth_jira_origin") ?? "connectors";
      localStorage.removeItem("oauth_jira_origin");
      handleNavigate(origin);
      setLocationNonce(n => n + 1);
    }} />;
  }

  // Guard: project-scoped views require an active project — redirect to projects if none
  const PROJECT_SCOPED_VIEWS = new Set(["workshop", "feature-generator"]);
  const resolvedView = (PROJECT_SCOPED_VIEWS.has(activeView) && !activeProject) ? "projects" : activeView;
  const ViewComponent = VIEWS[resolvedView] ?? VIEWS.dashboard;

  return (
    <AppShell activeView={resolvedView} onNavigate={handleNavigate}>
      <ViewComponent onNavigate={handleNavigate} project={activeProject} />
    </AppShell>
  );
}
