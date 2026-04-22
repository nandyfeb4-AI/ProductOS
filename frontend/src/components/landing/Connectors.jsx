import { motion } from "framer-motion";
import Logo from "@/components/landing/Logo";

const inputs = [
  { name: "Notion", mark: "N" },
  { name: "Miro", mark: "M" },
  { name: "FigJam", mark: "F" },
];
const outputs = [
  { name: "Jira", mark: "J" },
  { name: "Linear", mark: "L" },
];
const signals = [
  { name: "Slack", mark: "S" },
  { name: "Amplitude", mark: "A" },
];

export default function Connectors() {
  return (
    <section
      id="connectors"
      data-testid="connectors-section"
      className="relative bg-[#0A0E1A] text-white py-28 lg:py-36 overflow-hidden"
    >
      <div className="absolute inset-0 po-grid-bg pointer-events-none" />
      <div className="absolute inset-0 po-radial-hero pointer-events-none" />

      <div className="relative max-w-[1240px] mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.6 }}
          className="max-w-[720px]"
        >
          <div className="inline-flex items-center gap-2 text-[11.5px] font-mono uppercase tracking-[0.14em] text-[#2DD4BF]">
            <span className="h-1 w-6 bg-[#2DD4BF]" />
            Connectors
          </div>
          <h2 className="font-display tracking-display mt-5 text-[40px] lg:text-[56px] leading-[1.04] font-semibold">
            Connect your
            <br />
            <span className="text-white/50">product systems.</span>
          </h2>
          <p className="mt-5 text-[16px] text-white/60 max-w-[520px]">
            Plug into the tools your team already uses. ProductOS reads from
            discovery, executes in the middle, and writes to delivery.
          </p>
        </motion.div>

        {/* Flow diagram */}
        <div className="mt-16 grid lg:grid-cols-[1fr_auto_1fr] items-center gap-10">
          {/* LEFT: Inputs */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-3"
            data-testid="connectors-inputs"
          >
            <ColumnLabel>01 / Inputs — Discovery</ColumnLabel>
            {inputs.map((c) => (
              <ConnectorTile key={c.name} {...c} />
            ))}
          </motion.div>

          {/* CENTER: ProductOS */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
            data-testid="connectors-center"
          >
            {/* Orbiting rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-[320px] w-[320px] rounded-full border border-white/5" />
              <div className="absolute h-[240px] w-[240px] rounded-full border border-white/8" />
              <div className="absolute h-[170px] w-[170px] rounded-full border border-[#4F7FFF]/20" />
            </div>

            <div className="relative mx-auto w-[220px] rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6 backdrop-blur-sm">
              <div className="flex flex-col items-center text-center">
                <Logo className="h-11 w-11" />
                <div className="mt-4 font-display text-[18px] font-semibold tracking-display">
                  ProductOS
                </div>
                <div className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-[#2DD4BF]">
                  Execution layer
                </div>
                <div className="mt-5 w-full space-y-1.5">
                  <PipeRow label="9 stages" />
                  <PipeRow label="7 agents" />
                  <PipeRow label="Bi-directional sync" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Outputs + Signals */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
            data-testid="connectors-outputs"
          >
            <div className="space-y-3">
              <ColumnLabel align="right">02 / Outputs — Delivery</ColumnLabel>
              {outputs.map((c) => (
                <ConnectorTile key={c.name} {...c} align="right" />
              ))}
            </div>
            <div className="space-y-3">
              <ColumnLabel align="right">03 / Signals — Feedback</ColumnLabel>
              {signals.map((c) => (
                <ConnectorTile
                  key={c.name}
                  {...c}
                  align="right"
                  variant="subtle"
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Flow caption */}
        <div className="mt-14 flex items-center justify-center gap-3 font-mono text-[12px] text-white/45">
          <span>Notion</span>
          <Arrow />
          <span className="text-white">ProductOS</span>
          <Arrow />
          <span>Jira</span>
        </div>
      </div>
    </section>
  );
}

function ColumnLabel({ children, align = "left" }) {
  return (
    <div
      className={`font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </div>
  );
}

function ConnectorTile({ name, mark, align = "left", variant = "default" }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      } ${
        variant === "subtle"
          ? "border-white/5 bg-white/[0.015]"
          : "border-white/10 bg-white/[0.025] hover:border-[#4F7FFF]/25 transition-colors"
      }`}
    >
      <div className="h-9 w-9 rounded-lg bg-white text-[#0A0E1A] flex items-center justify-center font-display font-semibold text-[14px] shrink-0">
        {mark}
      </div>
      <div
        className={`flex-1 min-w-0 ${align === "right" ? "items-end" : ""} flex flex-col`}
      >
        <div className="text-[13.5px] text-white">{name}</div>
        <div className="font-mono text-[10.5px] text-white/40">
          {variant === "subtle" ? "read-write" : "bi-directional"}
        </div>
      </div>
    </div>
  );
}

function PipeRow({ label }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10.5px] text-white/55">
      <span>{label}</span>
      <span className="h-1 w-1 rounded-full bg-[#2DD4BF]" />
    </div>
  );
}

function Arrow() {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" fill="none" aria-hidden>
      <line
        x1="0"
        y1="4"
        x2="17"
        y2="4"
        stroke="currentColor"
        strokeDasharray="3 3"
        opacity="0.5"
      />
      <path d="M16 1l5 3-5 3" stroke="currentColor" fill="none" opacity="0.7" />
    </svg>
  );
}
