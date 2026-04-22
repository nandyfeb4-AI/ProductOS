import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { CheckCircle2, Loader2, GitBranch, Sparkles, Layers, Send } from "lucide-react";

const baseFeed = [
  { id: 1, icon: Sparkles, title: "Feature Generator", detail: "Synthesized 4 candidates from Miro board", status: "done", ago: "03s" },
  { id: 2, icon: Layers, title: "Feature Refiner", detail: "Hardened acceptance criteria (v3)", status: "done", ago: "09s" },
  { id: 3, icon: GitBranch, title: "Story Slicer", detail: "Decomposing PROD-214 into 7 stories", status: "running", ago: "now" },
  { id: 4, icon: Send, title: "Backlog → Jira", detail: "Queued 12 issues for sprint 42", status: "queued", ago: "—" },
];

export default function WatchItWork() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const [feed, setFeed] = useState(baseFeed);

  useEffect(() => {
    if (!inView) return;
    let c = 0;
    const t = setInterval(() => {
      c += 1;
      setFeed((prev) => {
        const copy = prev.map((f) => ({ ...f }));
        // Advance states in sequence
        const runIdx = copy.findIndex((r) => r.status === "running");
        if (runIdx !== -1) {
          copy[runIdx].status = "done";
          copy[runIdx].ago = "02s";
          const nextIdx = copy.findIndex((r) => r.status === "queued");
          if (nextIdx !== -1) {
            copy[nextIdx].status = "running";
            copy[nextIdx].ago = "now";
          }
        } else {
          // reset cycle
          copy.forEach((r, i) => {
            if (i < 2) {
              r.status = "done";
              r.ago = `${(i + 1) * 3}s`;
            } else if (i === 2) {
              r.status = "running";
              r.ago = "now";
            } else {
              r.status = "queued";
              r.ago = "—";
            }
          });
        }
        return copy;
      });
    }, 2800);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <section
      id="watch"
      ref={ref}
      data-testid="watch-it-work-section"
      className="relative bg-[#F7F8FA] py-24 lg:py-32 border-y border-black/5"
    >
      <div className="max-w-[1240px] mx-auto px-6 lg:px-8 grid lg:grid-cols-12 gap-16 items-center">
        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 text-[11.5px] font-mono uppercase tracking-[0.14em] text-[#4F7FFF]">
              <span className="h-1 w-6 bg-[#4F7FFF]" />
              Observability
            </div>
            <h2 className="font-display tracking-display mt-5 text-[40px] lg:text-[52px] leading-[1.04] font-semibold text-[#0A0E1A]">
              Watch it work.
              <br />
              <span className="text-[#5A6478]">In real time.</span>
            </h2>
            <p className="mt-5 text-[16px] leading-[1.55] text-[#4A5468] max-w-[440px]">
              Every agent run is tracked. Every output is inspectable. No black
              boxes — trace the path from discovery signal to shipped story.
            </p>

            <ul className="mt-8 space-y-3.5">
              {[
                "Step-by-step agent execution logs",
                "Diffable outputs and revision history",
                "Structured events streamed to Slack",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-3 text-[14.5px] text-[#2A3142]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#4F7FFF] mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Feed card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="lg:col-span-7"
        >
          <div
            className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden"
            data-testid="watch-feed"
            style={{ boxShadow: "0 1px 0 rgba(10,14,26,0.02), 0 24px 40px -24px rgba(10,14,26,0.08)" }}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#2DD4BF] opacity-70 po-pulse" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2DD4BF]" />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#0A0E1A]">
                  Live Activity
                </span>
              </div>
              <div className="font-mono text-[11px] text-[#8B93A7]">
                workflow#4821 · workspace/onboarding
              </div>
            </div>

            <div className="divide-y divide-black/[0.05]">
              <AnimatePresence initial={false}>
                {feed.map((f) => {
                  const Icon = f.icon;
                  return (
                    <motion.div
                      key={f.id + f.status}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center justify-between px-5 py-4 hover:bg-black/[0.015] transition-colors"
                      data-testid={`feed-row-${f.id}`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            f.status === "running"
                              ? "bg-[#4F7FFF]/10 border-[#4F7FFF]/20 text-[#4F7FFF]"
                              : f.status === "done"
                                ? "bg-[#2DD4BF]/10 border-[#2DD4BF]/25 text-[#2DD4BF]"
                                : "bg-black/[0.03] border-black/[0.06] text-[#8B93A7]"
                          }`}
                        >
                          {f.status === "running" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : f.status === "done" ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Icon className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] text-[#0A0E1A] font-medium truncate">
                            {f.title}
                          </div>
                          <div className="text-[12.5px] text-[#5A6478] truncate">
                            {f.detail}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Chip status={f.status} />
                        <span className="font-mono text-[11px] text-[#8B93A7] w-10 text-right">
                          {f.ago}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Console strip */}
            <div className="bg-[#0A0E1A] px-5 py-3 font-mono text-[11.5px] text-white/60 flex items-center gap-3">
              <span className="text-[#2DD4BF]">›</span>
              <span className="text-white/40">14:32:07</span>
              <span>agent.story_slicer emitted</span>
              <span className="text-[#4F7FFF]">7 stories</span>
              <span className="text-white/30">·</span>
              <span>PROD-214</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Chip({ status }) {
  const map = {
    running: "text-[#4F7FFF] bg-[#4F7FFF]/8 border-[#4F7FFF]/20",
    done: "text-[#0B7A6B] bg-[#2DD4BF]/10 border-[#2DD4BF]/25",
    queued: "text-[#5A6478] bg-black/[0.03] border-black/[0.06]",
  };
  const label = { running: "Running", done: "Done", queued: "Queued" }[status];
  return (
    <span
      className={`font-mono text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[status]}`}
    >
      {label}
    </span>
  );
}
