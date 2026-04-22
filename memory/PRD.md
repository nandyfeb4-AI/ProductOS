# ProductOS Landing Page — PRD

## Original Problem Statement
Build a premium SaaS landing page for **ProductOS** — an AI-native product operations platform that connects Discovery (Miro, Notion, workshops) → AI agents (feature generation, refinement, slicing) → Delivery systems (Jira, Linear). Quality bar: Linear.app / Stripe.com / Vercel.com.

## User Choices (captured)
- Scope: Landing page only (user already has the full-stack app)
- Typography: agent's call → chose **Inter Tight** (display) + **Inter** (body) + **JetBrains Mono** (UI chrome)
- Trust logos: random placeholder wordmarks (Northwind, Helix, Lumen, Atlas·Co, Meridian, Cutlass, Polaris, Octave)
- Palette: derived from the real app screenshot — deep navy `#0A0E1A`, primary blue `#4F7FFF`, teal accent `#2DD4BF` (used sparingly)

## Architecture
- Static React SPA (no backend calls on landing)
- Route `/` → `pages/Landing.jsx` composed of 9 section components under `components/landing/`
- Animations: `framer-motion` (scroll-triggered `whileInView` + subtle row-state rotations with `AnimatePresence`)
- Styling: TailwindCSS + custom CSS utilities in `index.css` (radial glow, grid bg, pulse, marquee, noise overlay)
- Fonts: loaded from Google Fonts at the top of `index.css`

## Implemented (2026-04-21)
- ✅ Navbar (sticky, transparent → dark blur on scroll)
- ✅ Hero — dark full-width, live product-UI mock with rotating agent statuses
- ✅ Watch It Work — light section, live activity feed + pulsing dot + console strip
- ✅ How It Works — 4-step flow (Workshop → Features → Stories → Jira) with numbered badges
- ✅ Capabilities — 3 cards (Feature Hardening, Backlog Refinement, Competitor Analysis)
- ✅ Connectors — input / ProductOS-center / output tri-column with orbiting rings
- ✅ Trust — infinite logo marquee + 4 KPI stats
- ✅ Final CTA — dark rounded card with radial glow + dual buttons
- ✅ Footer — 4-column nav + legal strip
- ✅ Full data-testid coverage (40+ ids)
- ✅ Responsive 1440 / 1024 / 768 / 390 / 375 (0px horizontal overflow on mobile after fix)
- ✅ 0 console errors (verified by testing_agent_v3 — 95% frontend success)

## Next Action Items (P1 / P2 / backlog)
- P1: Swap placeholder logos with user's real customer logos once provided
- P1: Add real brand logo when user's ProductOS logo is ready (currently using a built-in SVG mark)
- P2: Wire `Log in` and `Get started` CTAs to the real app's auth routes
- P2: Add dedicated `See how it works` video/modal player
- P2: Changelog / Docs / Blog routes for the footer links
- P3: Add OG/Twitter meta image; sitemap.xml; robots.txt
- P3: Pause marquee on hover; add `prefers-reduced-motion` respect
- P3: i18n scaffolding if expanding beyond English
