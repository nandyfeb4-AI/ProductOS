const PIPELINE_STEPS = [
  { id: "workshop",   label: "Workshop",   icon: "groups"               },
  { id: "validation", label: "Validation", icon: "verified"             },
  { id: "shaping",    label: "Shaping",    icon: "transform"            },
  { id: "artifacts",  label: "Artifacts",  icon: "auto_awesome"         },
  { id: "stories",    label: "Stories",    icon: "format_list_bulleted" },
  { id: "jira",       label: "Jira",       icon: "cloud_upload"         },
];

export default function PipelineFlowBar({ currentStep, completedSteps = [], onNavigate }) {
  return (
    <div className="bg-surface border-b border-outline px-10 py-0 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {PIPELINE_STEPS.map((step, i) => {
          const isDone    = completedSteps.includes(step.id);
          const isActive  = step.id === currentStep;
          const isLocked  = !isDone && !isActive;
          const canClick  = isDone && onNavigate;

          return (
            <div key={step.id} className="flex items-center">
              {/* Connector */}
              {i > 0 && (
                <div className={`w-8 h-px mx-1 ${isDone || isActive ? "bg-primary" : "bg-outline"}`} />
              )}

              {/* Step */}
              <button
                onClick={() => canClick && onNavigate(step.id === "validation" ? "opportunity" : step.id)}
                disabled={isLocked}
                className={[
                  "flex items-center gap-2 px-3 py-4 text-[12px] font-semibold transition-colors whitespace-nowrap border-b-2 -mb-px",
                  isActive  ? "text-primary border-primary"                         : "",
                  isDone    ? "text-on-surface-variant border-transparent hover:text-on-surface cursor-pointer" : "",
                  isLocked  ? "text-on-surface-variant/40 border-transparent cursor-not-allowed" : "",
                ].join(" ")}
              >
                {isDone ? (
                  <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 10, fontVariationSettings: "'wght' 700" }}>check</span>
                  </span>
                ) : (
                  <span className={`material-symbols-outlined text-[16px] ${isActive ? "text-primary" : "text-on-surface-variant/50"}`}>
                    {step.icon}
                  </span>
                )}
                {step.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
