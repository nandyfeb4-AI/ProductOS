import { useState, useEffect, useRef } from "react";
import {
  motion, useMotionValue, useTransform, useSpring,
  useInView, AnimatePresence,
} from "framer-motion";

// ─── CSS keyframes ──────────────────────────────────────────────────────────────
const LANDING_CSS = `
  @keyframes heroBgDrift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes orbFloat {
    0%, 100% { transform: translateY(0px)   scale(1);    }
    50%       { transform: translateY(-28px) scale(1.06); }
  }
  @keyframes orbFloat2 {
    0%, 100% { transform: translateY(0px)   scale(1);    }
    50%       { transform: translateY(20px)  scale(0.96); }
  }
  @keyframes statusPulse {
    0%, 100% { opacity: 1;   }
    50%       { opacity: 0.3; }
  }
  @keyframes scanline {
    0%   { top: -8%; opacity: 0.06; }
    50%  { opacity: 0.10; }
    100% { top: 108%;  opacity: 0.04; }
  }
  .hero-bg {
    background: linear-gradient(-45deg, #020817, #0f172a, #1e1b4b, #042f4b, #0a1628);
    background-size: 400% 400%;
    animation: heroBgDrift 14s ease infinite;
  }
  .orb-1  { animation: orbFloat  9s  ease-in-out infinite;       }
  .orb-2  { animation: orbFloat2 11s ease-in-out infinite  1.8s; }
  .orb-3  { animation: orbFloat  7s  ease-in-out infinite  3.5s; }
  .status-dot { animation: statusPulse 1.8s ease-in-out infinite; }
  .scanline   { animation: scanline 6s linear infinite; }
`;

// ─── Design tokens (dark — hero only) ──────────────────────────────────────────
const DARK_SURFACE = "rgba(255,255,255,0.05)";
const DARK_BORDER  = "rgba(255,255,255,0.09)";
const DARK_CARD    = "rgba(15,23,42,0.7)";

// ─── Design tokens (light — all other sections) ─────────────────────────────────
const L_BG      = "#ffffff";
const L_BG_ALT  = "#F9FAFB";
const L_BORDER  = "#e2e8f0";
const L_CARD    = "#ffffff";
const L_HEAD    = "#0f172a";
const L_BODY    = "#64748b";
const L_DETAIL  = "#94a3b8";

// Legacy aliases (still used in hero / parallax mock) ───────────────────────────
const SURFACE = DARK_SURFACE;
const BORDER  = DARK_BORDER;
const CARD_BG = DARK_CARD;

const ACTIVITY_QUEUE = [
  { icon: "auto_awesome",  label: "Feature Generator",  detail: "Drafting feature spec from workshop notes",     running: true  },
  { icon: "verified",      label: "Feature Hardening",  detail: "Quality gate passed — 3 features hardened",     running: false },
  { icon: "receipt_long",  label: "Story Generator",    detail: "12 stories created across 3 features",          running: false },
  { icon: "auto_fix_high", label: "Story Refiner",      detail: "8 stories refined and acceptance-tested",       running: false },
  { icon: "account_tree",  label: "Backlog Refinement", detail: "34 stories routed — 28 ready, 6 to refine",     running: false },
  { icon: "query_stats",   label: "Competitor Analysis",detail: "4 competitors analyzed against product context", running: false },
  { icon: "call_split",    label: "Story Slicer",       detail: "2 oversized stories sliced into 7",             running: false },
];

const PIPELINE_STEPS = [
  { icon: "groups",        label: "Workshop",   detail: "Capture raw insights and opportunity signals",               num: "01", color: "#a78bfa" },
  { icon: "auto_awesome",  label: "Features",   detail: "Generate PM-ready specs; harden them through a quality gate", num: "02", color: "#60a5fa" },
  { icon: "receipt_long",  label: "Stories",    detail: "Generate, refine, and slice to independently-deliverable units",num: "03", color: "#34d399" },
  { icon: "account_tree",  label: "Jira",       detail: "Export a delivery-ready backlog directly into Jira",          num: "04", color: "#f472b6" },
];

const TYPING_PHRASES = [
  "Workshop → Feature → Story → Jira.",
  "Discovery to delivery. One workflow.",
  "AI-native product operations.",
];

