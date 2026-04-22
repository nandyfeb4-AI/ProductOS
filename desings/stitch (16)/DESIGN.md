# Design System: The Professional Intelligence

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Architectural Monolith."** 

Unlike standard SaaS platforms that rely on chaotic grids and heavy drop shadows, this system treats the UI as a high-end editorial experience. It is rooted in the concept of "Structural Intelligence"—where clarity is derived from precision, tonal layering, and intentional white space rather than decorative elements. We move away from the "template" look by utilizing purposeful asymmetry, allowing content to breathe through expansive margins, and using high-contrast typography to establish an authoritative hierarchy. The result is a platform that feels less like a tool and more like a sophisticated intelligence partner.

---

## 2. Colors & Surface Logic

Our palette is anchored in the depths of high-contrast Navy and Slate, providing a stable foundation for the "Professional Intelligence" persona.

### Surface Hierarchy & Nesting
To achieve a premium feel, we move beyond flat design. We treat the UI as a series of physical layers—like stacked sheets of fine paper or polished stone.
*   **The "No-Line" Rule:** Prohibit 1px solid borders for sectioning or layout containment. Boundaries must be defined solely through background color shifts. For example, a `surface_container_low` section should sit directly on a `surface` background to define its territory.
*   **The Layering Principle:** Depth is achieved by stacking tiers.
    *   **Base:** `surface` (#faf8ff)
    *   **In-Page Sections:** `surface_container_low` (#f2f3ff)
    *   **Interactive Cards:** `surface_container_lowest` (#ffffff) to create a subtle "pop" against the lower tiers.
*   **The "Glass & Gradient" Rule:** For floating modals or navigation overlays, use a backdrop-blur (12px–20px) with `surface_variant` at 80% opacity. 
*   **Signature Textures:** Use a subtle linear gradient for primary CTAs transitioning from `primary` (#0058be) to `primary_container` (#2170e4) at a 135-degree angle. This adds a "lithic" quality that flat hex codes cannot replicate.

---

## 3. Typography: The Editorial Edge

The typography scale is designed to convey "The Professional Intelligence"—a balance between the technical precision of **Inter** and the modern, approachable character of **Manrope**.

*   **The Authority Pair:** 
    *   **Manrope (Display & Headline):** Used for high-level data points and section titles. Its geometric nature feels engineered and intentional.
    *   **Inter (Title & Body):** Used for all functional UI and long-form intelligence reports. It ensures maximum readability at small scales.
*   **Scale Usage:**
    *   `display-lg` (3.5rem / Manrope): Use sparingly for hero data visualizations.
    *   `headline-sm` (1.5rem / Manrope): The workhorse for dashboard titles.
    *   `body-md` (0.875rem / Inter): The standard for all data entries and descriptions.
*   **Styling Note:** Maintain a generous line-height (1.5 for body) to ensure the "Editorial" feel. Never track headings too tightly; allow them to command the space.

---

## 4. Elevation & Depth

We reject the "floating" aesthetic of 2010s SaaS. Depth in this system is achieved through **Tonal Layering**.

*   **Ambient Shadows:** If a floating effect is required (e.g., a context menu), use a shadow color derived from `on_surface` (#131b2e) at 4% opacity with a 32px blur and 8px Y-offset. It should feel like a soft glow of light being blocked, not a dark smudge.
*   **The "Ghost Border" Fallback:** If accessibility requires a container boundary, use a "Ghost Border": the `outline_variant` (#c2c6d6) at 20% opacity. 100% opaque borders are forbidden as they interrupt the visual flow.
*   **Negative Depth:** Use `surface_dim` (#d2d9f4) for "inset" areas like search bars or code blocks to create a sense of recession into the page.

---

## 5. Components

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. Radius: `md` (0.375rem). No border.
*   **Secondary:** `surface_container_highest` background with `on_surface` text. 
*   **Tertiary:** Text-only using `primary` color, strictly aligned with the baseline of surrounding text.

### Cards & Lists
*   **Rule:** Forbid divider lines.
*   **Implementation:** Separate list items using `body-md` spacing (1rem vertical padding). Distinguish different content types by shifting the background from `surface_container_low` to `surface_container`.

### Input Fields
*   **State Logic:** Default state uses `surface_container_lowest` with a "Ghost Border." On focus, the border transitions to 100% opacity `primary` (#0058be) but remains 1px. No "glow" or outer rings.

### Intelligence Chips
*   Used for AI-generated tags or status. Use `secondary_container` (#d5e3fc) with `on_secondary_container` (#57657a) text. The corners should be `full` (pill-shaped) to contrast against the structured, rectangular grid of the platform.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts (e.g., a 60/40 split for data and insights) to create a premium, editorial feel.
*   **Do** use `on_surface_variant` (#424754) for labels to create a sophisticated hierarchy against the darker `on_surface` titles.
*   **Do** leverage high-contrast white space. If you think there is enough margin, add 16px more.

### Don’t
*   **Don’t** use 100% black (#000000) or pure grey shadows. Always tint your neutrals with the navy foundation.
*   **Don’t** use neon, "AI-glow," or pulsing animations. Professional Intelligence is stable, fast, and silent.
*   **Don’t** use rounded corners larger than `xl` (0.75rem) for main containers. High-end enterprise requires the structure of tighter radii (`md` or `lg`).

### Final Director's Note
Every pixel must feel like it was placed by a deliberate hand. If an element doesn't serve the clarity of the data, remove it. We are building a cathedral of information, not a playground.