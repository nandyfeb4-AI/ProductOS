const TABS = [
  { label: "Portfolio", view: "dashboard" },
  { label: "Backlog",   view: "backlog"   },
  { label: "Sprints",   view: "sprints"   },
  { label: "Roadmap",   view: "roadmap"   },
];

export default function Topbar({ activeView, onNavigate }) {
  return (
    <header className="fixed top-0 right-0 left-20 z-40 bg-white/90 backdrop-blur-md border-b border-outline font-headline text-sm">
      <div className="flex justify-between items-center w-full px-8 py-3">

        {/* Left: search + tabs */}
        <div className="flex items-center gap-10 flex-1">
          {/* Search */}
          <div className="relative w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search strategy or stories..."
              className="w-full bg-surface-container border border-outline focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2 pl-10 rounded-md text-on-surface placeholder-on-surface-variant outline-none transition-all"
            />
          </div>

          {/* Tab nav */}
          <nav className="flex items-center gap-8">
            {TABS.map(({ label, view }) => {
              const isActive = activeView === view || (view === "dashboard" && activeView === "dashboard");
              return (
                <button
                  key={view}
                  onClick={() => onNavigate(view)}
                  className={[
                    "font-medium transition-colors duration-200 pb-1",
                    isActive
                      ? "text-primary font-semibold border-b-2 border-primary"
                      : "text-on-surface-variant hover:text-on-surface",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: icons + avatar */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <button className="hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[20px]">smart_toy</span>
            </button>
            <button className="hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            <button className="hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
          </div>
          <div className="h-5 w-px bg-outline" />
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold border border-outline">
            R
          </div>
        </div>

      </div>
    </header>
  );
}