// ─── Count-up hook ──────────────────────────────────────────────────────────────
function useCountUp(target, durationMs = 1400, active = false) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!active || started.current || typeof target !== "number") return;
    started.current = true;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / durationMs, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, durationMs]);
  return value;
}

// ─── Typing cursor hook ─────────────────────────────────────────────────────────
function useTypingCursor(phrases, typingSpeed = 55, pauseMs = 2200, deleteSpeed = 28) {
  const [display, setDisplay] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[phraseIdx];
    let timeout;
    if (!deleting) {
      if (charIdx < phrase.length) {
        timeout = setTimeout(() => setCharIdx(c => c + 1), typingSpeed);
      } else {
        timeout = setTimeout(() => setDeleting(true), pauseMs);
      }
    } else {
      if (charIdx > 0) {
        timeout = setTimeout(() => setCharIdx(c => c - 1), deleteSpeed);
      } else {
        setDeleting(false);
        setPhraseIdx(i => (i + 1) % phrases.length);
      }
    }
    setDisplay(phrase.slice(0, charIdx));
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, phraseIdx, phrases, typingSpeed, pauseMs, deleteSpeed]);

  return display;
}

// ─── Scroll-fade wrapper ────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Section label ──────────────────────────────────────────────────────────────
function Label({ children, light = false }) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.18em] mb-5 ${light ? "text-violet-600" : "text-purple-400"}`}>
      {children}
    </p>
  );
}

// ─── Product mock content ───────────────────────────────────────────────────────
function ProductMockContent({ activities }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #0d1424 0%, #080e1a 100%)",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 60px rgba(124,58,237,0.08)",
      }}
    >
      {/* Browser bar */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ background: "rgba(0,0,0,0.3)", borderColor: BORDER }}>
        <div className="flex gap-1.5">
          {["#3a3a3a","#3a3a3a","#3a3a3a"].map((c,i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="flex-1 mx-3">
          <div className="rounded px-3 py-0.5 flex items-center gap-1.5 max-w-[220px]"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <span className="material-symbols-outlined text-slate-600" style={{ fontSize: "10px" }}>lock</span>
            <span className="text-[10px] text-slate-600 truncate">app.productos.io</span>
          </div>
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ height: 420 }}>
        {/* Sidebar */}
        <div className="w-11 flex flex-col items-center py-4 gap-1.5 shrink-0 border-r"
          style={{ background: "#050810", borderColor: BORDER }}>
          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-white"
              style={{ fontSize: "12px", fontVariationSettings: "'FILL' 1" }}>architecture</span>
          </div>
          {[
            { icon: "dashboard",    active: false },
            { icon: "inventory_2",  active: true  },
            { icon: "psychology",   active: false },
            { icon: "smart_toy",    active: false },
            { icon: "account_tree", active: false },
          ].map(({ icon, active }) => (
            <div key={icon} className={`w-7 h-7 rounded-md flex items-center justify-center ${active ? "bg-violet-600" : ""}`}>
              <span className={`material-symbols-outlined ${active ? "text-white" : "text-slate-700"}`}
                style={{ fontSize: "13px" }}>{icon}</span>
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 border-b flex items-center gap-1.5 shrink-0"
            style={{ background: "rgba(0,0,0,0.2)", borderColor: BORDER }}>
            <span className="text-[10px] text-slate-600">Projects</span>
            <span className="material-symbols-outlined text-slate-700" style={{ fontSize: "11px" }}>chevron_right</span>
            <span className="text-[10px] text-slate-300 font-medium">Acme SaaS Platform</span>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}>
              Active
            </span>
          </div>

          <div className="p-3 space-y-2 overflow-hidden flex-1">
            {/* Stat strip */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Features",   value: "12", color: "#a78bfa" },
                { label: "Stories",    value: "47", color: "#34d399" },
                { label: "Agent runs", value: "28", color: "#60a5fa" },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-2.5 text-center"
                  style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <p className="text-[17px] font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Live activity */}
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {activities.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0,  scale: 1    }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2"
                    style={{
                      background: i === 0 ? "rgba(124,58,237,0.1)" : SURFACE,
                      border: `1px solid ${i === 0 ? "rgba(124,58,237,0.25)" : BORDER}`,
                    }}
                  >
                    {i === 0
                      ? <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 status-dot" />
                      : <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#34d399" }} />
                    }
                    <span className="material-symbols-outlined"
                      style={{ fontSize: "11px", color: i === 0 ? "#a78bfa" : "#4b5563" }}>{item.icon}</span>
                    <span className="text-[10px] font-medium text-slate-300 flex-1 truncate">{item.label}</span>
                    <span className="text-[9px] font-semibold shrink-0"
                      style={{ color: i === 0 ? "#a78bfa" : "#34d399" }}>
                      {i === 0 ? "Running" : "Done"}
                    </span>
                    <span className="text-[9px] text-slate-700 shrink-0">{item.age}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Parallax mock wrapper ──────────────────────────────────────────────────────
function ParallaxMock() {
  const containerRef = useRef(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [6, -6]), { stiffness: 180, damping: 28 });
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-6, 6]), { stiffness: 180, damping: 28 });

  const [activities, setActivities] = useState(() =>
    ACTIVITY_QUEUE.slice(0, 4).map((a, i) => ({
      ...a, id: i, age: ["just now", "2m ago", "1h ago", "3h ago"][i],
    }))
  );
  const nextIdx = useRef(4);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = ACTIVITY_QUEUE[nextIdx.current % ACTIVITY_QUEUE.length];
      nextIdx.current++;
      setActivities(prev =>
        [{ ...next, id: Date.now(), age: "just now" },
         ...prev.map((a, i) => ({ ...a, age: ["just now", "2m ago", "1h ago", "3h ago"][i + 1] ?? "1d ago" }))
        ].slice(0, 4)
      );
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  function onMouseMove(e) {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    rawX.set((e.clientX - r.left - r.width / 2) / r.width);
    rawY.set((e.clientY - r.top - r.height / 2) / r.height);
  }

  return (
    <div className="relative" ref={containerRef} onMouseMove={onMouseMove}
      onMouseLeave={() => { rawX.set(0); rawY.set(0); }}
      style={{ perspective: "1100px" }}
    >
      {/* Glow behind mock */}
      <div className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background: "radial-gradient(ellipse 90% 75% at 50% 45%, rgba(124,58,237,0.22) 0%, rgba(37,99,235,0.12) 40%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
        <ProductMockContent activities={activities} />
      </motion.div>
    </div>
  );
}

// ─── NavBar ─────────────────────────────────────────────────────────────────────
function NavBar({ onEnter }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14 transition-all duration-300"
      style={{
        borderBottom: scrolled ? `1px solid ${scrolled ? L_BORDER : DARK_BORDER}` : "1px solid transparent",
        background: scrolled ? "rgba(255,255,255,0.94)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-white"
            style={{ fontSize: "14px", fontVariationSettings: "'FILL' 1" }}>architecture</span>
        </div>
        <span className={`font-black text-[15px] tracking-tight ${scrolled ? "text-slate-900" : "text-white"}`}>
          ProductOS
        </span>
      </div>

      <div className="hidden md:flex items-center gap-7">
        {[["Platform", "#platform"], ["Capabilities", "#capabilities"], ["Why us", "#why"]].map(([label, href]) => (
          <a key={href} href={href}
            className={`text-[13px] transition-colors ${scrolled ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200"}`}>
            {label}
          </a>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.04, boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}
        whileTap={{ scale: 0.97 }}
        onClick={onEnter}
        className="text-[13px] font-semibold text-white px-4 py-1.5 rounded-lg transition-all"
        style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)", boxShadow: "0 0 0 1px rgba(255,255,255,0.1) inset" }}
      >
        Log in
      </motion.button>
    </motion.nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────────
