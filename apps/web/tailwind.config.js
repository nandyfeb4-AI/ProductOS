/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:               "#2563eb",
        "primary-dim":         "#1d4ed8",
        "on-primary":          "#ffffff",
        background:            "#f8fafc",
        surface:               "#ffffff",
        "surface-container":   "#f1f5f9",
        "surface-dim":         "#e2e8f0",
        "on-surface":          "#0f172a",
        "on-surface-variant":  "#64748b",
        sidebar:               "#0f172a",
        "sidebar-hover":       "#1e293b",
        "sidebar-text":        "#94a3b8",
        "sidebar-active":      "#ffffff",
        outline:               "#e2e8f0",
        secondary:             "#0ea5e9",
        "secondary-container": "#d5e3fc",
        "on-secondary":        "#57657a",
        error:                 "#ef4444",
      },
      borderRadius: {
        DEFAULT: "0.375rem",
        md:      "0.375rem",
        lg:      "0.5rem",
        xl:      "0.75rem",
        full:    "9999px",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body:     ["Inter", "sans-serif"],
        label:    ["Inter", "sans-serif"],
      },
      boxShadow: {
        card:        "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        "card-hover":"0 4px 12px rgba(15,23,42,0.08)",
        sidebar:     "4px 0 24px rgba(15,23,42,0.15)",
      },
    },
  },
  plugins: [],
};
