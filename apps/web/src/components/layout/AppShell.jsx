import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ activeView, onNavigate, children }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeView={activeView} onNavigate={onNavigate} />
      <Topbar  activeView={activeView} onNavigate={onNavigate} />
      {/* Offset: left-20 for sidebar, pt-[60px] for topbar */}
      <main className="ml-20 pt-[60px] transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
