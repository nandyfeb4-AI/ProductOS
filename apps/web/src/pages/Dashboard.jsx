import { useEffect, useMemo, useState } from "react";
import {
  getDashboardSummary,
  readDashboardSummaryCache,
  writeDashboardSummaryCache,
} from "../api/dashboard";

const AGENTS = [
  {
    icon:   "groups",
    label:  "Workshop Agent",
    sub:    "Monitoring persisted workshop runs",
    status: "LIVE",
    color:  "primary",
    bg:     "bg-blue-50/50 border-l-4 border-primary",
    iconBg: "bg-blue-100 text-primary",
    dot:    "bg-primary animate-pulse",
    text:   "text-primary",
  },
  {
    icon:   "description",
    label:  "PRD Agent",
    sub:    "Idle",
    status: "STANDBY",
    color:  "slate",
    bg:     "bg-slate-50 border-l-4 border-slate-300",
    iconBg: "bg-slate-200/50 text-slate-500",
    dot:    null,
    text:   "text-slate-400",
  },
  {
    icon:   "electric_bolt",
    label:  "Story Agent",
    sub:    "Ready for next slicing request",
    status: "ACTIVE",
    color:  "blue",
    bg:     "bg-blue-50/30 border-l-4 border-blue-400",
    iconBg: "bg-blue-50 text-blue-500",
    dot:    "bg-blue-400",
    text:   "text-blue-500",
  },
];

const INSIGHTS = [
  {
    icon:      "priority_high",
    iconColor: "text-red-500",
    title:     "Checkout latency impacting conversions",
    body:      "AI analysis of 15 customer calls suggests a 40% correlation between high-latency checkout steps and abandoned carts in the EMEA region.",
    score:     "9.4",
    dotColor:  "bg-primary",
    action:    "Define Feature",
  },
  {
    icon:      "lightbulb",
    iconColor: "text-primary",
    title:     "Automated onboarding for enterprise tier",
    body:      "Autonomous discovery detected a recurring pain point in seat allocation workflows. Simplifying this could reduce TTV by 3.5 days.",
    score:     "8.1",
    dotColor:  "bg-blue-400",
    action:    "Draft PRD",
  },
];

const AUDIT = [
  {
    icon:        "description",
    iconColor:   "text-primary",
    borderColor: "border-primary",
    title:       "PRD generated:",
    titleLink:   "Multi-factor Identity",
    meta:        "Story Agent • 12m ago",
    actions:     ["Review Draft", "Compare"],
  },
  {
    icon:        "psychology",
    iconColor:   "text-slate-400",
    borderColor: "border-slate-200",
    title:       "Workshop analysis complete",
    titleLink:   null,
    meta:        "Workshop Agent • Recent",
    actions:     [],
  },
  {
    icon:        "account_tree",
    iconColor:   "text-blue-500",
    borderColor: "border-blue-400/50",
    title:       "Roadmap alignment updated",
    titleLink:   null,
    meta:        "System Core • Recent",
    actions:     [],
  },
];

