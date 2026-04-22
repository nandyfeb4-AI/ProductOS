import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";

export default function FinalCTA() {
  return (
    <section
      data-testid="final-cta-section"
      className="relative bg-white py-28 lg:py-36"
    >
      <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-[#0A0E1A] text-white px-8 md:px-16 py-20 md:py-24"
        >
          <div className="absolute inset-0 po-grid-bg pointer-events-none" />
          <div className="absolute inset-0 po-radial-hero pointer-events-none" />

          <div className="relative text-center max-w-[780px] mx-auto">
            <div className="inline-flex items-center gap-2 text-[11.5px] font-mono uppercase tracking-[0.14em] text-[#2DD4BF]">
              <span className="h-1 w-6 bg-[#2DD4BF]" />
              Get started
            </div>
            <h2 className="font-display tracking-tightest mt-5 text-[44px] md:text-[60px] leading-[1.02] font-semibold">
              Run your product
              <br />
              workflow with{" "}
              <span className="text-white/50">clarity.</span>
            </h2>
            <p className="mt-5 text-[16px] text-white/60 max-w-[520px] mx-auto">
              Start with a workshop. End with a Jira-ready backlog. Nothing
              slips through the cracks.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href="#get-started"
                data-testid="final-cta-primary"
                className="inline-flex items-center gap-2 bg-[#4F7FFF] hover:bg-[#3B6BFF] text-white text-[14px] font-medium px-5 py-3 rounded-full transition-colors"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </motion.a>
              <a
                href="#demo"
                data-testid="final-cta-secondary"
                className="inline-flex items-center gap-2 text-white/85 hover:text-white border border-white/15 hover:border-white/30 text-[14px] font-medium px-5 py-3 rounded-full transition-colors"
              >
                <Play className="w-3.5 h-3.5" fill="currentColor" />
                See Demo
              </a>
            </div>

            <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">
              No credit card · Works with your existing Jira
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
