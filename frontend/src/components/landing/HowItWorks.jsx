import { motion } from "framer-motion";
import { MessageSquareText, Sparkles, ListChecks, Rocket } from "lucide-react";

const steps = [
  {
    icon: MessageSquareText,
    label: "Workshop",
    hint: "Notes, Miro, FigJam",
  },
  {
    icon: Sparkles,
    label: "Features",
    hint: "AI synthesis",
  },
  {
    icon: ListChecks,
    label: "Stories",
    hint: "Refined & sliced",
  },
  {
    icon: Rocket,
    label: "Jira",
    hint: "Sprint-ready",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how"
      data-testid="how-it-works-section"
      className="relative bg-white py-28 lg:py-36"
    >
      <div className="max-w-[1100px] mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 text-[11.5px] font-mono uppercase tracking-[0.14em] text-[#4F7FFF]">
            <span className="h-1 w-6 bg-[#4F7FFF]" />
            Workflow
          </div>
          <h2 className="font-display tracking-display mt-5 text-[40px] lg:text-[56px] leading-[1.04] font-semibold">
            Discovery to delivery.
            <br />
            <span className="text-[#5A6478]">One workflow.</span>
          </h2>
          <p className="mt-5 text-[16px] text-[#4A5468] max-w-[560px] mx-auto">
            Generate PM-ready specs, refine them, and push to delivery —
            automatically.
          </p>
        </motion.div>

        {/* Flow */}
        <div className="mt-20 relative">
          {/* Dashed connector line (desktop) */}
          <svg
            className="hidden md:block absolute left-0 right-0 top-8 mx-auto pointer-events-none"
            height="2"
            viewBox="0 0 1000 2"
            preserveAspectRatio="none"
            style={{ width: "85%" }}
            aria-hidden
          >
            <line
              x1="0"
              y1="1"
              x2="1000"
              y2="1"
              stroke="#CBD2E0"
              strokeWidth="1"
              className="po-dash"
            />
          </svg>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 relative">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="flex flex-col items-center"
                  data-testid={`flow-step-${i + 1}`}
                >
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-white border border-black/[0.08] flex items-center justify-center group-hover:border-[#4F7FFF]/40 transition-colors shadow-[0_1px_0_rgba(10,14,26,0.03),0_12px_24px_-16px_rgba(10,14,26,0.08)]">
                      <Icon className="w-6 h-6 text-[#0A0E1A]" strokeWidth={1.6} />
                    </div>
                    <div className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-[#0A0E1A] text-white font-mono text-[10px] flex items-center justify-center">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="mt-5 font-display font-semibold text-[17px] tracking-display text-[#0A0E1A]">
                    {s.label}
                  </div>
                  <div className="text-[12.5px] text-[#8B93A7] mt-0.5 font-mono">
                    {s.hint}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
