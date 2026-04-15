/**
 * AIProgressCard — shared non-blocking in-progress surface for all AI generation steps.
 *
 * Props:
 *   headline  — step-specific headline, e.g. "Synthesizing opportunities"
 *   message   — resolved message string (caller: jobMessage ?? "fallback copy")
 *
 * Ring technique: CSS conic-gradient masked to a ring, spun with animate-spin.
 * This produces a smooth "comet tail" arc instead of a hard strokeDasharray segment.
 */
export default function AIProgressCard({ headline, message }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #ffffff 0%, #f0f5ff 100%)",
        border:     "1px solid #c7d9fd",
        boxShadow:  "0 8px 32px rgba(37,99,235,0.10), 0 2px 8px rgba(15,23,42,0.06)",
      }}
    >
      {/* ── Top pulsing accent stripe ── */}
      <div
        className="h-[3px] animate-pulse"
        style={{ background: "linear-gradient(90deg, #c7d9fd 0%, #2563eb 50%, #c7d9fd 100%)" }}
      />

      {/* ── Main body ── */}
      <div className="flex flex-col items-center py-12 px-8 text-center">

        {/* Ring container */}
        <div className="relative mb-8" style={{ width: 84, height: 84 }}>

          {/* Ambient glow — pulses slowly behind the ring */}
          <div
            className="absolute animate-pulse"
            style={{
              inset: "-16px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(37,99,235,0.20) 0%, transparent 60%)",
              animationDuration: "2s",
            }}
          />

          {/* Track circle */}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: "50%",
              border: "3.5px solid rgba(37,99,235,0.12)",
            }}
          />

          {/*
            Comet-tail ring:
            - conic-gradient: transparent → semi-blue → solid blue over ~70% of arc,
              leaving 30% as the "gap" — creates a comet head + fading tail.
            - mask-image radial-gradient: cuts out the inner circle (radius ≤ 29px),
              leaving a ~13px-wide ring on the 84px container.
            - animate-spin drives the rotation; duration overridden to 1.1s.
          */}
          <div
            className="absolute inset-0 animate-spin"
            style={{
              borderRadius: "50%",
              background: [
                "conic-gradient(",
                "  from 0deg,",
                "  transparent           0deg,",
                "  transparent         108deg,",
                "  rgba(37,99,235,0.25) 180deg,",
                "  rgba(37,99,235,0.65) 270deg,",
                "  #2563eb              360deg",
                ")",
              ].join(""),
              WebkitMaskImage: "radial-gradient(transparent 28px, black 29px)",
              maskImage:       "radial-gradient(transparent 28px, black 29px)",
              animationDuration:       "1.1s",
              animationTimingFunction: "linear",
            }}
          />

          {/* Bright dot at the comet head (12 o'clock when static) */}
          <div
            className="absolute animate-spin"
            style={{
              inset: 0,
              animationDuration:       "1.1s",
              animationTimingFunction: "linear",
            }}
          >
            <div
              style={{
                position: "absolute",
                top:    "3px",
                left:   "50%",
                transform: "translateX(-50%)",
                width:  "7px",
                height: "7px",
                borderRadius: "50%",
                background:   "#2563eb",
                boxShadow:    "0 0 8px 3px rgba(37,99,235,0.55)",
              }}
            />
          </div>

          {/* Icon centred in the ring */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 10 }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                color: "#2563eb",
                fontSize: "22px",
                fontVariationSettings: "'FILL' 0, 'wght' 300",
              }}
            >
              auto_awesome
            </span>
          </div>
        </div>

        {/* Headline */}
        <h3
          className="font-headline font-bold tracking-tight text-on-surface leading-snug mb-3"
          style={{ fontSize: "18px" }}
        >
          {headline}
        </h3>

        {/* Backend message or fallback */}
        <p
          className="text-on-surface-variant leading-relaxed max-w-sm mb-7"
          style={{ fontSize: "13px" }}
        >
          {message}
        </p>

        {/* Staggered bouncing dots */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className="rounded-full animate-bounce"
              style={{
                width:              "8px",
                height:             "8px",
                backgroundColor:    "#2563eb",
                opacity:            0.40,
                animationDelay:     `${d * 180}ms`,
                animationDuration:  "900ms",
              }}
            />
          ))}
        </div>

      </div>

      {/* ── Footer ── */}
      <div
        className="px-8 py-3 flex items-center justify-between gap-4"
        style={{
          background:  "rgba(37,99,235,0.03)",
          borderTop:   "1px solid rgba(37,99,235,0.10)",
        }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: "#2563eb" }}
          />
          <span
            className="font-bold uppercase tracking-widest"
            style={{ fontSize: "10px", color: "rgba(37,99,235,0.60)" }}
          >
            AI generation in progress
          </span>
        </div>
        <p
          className="text-on-surface-variant/50 text-right hidden sm:block"
          style={{ fontSize: "11px" }}
        >
          You can navigate away — this page updates automatically
        </p>
      </div>
    </div>
  );
}