function SummarySkeleton() {
  return (
    <div className="flex items-center justify-between">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={[
            "flex-1 text-center animate-pulse",
            i < 3 ? "border-r border-slate-100" : "",
          ].join(" ")}
        >
          <div className="h-10 w-16 bg-surface-container rounded mx-auto" />
          <div className="h-3 w-20 bg-surface-container rounded mx-auto mt-3" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [summary, setSummary] = useState(() => readDashboardSummaryCache());
  const [loading, setLoading] = useState(() => !readDashboardSummaryCache());
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!summary) setLoading(true);
    setError(null);
    getDashboardSummary()
      .then((result) => {
        if (!cancelled) {
          setSummary(result);
          writeDashboardSummaryCache(result);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => ([
    { value: String(summary?.workshops ?? 0), label: "Workshops", highlight: false },
    { value: String(summary?.initiatives ?? 0), label: "Initiatives", highlight: false },
    { value: String(summary?.features ?? 0), label: "Features", highlight: false },
    { value: String(summary?.ready_stories ?? 0), label: "Ready Stories", highlight: true },
  ]), [summary]);

  return (
    <div className="px-10 py-12">

      <section className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
            Project Hub
          </h2>
          <p className="text-on-surface-variant font-medium">
            Enterprise intelligence is managing{" "}
            <span className="text-primary font-semibold">
              {summary?.active_flows ?? 0} active flow{(summary?.active_flows ?? 0) === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2 rounded-md border border-outline text-on-surface-variant font-semibold text-sm hover:bg-surface-container transition-colors">
            Export Roadmap
          </button>
          <button
            onClick={() => onNavigate("backlog")}
            className="px-5 py-2 rounded-md bg-primary text-white font-bold text-sm hover:bg-primary-dim transition-all active:scale-95 flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">add_task</span>
            New Initiative
          </button>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8">

        <div className="col-span-12 lg:col-span-8 bg-surface border border-outline rounded-xl p-8 shadow-card">
          <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase mb-10">
            Strategic Alignment
          </h3>

          {error ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              <p className="text-sm text-red-700">
                Couldn’t load live portfolio metrics. The rest of the dashboard is still available.
              </p>
            </div>
          ) : loading ? (
            <SummarySkeleton />
          ) : (
            <div className="flex items-center justify-between">
              {stats.map(({ value, label, highlight }, i) => (
                <div
                  key={label}
                  className={[
                    "flex-1 text-center",
                    i < stats.length - 1 ? "border-r border-slate-100" : "",
                  ].join(" ")}
                >
                  <p className={["text-4xl font-headline font-bold", highlight ? "text-primary" : "text-on-surface"].join(" ")}>
                    {value}
                  </p>
                  <p className="text-[11px] text-on-surface-variant font-bold uppercase mt-2">{label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div className="h-full bg-blue-200 w-[15%]" />
            <div className="h-full bg-blue-300 w-[25%]" />
            <div className="h-full bg-blue-500 w-[40%]" />
            <div className="h-full bg-blue-700 w-[20%]" />
          </div>
          <div className="mt-4 flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <span>Discovery</span>
            <span>Mapping</span>
            <span>Definition</span>
            <span>Execution</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-surface rounded-xl p-6 border border-outline shadow-card">
          <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase mb-8">
            System Agents
          </h3>
          <div className="space-y-4">
            {AGENTS.map(({ icon, label, sub, status, bg, iconBg, dot, text }) => (
              <div key={label} className={`flex items-center gap-4 p-4 rounded-lg ${bg}`}>
                <div className={`w-10 h-10 rounded flex items-center justify-center ${iconBg} shrink-0`}>
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">{label}</p>
                  <p className="text-[11px] text-on-surface-variant">{sub}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  {dot && <span className={`w-2 h-2 rounded-full mb-1 ${dot}`} />}
                  <span className={`text-[10px] font-bold ${text}`}>{status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="bg-surface rounded-xl p-8 border border-outline h-full shadow-card">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase">
                Performance Insights
              </h3>
              <span className="px-2.5 py-1 bg-blue-50 text-[10px] font-bold text-primary rounded border border-blue-100">
                High Priority
              </span>
            </div>
            <div className="space-y-6">
              {INSIGHTS.map(({ icon, iconColor, title, body, score, dotColor, action }) => (
                <div key={title} className="group bg-slate-50/50 hover:bg-slate-50 transition-colors rounded-lg p-6 border border-slate-100">
                  <div className="flex items-start gap-5">
                    <span className={`material-symbols-outlined mt-1 ${iconColor}`}>{icon}</span>
                    <div>
                      <h4 className="font-bold text-on-surface mb-2">{title}</h4>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{body}</p>
                      <div className="mt-5 flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                            Opp Score: {score}
                          </span>
                        </div>
                        <button className="text-xs text-primary font-bold hover:text-primary-dim transition-colors">
                          {action}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="bg-surface rounded-xl p-8 border border-outline h-full shadow-card">
            <h3 className="text-primary font-headline text-xs font-bold tracking-widest uppercase mb-10">
              Audit Log
            </h3>
            <div className="relative space-y-10 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
              {AUDIT.map(({ icon, iconColor, borderColor, title, titleLink, meta, actions }) => (
                <div key={title} className="relative pl-10">
                  <div className={`absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 ${borderColor} flex items-center justify-center z-10`}>
                    <span className={`material-symbols-outlined text-[10px] ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {icon}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-on-surface">
                      {title}{" "}
                      {titleLink && <span className="text-primary">{titleLink}</span>}
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-1">{meta}</p>
                    {actions.length > 0 && (
                      <div className="mt-4 flex gap-2">
                        <button className="text-[10px] font-bold px-3 py-1.5 rounded bg-slate-50 text-on-surface hover:bg-surface-container transition-colors border border-outline">
                          {actions[0]}
                        </button>
                        {actions[1] && (
                          <button className="text-[10px] font-bold px-3 py-1.5 rounded border border-slate-100 text-on-surface-variant hover:text-on-surface transition-colors">
                            {actions[1]}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-12 py-3 rounded border border-outline text-[10px] font-bold text-on-surface-variant hover:text-primary hover:border-blue-200 transition-all uppercase tracking-widest">
              Full Activity History
            </button>
          </div>
        </div>

      </div>

      <div className="fixed bottom-8 right-8">
        <button className="w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-blue-400/20 flex items-center justify-center hover:bg-primary-dim transition-all hover:scale-105 active:scale-95 group">
          <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform">bolt</span>
        </button>
      </div>

    </div>
  );
}
