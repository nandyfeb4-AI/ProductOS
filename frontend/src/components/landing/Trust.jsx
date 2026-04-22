import { motion } from "framer-motion";

const logos = [
  "NORTHWIND",
  "HELIX",
  "LUMEN",
  "ATLAS·CO",
  "MERIDIAN",
  "CUTLASS",
  "POLARIS",
  "OCTAVE",
];

export default function Trust() {
  return (
    <section
      data-testid="trust-section"
      className="bg-white py-20 lg:py-24 border-b border-black/[0.05]"
    >
      <div className="max-w-[1240px] mx-auto px-6 lg:px-8 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-[13px] text-[#5A6478]"
        >
          Used by product teams building modern software
        </motion.p>

        <div className="mt-10 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10" />

          <div className="flex w-max po-marquee">
            {[...logos, ...logos].map((name, i) => (
              <div
                key={i}
                className="shrink-0 px-10 flex items-center justify-center"
                data-testid={`trust-logo-${i}`}
              >
                <span
                  className="font-display text-[22px] font-semibold text-[#8B93A7] tracking-[0.18em] hover:text-[#0A0E1A] transition-colors"
                  style={{ letterSpacing: "0.22em" }}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-y-6 max-w-[880px] mx-auto">
          <Stat kpi="9" label="Workflow stages" />
          <Stat kpi="7" label="Reusable agents" />
          <Stat kpi="92%" label="Refined specs accepted" />
          <Stat kpi="< 4s" label="Avg agent turnaround" />
        </div>
      </div>
    </section>
  );
}

function Stat({ kpi, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="font-display tracking-display text-[34px] font-semibold text-[#0A0E1A]">
        {kpi}
      </div>
      <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-[#8B93A7]">
        {label}
      </div>
    </div>
  );
}
