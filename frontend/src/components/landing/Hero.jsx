import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Play, CheckCircle2, Loader2 } from "lucide-react";

const initialRows = [
  { id: "r1", agent: "Feature Generator", stage: "Discovery → Features", status: "running", time: "just now" },
  { id: "r2", agent: "Story Refiner", stage: "Features → Stories", status: "done", time: "2s ago" },
  { id: "r3", agent: "Backlog Composer", stage: "Stories → Jira", status: "queued", time: "—" },
];

export default function Hero() {
  const [rows, setRows] = useState(initialRows);
  const [tick, setTick] = useState(0);

  // Cycle active row every 2.4s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setRows((prev) => {
      const next = [...prev];
      // rotate statuses
      const cycle = ["running", "done", "queued"];
      next.forEach((r, i) => {
        const idx = (cycle.indexOf(r.status) + 1) % 3;
        r.status = cycle[idx];
        r.time =
          r.status === "running" ? "just now" : r.status === "done" ? `${(i + 1) * 2}s ago` : "queued";
      });
      return next;
    });
  }, [tick]);

  return (
    <section
      data-testid="hero-section"
      className="relative overflow-hidden bg-[#0A0E1A] text-white pt-28 pb-28 lg:pt-36 lg:pb-32"
    >
      {/* Grid bg */}
      <div className="absolute inset-0 po-grid-bg pointer-events-none" />
      {/* Ambient radial */}
      <div className="absolute inset-0 po-radial-hero pointer-events-none" />
      {/* Noise */}
      <div className="absolute inset-0 po-noise" aria-hidden />

      <div className="relative max-w-[1240px] mx-auto px-6 lg:px-8 grid lg:grid-cols-12 gap-14 items-center">
        {/* LEFT */}
        <div className="lg:col-span-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 text-[12px] text-white/60 border border-white/10 rounded-full px-3 py-1.5 bg-white/[0.02]"
            data-testid="hero-eyebrow"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#2DD4BF] opacity-60 po-pulse-ring" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2DD4BF]" />
            </span>
            AI-native product operations
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display tracking-tightest mt-6 text-[44px] leading-[1.02] sm:text-[56px] lg:text-[68px] font-semibold text-white"
            data-testid="hero-headline"
          >
            Run your product
            <br />
            workflow.{" "}
            <span className="text-white/50">End&#8209;to&#8209;end.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            className="mt-6 text-[17px] leading-[1.55] text-white/60 max-w-[540px]"
            data-testid="hero-subtext"
          >
            From workshop notes to a Jira-ready backlog. ProductOS connects
            discovery, generation, refinement, and delivery in one system.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <a
              href="#login"
              data-testid="hero-cta-primary"
              className="group inline-flex items-center gap-2 bg-[#4F7FFF] hover:bg-[#3B6BFF] text-white text-[14px] font-medium px-5 py-3 rounded-full transition-colors"
            >
              Log in to ProductOS
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#how"
              data-testid="hero-cta-secondary"
              className="group inline-flex items-center gap-2 text-white/80 hover:text-white border border-white/15 hover:border-white/25 text-[14px] font-medium px-5 py-3 rounded-full transition-colors"
            >
              <Play className="w-3.5 h-3.5" fill="currentColor" />
              See how it works
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.28 }}
            className="mt-10 flex items-center gap-x-5 gap-y-2 flex-wrap text-[12.5px] text-white/40"
            data-testid="hero-proof-line"
          >
            <ProofDot>9 workflow stages</ProofDot>
            <ProofDot>7 reusable agents</ProofDot>
            <ProofDot>Jira-connected</ProofDot>
          </motion.div>
        </div>

        {/* RIGHT — product UI mock */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
          className="lg:col-span-6 relative"
          data-testid="hero-product-mock"
        >
          {/* Very subtle radial behind */}
          <div className="absolute -inset-10 po-radial-glow pointer-events-none" />

          <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 backdrop-blur-sm overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              </div>
              <div className="font-mono text-[11px] text-white/40">
                productos.app / workflows
              </div>
              <div className="w-10" />
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-white/40 font-mono uppercase tracking-wider">
                    Live · Workflow run #4821
                  </div>
                  <div className="text-[15px] text-white mt-1 font-medium">
                    Mobile Onboarding · Q4 Discovery
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#2DD4BF] font-mono">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#2DD4BF] opacity-70 po-pulse" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2DD4BF]" />
                  </span>
                  LIVE
                </div>
              </div>

              <div className="divide-y divide-white/5 border border-white/5 rounded-xl overflow-hidden">
                <AnimatePresence initial={false}>
                  {rows.map((r, idx) => (
                    <motion.div
                      key={r.id + r.status}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className={`flex items-center justify-between px-4 py-3.5 ${
                        r.status === "running" ? "po-row-active" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusIcon status={r.status} />
                        <div className="min-w-0">
                          <div className="text-[13.5px] text-white truncate">
                            {r.agent}
                          </div>
                          <div className="text-[11.5px] text-white/40 font-mono truncate">
                            {r.stage}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusChip status={r.status} />
                        <span className="text-[11px] font-mono text-white/35 w-14 text-right">
                          {r.time}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Footer summary */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <MiniStat label="Features" value="12" trend="+3" />
                <MiniStat label="Stories" value="48" trend="+9" />
                <MiniStat label="In Jira" value="36" trend="+12" accent />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ProofDot({ children }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1 w-1 rounded-full bg-white/25" />
      {children}
    </span>
  );
}

function StatusIcon({ status }) {
  if (status === "running")
    return (
      <div className="h-7 w-7 rounded-lg bg-[#4F7FFF]/10 border border-[#4F7FFF]/25 flex items-center justify-center shrink-0">
        <Loader2 className="w-3.5 h-3.5 text-[#4F7FFF] animate-spin" />
      </div>
    );
  if (status === "done")
    return (
      <div className="h-7 w-7 rounded-lg bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#2DD4BF]" />
      </div>
    );
  return (
    <div className="h-7 w-7 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center shrink-0">
      <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    running: {
      text: "Running",
      cls: "text-[#4F7FFF] bg-[#4F7FFF]/10 border-[#4F7FFF]/20",
    },
    done: {
      text: "Done",
      cls: "text-[#2DD4BF] bg-[#2DD4BF]/10 border-[#2DD4BF]/20",
    },
    queued: {
      text: "Queued",
      cls: "text-white/50 bg-white/[0.03] border-white/10",
    },
  };
  const s = map[status];
  return (
    <span
      className={`font-mono text-[10.5px] uppercase tracking-wider px-2 py-1 rounded-full border ${s.cls}`}
    >
      {s.text}
    </span>
  );
}

function MiniStat({ label, value, trend, accent }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.015] p-3">
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <div className="font-display text-[20px] font-semibold text-white">
          {value}
        </div>
        <div
          className={`text-[11px] font-mono ${
            accent ? "text-[#2DD4BF]" : "text-white/40"
          }`}
        >
          {trend}
        </div>
      </div>
    </div>
  );
}