function StatItem({ target, label, suffix = "", isCheck = false }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useCountUp(target, 1300, inView && !isCheck);
  return (
    <div ref={ref} className="text-center lg:text-left">
      <p className="text-2xl font-black text-white tabular-nums">
        {isCheck ? "✓" : `${count}${suffix}`}
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function HeroSection({ onEnter }) {
  const typed = useTypingCursor(TYPING_PHRASES, 52, 2400, 26);

  return (
    <section className="hero-bg relative min-h-screen flex items-center pt-14 overflow-hidden">

      {/* Scanline sweep */}
      <div className="scanline absolute left-0 right-0 h-[2px] pointer-events-none"
        style={{ background: "linear-gradient(90deg,transparent,rgba(124,58,237,0.15),transparent)" }} />

      {/* Floating orbs */}
      <div className="orb-1 absolute top-[15%] left-[8%] w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(124,58,237,0.18) 0%,transparent 70%)", filter: "blur(40px)" }} />
      <div className="orb-2 absolute top-[35%] right-[6%] w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(37,99,235,0.16) 0%,transparent 70%)", filter: "blur(50px)" }} />
      <div className="orb-3 absolute bottom-[10%] left-[38%] w-64 h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(6,182,212,0.12) 0%,transparent 70%)", filter: "blur(44px)" }} />

      {/* Vignette bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(2,8,23,0.9))" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 w-full py-24 lg:py-32">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">

          {/* Left */}
          <div>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
                style={{ border: "1px solid rgba(124,58,237,0.35)", background: "rgba(124,58,237,0.12)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 status-dot" />
                <span className="text-[11px] font-semibold text-violet-300 tracking-wide">
                  AI-native product operations
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.14 }}
              className="font-black text-white leading-[0.95] tracking-[-0.03em] mb-4"
              style={{ fontSize: "clamp(42px, 5.5vw, 68px)" }}
            >
              Run your product<br />
              workflow.<br />
              <span style={{
                background: "linear-gradient(90deg,#a78bfa,#60a5fa,#34d399)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>End-to-end.</span>
            </motion.h1>

            {/* Typing cursor */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.28 }}
              className="flex items-center gap-1 mb-8 h-7"
            >
              <span className="text-[15px] font-medium" style={{ color: "#94a3b8" }}>{typed}</span>
              <span className="w-0.5 h-5 bg-violet-400 rounded-full status-dot" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.32 }}
              className="text-[15px] leading-relaxed max-w-[420px] mb-10"
              style={{ color: "#64748b" }}
            >
              From workshop notes to a Jira-ready backlog. ProductOS connects discovery,
              feature generation, story refinement, and execution inside one structured,
              AI-native platform.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="flex items-center gap-3 flex-wrap"
            >
              <motion.button
                whileHover={{ scale: 1.04, y: -2, boxShadow: "0 8px 32px rgba(124,58,237,0.45)" }}
                whileTap={{ scale: 0.97 }}
                onClick={onEnter}
                className="flex items-center gap-2 px-6 py-2.5 text-white text-[13px] font-semibold rounded-xl"
                style={{
                  background: "linear-gradient(135deg,#7c3aed,#2563eb)",
                  boxShadow: "0 4px 24px rgba(124,58,237,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset",
                }}
              >
                <span className="material-symbols-outlined"
                  style={{ fontSize: "15px", fontVariationSettings: "'FILL' 1" }}>login</span>
                Log in to ProductOS
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.02 }} href="#platform"
                className="px-6 py-2.5 text-[13px] font-semibold rounded-xl transition-all"
                style={{ border: `1px solid ${BORDER}`, color: "#94a3b8" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#e2e8f0"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = "#94a3b8"; }}
              >
                See how it works
              </motion.a>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex items-center gap-8 mt-12 pt-8"
              style={{ borderTop: `1px solid ${BORDER}` }}
            >
              <StatItem target={9}  label="Workflow stages" />
              <StatItem target={7}  label="Reusable agents" />
              <StatItem isCheck     label="Jira-connected" />
            </motion.div>
          </div>

          {/* Right: product mock */}
          <motion.div
            initial={{ opacity: 0, x: 28, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="hidden lg:block"
          >
            <ParallaxMock />
          </motion.div>

        </div>
      </div>
    </section>
  );
}

// ─── Step chevron connector ─────────────────────────────────────────────────────
function StepConnector({ isPast, isActive }) {
  return (
    <div className="hidden lg:flex items-center justify-center shrink-0 w-8 mt-8">
      <motion.span
        className="material-symbols-outlined"
        animate={{ color: isPast ? "#7c3aed" : isActive ? "#a78bfa" : "#cbd5e1" }}
        transition={{ duration: 0.4 }}
        style={{ fontSize: "20px" }}
      >
        chevron_right
      </motion.span>
    </div>
  );
}

// ─── Workflow pipeline ──────────────────────────────────────────────────────────
// Light variant (used in WorkflowSection on white background)
function AnimatedStepLight({ step, isActive, isPast, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative flex flex-col items-center"
    >
      <div
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500"
        style={{
          background: isActive ? `${step.color}12` : isPast ? "rgba(52,211,153,0.08)" : "#F1F5F9",
          border: `1px solid ${isActive ? `${step.color}40` : isPast ? "rgba(52,211,153,0.35)" : L_BORDER}`,
          boxShadow: isActive ? `0 0 24px ${step.color}20` : "none",
        }}
      >
        <span
          className="material-symbols-outlined transition-colors duration-500"
          style={{
            fontSize: "24px",
            color: isActive ? step.color : isPast ? "#34d399" : "#94a3b8",
            fontVariationSettings: "'FILL' 1",
          }}
        >{step.icon}</span>
        {isActive && (
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-violet-500 status-dot"
            style={{ border: `2px solid ${L_BG_ALT}` }} />
        )}
        {isPast && (
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
            style={{ background: "#34d399", border: `2px solid ${L_BG_ALT}` }}>
            <span className="material-symbols-outlined text-white"
              style={{ fontSize: "8px", fontVariationSettings: "'FILL' 1" }}>check</span>
          </div>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 transition-colors duration-500"
        style={{ color: isActive ? step.color : isPast ? "#34d399" : L_DETAIL }}>
        {step.num}
      </p>
      <p className="text-sm font-bold mb-0.5 transition-colors duration-500"
        style={{ color: isActive ? L_HEAD : isPast ? L_BODY : L_DETAIL }}>
        {step.label}
      </p>
    </motion.div>
  );
}

// Dark variant (kept for reference, not currently used)
function AnimatedStep({ step, isActive, isPast, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative flex flex-col items-center"
    >
      <div
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500"
        style={{
          background: isActive
            ? `${step.color}18`
            : isPast ? "rgba(52,211,153,0.08)" : SURFACE,
          border: `1px solid ${isActive ? `${step.color}50` : isPast ? "rgba(52,211,153,0.3)" : BORDER}`,
          boxShadow: isActive ? `0 0 28px ${step.color}25` : "none",
        }}
      >
        <span
          className="material-symbols-outlined transition-colors duration-500"
          style={{
            fontSize: "24px",
            color: isActive ? step.color : isPast ? "#34d399" : "#1e293b",
            fontVariationSettings: "'FILL' 1",
          }}
        >{step.icon}</span>
        {isActive && (
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-violet-500 status-dot"
            style={{ border: "2px solid #020817" }} />
        )}
        {isPast && (
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
            style={{ background: "#34d399", border: "2px solid #020817" }}>
            <span className="material-symbols-outlined text-white"
              style={{ fontSize: "8px", fontVariationSettings: "'FILL' 1" }}>check</span>
          </div>
        )}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 transition-colors duration-500"
        style={{ color: isActive ? step.color : isPast ? "#34d399" : "#1e293b" }}>
        {step.num}
      </p>
      <p className="text-sm font-bold mb-0.5 transition-colors duration-500"
        style={{ color: isActive ? "#f1f5f9" : isPast ? "#64748b" : "#334155" }}>
        {step.label}
      </p>
    </motion.div>
  );
}

function WorkflowSection() {
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-120px" });

  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setActive(p => (p + 1) % PIPELINE_STEPS.length), 2400);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <section id="platform" ref={ref}
      className="py-28 lg:py-36 relative"
      style={{ background: L_BG_ALT, borderTop: `1px solid ${L_BORDER}`, borderBottom: `1px solid ${L_BORDER}` }}
    >
      <div className="relative max-w-5xl mx-auto px-6 lg:px-10">
        <FadeUp className="mb-20 text-center">
          <Label light>How it works</Label>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-4 leading-tight" style={{ color: L_HEAD }}>
            Discovery to delivery.<br />One workflow.
          </h2>
          <p className="text-[15px] max-w-xl mx-auto" style={{ color: L_BODY }}>
            ProductOS structures every stage — from raw insights to a Jira-ready backlog —
            inside a single connected system.
          </p>
        </FadeUp>

        {/* Mobile: 2×2 grid */}
        <div className="grid grid-cols-2 gap-8 lg:hidden">
          {PIPELINE_STEPS.map((step, i) => (
            <AnimatedStepLight key={step.num} step={step} isActive={active === i} isPast={i < active} delay={i * 0.1} />
          ))}
        </div>

        {/* Desktop: flex row with chevron connectors */}
        <div className="hidden lg:flex items-start">
          {PIPELINE_STEPS.flatMap((step, i) => {
            const items = [
              <div key={step.num} className="flex-1">
                <AnimatedStepLight step={step} isActive={active === i} isPast={i < active} delay={i * 0.1} />
              </div>,
            ];
            if (i < PIPELINE_STEPS.length - 1) {
              items.push(
                <StepConnector key={`c-${i}`} isPast={i < active} isActive={active === i} />
              );
            }
            return items;
          })}
        </div>

        {/* Active step detail */}
        <div className="mt-14 h-12 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="flex items-center gap-3 px-5 py-2.5 rounded-xl"
              style={{ background: L_CARD, border: `1px solid ${L_BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 status-dot shrink-0" />
              <span className="text-[12px]" style={{ color: L_BODY }}>
                {PIPELINE_STEPS[active].detail}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ─── Capabilities ───────────────────────────────────────────────────────────────
function CapabilitiesSection() {
  const caps = [
    {
      icon: "verified",     color: "#a78bfa", gradFrom: "rgba(124,58,237,0.12)", gradTo: "rgba(124,58,237,0)",
      title: "Feature Hardening",
      desc: "AI quality evaluation against your configured skill definition. Features pass a structured gate before stories are created — preventing weak specs from reaching the backlog.",
      detail: "Configurable quality bar per project.",
    },
    {
      icon: "account_tree", color: "#34d399", gradFrom: "rgba(52,211,153,0.10)", gradTo: "rgba(52,211,153,0)",
      title: "Backlog Refinement",
      desc: "Automated analysis routing every story through the Story Refiner. Stories bucketed — ready, needs refinement, oversized, blocked — with concrete output for each decision.",
      detail: "Execution-first, not a manual ceremony.",
    },
    {
      icon: "query_stats",  color: "#22d3ee", gradFrom: "rgba(6,182,212,0.10)",  gradTo: "rgba(6,182,212,0)",
      title: "Competitor Analysis",
      desc: "Structured analysis of named competitors against your product context. Threats, positioning gaps, feature opportunities, and strategic responses from the context you provide.",
      detail: "Grounded in your context, not hallucinated data.",
    },
  ];

  return (
    <section id="capabilities" className="py-28 lg:py-36 relative"
      style={{ background: L_BG, borderTop: `1px solid ${L_BORDER}`, borderBottom: `1px solid ${L_BORDER}` }}>
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <FadeUp className="mb-16">
          <Label light>Capabilities</Label>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight max-w-xl leading-tight" style={{ color: L_HEAD }}>
            Built for the work between<br />strategy and shipping.
          </h2>
        </FadeUp>

        <div className="grid lg:grid-cols-3 gap-5">
          {caps.map((cap, i) => (
            <FadeUp key={cap.title} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -5, boxShadow: `0 16px 40px rgba(0,0,0,0.08), 0 0 0 1px ${cap.color}30` }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="group flex flex-col h-full p-7 rounded-2xl relative overflow-hidden"
                style={{ background: L_CARD, border: `1px solid ${L_BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${cap.color}40`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = L_BORDER; }}
              >
                {/* Subtle tint on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{ background: `linear-gradient(145deg, ${cap.gradFrom}, transparent)` }} />

                <div className="relative">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-6"
                    style={{ background: `${cap.color}12`, border: `1px solid ${cap.color}25` }}>
                    <span className="material-symbols-outlined"
                      style={{ fontSize: "21px", color: cap.color, fontVariationSettings: "'FILL' 1" }}>{cap.icon}</span>
                  </div>
                  <h3 className="text-[15px] font-bold mb-3" style={{ color: L_HEAD }}>{cap.title}</h3>
                  <p className="text-[13px] leading-relaxed flex-1 mb-5" style={{ color: L_BODY }}>{cap.desc}</p>
                  <p className="text-[11px] italic" style={{ color: L_DETAIL }}>{cap.detail}</p>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Live activity section ──────────────────────────────────────────────────────
function LiveActivitySection() {
  const [feed, setFeed] = useState(() =>
    ACTIVITY_QUEUE.slice(0, 5).map((a, i) => ({
      ...a, id: i,
      age: ["just now", "12s ago", "1m ago", "4m ago", "9m ago"][i],
    }))
  );
  const nextIdx = useRef(5);

  useEffect(() => {
    const t = setInterval(() => {
      const next = ACTIVITY_QUEUE[nextIdx.current % ACTIVITY_QUEUE.length];
      nextIdx.current++;
      setFeed(prev =>
        [{ ...next, id: Date.now(), age: "just now" },
         ...prev.map((a, i) => ({ ...a, age: ["just now", "12s ago", "1m ago", "4m ago", "9m ago"][i + 1] ?? "1h ago" }))
        ].slice(0, 5)
      );
    }, 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="py-28 lg:py-36"
      style={{ background: L_BG_ALT, borderTop: `1px solid ${L_BORDER}`, borderBottom: `1px solid ${L_BORDER}` }}>
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center">

          <FadeUp>
            <Label light>Live system</Label>
            <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-5 leading-tight" style={{ color: L_HEAD }}>
              Watch it work.<br />
              <span style={{ color: "#7c3aed" }}>In real time.</span>
            </h2>
            <p className="text-[14px] leading-relaxed" style={{ color: L_BODY }}>
              Every agent run is tracked. Every output is inspectable. Your product
              pipeline has a live pulse — not a black box.
            </p>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: L_CARD, border: `1px solid ${L_BORDER}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
              {/* Feed header */}
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b" style={{ borderColor: L_BORDER }}>
                <div className="w-2 h-2 rounded-full bg-violet-500 status-dot" />
                <span className="text-[12px] font-semibold" style={{ color: L_HEAD }}>Agent activity</span>
                <span className="ml-auto text-[10px]" style={{ color: L_DETAIL }}>Live</span>
              </div>
              {/* Feed items */}
              <div className="p-3 space-y-1.5">
                <AnimatePresence initial={false}>
                  {feed.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{
                        background: i === 0 ? "rgba(124,58,237,0.06)" : "#F8FAFC",
                        border: `1px solid ${i === 0 ? "rgba(124,58,237,0.18)" : L_BORDER}`,
                      }}
                    >
                      <span className="material-symbols-outlined mt-px"
                        style={{ fontSize: "14px", color: i === 0 ? "#7c3aed" : "#94a3b8", fontVariationSettings: "'FILL' 1" }}>
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] font-semibold"
                            style={{ color: i === 0 ? L_HEAD : L_BODY }}>{item.label}</span>
                          {i === 0 && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                              Running
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] truncate" style={{ color: L_DETAIL }}>{item.detail}</p>
                      </div>
                      <span className="text-[10px] shrink-0 mt-0.5" style={{ color: L_DETAIL }}>{item.age}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </FadeUp>

        </div>
      </div>
    </section>
  );
}

// ─── Why different ──────────────────────────────────────────────────────────────
function WhyDifferentSection() {
  const points = [
    { icon: "route",                  color: "#a78bfa",
      title: "Not a roadmap tool",
      desc: "ProductOS lives downstream of strategy. It turns decisions into structured features, stories, and delivery-ready backlogs." },
    { icon: "psychology",             color: "#60a5fa",
      title: "Reusable agents, persistent context",
      desc: "Each agent runs within your project context using a configurable skill. Structured output feeds the next stage — nothing is one-shot." },
    { icon: "supervised_user_circle", color: "#34d399",
      title: "Human-supervised throughout",
      desc: "AI generates. You decide what moves forward. Every output is inspectable and editable before continuing downstream." },
    { icon: "cable",                  color: "#f472b6",
      title: "Jira-connected, not a silo",
      desc: "Finished stories export directly to Jira. Your delivery process stays intact; preparation becomes dramatically faster." },
  ];

  return (
    <section id="why" className="py-28 lg:py-36"
      style={{ background: L_BG, borderTop: `1px solid ${L_BORDER}` }}>
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-16 lg:gap-24 items-start">

          <FadeUp className="lg:sticky lg:top-20">
            <Label light>Why ProductOS</Label>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight leading-[1.02] mb-6" style={{ color: L_HEAD }}>
              Most PM tools plan.<br />
              ProductOS<br />
              <span style={{ color: "#7c3aed" }}>executes.</span>
            </h2>
            <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: L_BODY }}>
              Roadmap tools show you where to go. ProductOS builds the engine that gets you there —
              structured workflows, reusable AI agents, and human-supervised quality gates.
            </p>
          </FadeUp>

          <div className="space-y-4 lg:pt-2">
            {points.map((p, i) => (
              <FadeUp key={p.title} delay={i * 0.08}>
                <motion.div
                  whileHover={{ x: 3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="flex gap-4 p-5 rounded-2xl"
                  style={{ background: L_CARD, border: `1px solid ${L_BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${p.color}35`; e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.06), 0 0 0 1px ${p.color}20`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = L_BORDER; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${p.color}10`, border: `1px solid ${p.color}22` }}>
                    <span className="material-symbols-outlined"
                      style={{ fontSize: "16px", color: p.color }}>{p.icon}</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold mb-1.5" style={{ color: L_HEAD }}>{p.title}</p>
                    <p className="text-[13px] leading-relaxed" style={{ color: L_BODY }}>{p.desc}</p>
                  </div>
                </motion.div>
              </FadeUp>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── CTA ─────────────────────────────────────────────────────────────────────────
function CTASection({ onEnter }) {
  return (
    <section className="py-28 lg:py-36 relative overflow-hidden"
      style={{ background: L_BG_ALT, borderTop: `1px solid ${L_BORDER}` }}>
      <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
        <FadeUp>
          <Label light>Get started</Label>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-5 leading-tight" style={{ color: L_HEAD }}>
            Start with one project.
          </h2>
          <p className="text-[15px] mb-10 max-w-md mx-auto" style={{ color: L_BODY }}>
            Run a workshop, generate features, refine the backlog, and export to Jira —
            all in one connected workflow.
          </p>
          <motion.button
            whileHover={{ scale: 1.05, y: -2, boxShadow: "0 12px 40px rgba(124,58,237,0.4)" }}
            whileTap={{ scale: 0.97 }}
            onClick={onEnter}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-white text-[14px] font-semibold rounded-xl"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#2563eb)",
              boxShadow: "0 4px 20px rgba(124,58,237,0.3)",
            }}
          >
            <span className="material-symbols-outlined"
              style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>login</span>
            Log in to ProductOS
          </motion.button>
        </FadeUp>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function PageFooter() {
  return (
    <footer className="h-14 flex items-center px-6 lg:px-10"
      style={{ background: L_BG, borderTop: `1px solid ${L_BORDER}` }}>
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-violet-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-white"
              style={{ fontSize: "11px", fontVariationSettings: "'FILL' 1" }}>architecture</span>
          </div>
          <span className="text-[12px] font-bold" style={{ color: L_BODY }}>ProductOS</span>
        </div>
        <p className="text-[11px]" style={{ color: L_DETAIL }}>AI-native product operations</p>
      </div>
    </footer>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function Landing({ onEnter }) {
  return (
    <>
      <style>{LANDING_CSS}</style>
      <div style={{ background: L_BG }}>
        <NavBar onEnter={onEnter} />
        <HeroSection onEnter={onEnter} />
        <WorkflowSection />
        <CapabilitiesSection />
        <LiveActivitySection />
        <WhyDifferentSection />
        <CTASection onEnter={onEnter} />
        <PageFooter />
      </div>
    </>
  );
}
