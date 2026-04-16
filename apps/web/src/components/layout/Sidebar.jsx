const NAV_ITEMS = [
  { icon: "dashboard",   label: "Dashboard",  view: "dashboard"  },
  { icon: "inventory_2", label: "Projects",   view: "projects"   },
  { icon: "psychology",  label: "Skills",     view: "skills"     },
  { icon: "cable",       label: "Connectors", view: "connectors" },
  { icon: "history",     label: "Workflows",  view: "workflows"  },
  { icon: "assignment",  label: "Backlog",    view: "backlog"    },
  { icon: "group",       label: "Team",       view: "team"       },
  { icon: "analytics",   label: "Reports",    view: "reports"    },
];

export default function Sidebar({ activeView, onNavigate }) {
  // Pipeline views are entered from a project — keep Projects highlighted
  const PROJECT_VIEWS = new Set(["project-detail", "workshop", "opportunity", "shaping", "artifacts", "stories", "jira", "feature-generator", "story-generator"]);
  const effectiveView = PROJECT_VIEWS.has(activeView) ? "projects" : activeView;
  return (
    <aside className="group flex flex-col h-screen fixed left-0 top-0 w-20 hover:w-64 transition-all duration-300 ease-in-out bg-sidebar border-r border-slate-800 z-50 overflow-hidden shadow-sidebar">

      {/* Logo */}
      <div className="p-5 pb-0">
        <div className="flex items-center gap-4 mb-10 overflow-hidden whitespace-nowrap">
          <div className="min-w-[32px] w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              architecture
            </span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <h1 className="text-white font-black tracking-tight font-headline text-lg leading-tight">ProductOS</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Enterprise Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="space-y-1">
          {NAV_ITEMS.map(({ icon, label, view }) => {
            const isActive = effectiveView === view;
            return (
              <button
                key={view}
                onClick={() => onNavigate(view)}
                className={[
                  "w-full flex items-center gap-4 px-4 py-3 rounded-md transition-all duration-150 active:scale-95 whitespace-nowrap font-headline text-sm",
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-blue-900/20"
                    : "text-sidebar-text hover:text-white hover:bg-sidebar-hover",
                ].join(" ")}
              >
                <span className="material-symbols-outlined shrink-0 text-[20px]">{icon}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom — user */}
      <div className="mt-auto p-4 border-t border-slate-800 overflow-hidden whitespace-nowrap">
        <div className="flex items-center gap-4 px-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
            R
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">ramki271</p>
            <p className="text-[10px] text-slate-500">Workspace Admin</p>
          </div>
        </div>
      </div>

    </aside>
  );
}
