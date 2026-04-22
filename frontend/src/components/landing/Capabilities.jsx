import { motion } from "framer-motion";
import { Shield, ListTree, Radar } from "lucide-react";

const cards = [
  {
    icon: Shield,
    title: "Feature Hardening",
    desc: "Tighten acceptance criteria, flush out edge cases, and align with engineering constraints — automatically.",
  },
  {
    icon: ListTree,
    title: "Backlog Refinement",
    desc: "Keep your backlog investable. Agents slice, rank, and rewrite stories until they're sprint-ready.",
  },
  {
    icon: Radar,
    title: "Competitor Analysis",
    desc: "Continuous signal from competitor releases, reviews, and changelogs — compiled into actionable briefs.",
  },
];

export default function Capabilities() {
  return (
    <section
      id="capabilities"
      data-testid="capabilities-section"
      className="relative bg-[#F7F8FA] border-y border-black/[0.05] py-24 lg:py-32"
    >
      <div className="max-w-[1240px] mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.6 }}
          className="max-w-[720px]"
        >
          <div className="inline-flex items-center gap-2 text-[11.5px] font-mono uppercase tracking-[0.14em] text-[#4F7FFF]">
            <span className="h-1 w-6 bg-[#4F7FFF]" />
            Capabilities
          </div>
          <h2 className="font-display tracking-display mt-5 text-[40px] lg:text-[52px] leading-[1.04] font-semibold">
            Built for the work between
            <br />
            <span className="text-[#5A6478]">strategy and shipping.</span>
          </h2>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                whileHover={{ y: -3 }}
                data-testid={`capability-card-${i + 1}`}
                className="group rounded-2xl border border-black/[0.07] bg-white p-7 transition-colors hover:border-[#4F7FFF]/30"
              >
                <div className="h-10 w-10 rounded-lg bg-[#0A0E1A] text-white flex items-center justify-center group-hover:bg-[#4F7FFF] transition-colors">
                  <Icon className="w-4.5 h-4.5" strokeWidth={1.8} />
                </div>
                <div className="mt-6 font-display font-semibold text-[20px] tracking-display text-[#0A0E1A]">
                  {c.title}
                </div>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#4A5468]">
                  {c.desc}
                </p>

                <div className="mt-7 pt-5 border-t border-black/[0.06] flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#8B93A7]">
                    0{i + 1} / 03
                  </span>
                  <span className="font-mono text-[11px] text-[#4F7FFF] opacity-0 group-hover:opacity-100 transition-opacity">
                    Learn more →
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
