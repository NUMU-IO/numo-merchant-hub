---
name: numu-design
description: Use this skill to generate well-branded interfaces and assets for NUMU (نُمُو), the Egyptian Shopify-style e-commerce platform — either for production or throwaway prototypes/mocks. Contains essential design guidelines, the "Souq" warm-tactile color + type tokens, fonts, brand & payment assets, and a high-fidelity Merchant Hub UI kit. Arabic-first / fully RTL.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

Key files:
- `README.md` — product context, content voice (Egyptian-colloquial Arabic!), visual
  foundations, and iconography rules.
- `colors_and_type.css` — all design tokens (the "Souq" warm palette + IBM Plex Sans Arabic
  / Reem Kufi type; legacy app tokens preserved under `.numu-legacy`).
- `assets/` — NUMU logos, real payment-provider logos (Paymob, Fawry, Kashier, InstaPay),
  channel icons, onboarding illustrations. Copy these out; never redraw them.
- `preview/` — small specimen cards for each foundation/component.
- `ui_kits/merchant-hub/` — interactive Merchant Hub recreation; reusable React components.

Core rules to honor:
- **Arabic-first & RTL** — use logical properties (start/end, ms-/me-), never hardcoded
  left/right. Numbers, currency (EGP / ج.م), and charts stay LTR.
- **Voice** — warm, plain-spoken; Arabic is **Egyptian colloquial** (عامية), not MSA.
- **Type** — IBM Plex Sans Arabic for all UI + headings; Reem Kufi only for the wordmark.
- **Icons** — Phosphor (via Iconify, inline SVG); bold default, duotone for feature chips,
  fill for active states. No second icon family; emoji only as product-image placeholders.
- **Look** — warm sand-cream ground, deep navy primary, saffron accent, chunky radii,
  tactile press-down buttons, mobile-first with ≥44px touch targets.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and
create static HTML files for the user to view. If working on production code, copy assets
and apply the rules here to design on-brand.

If invoked without guidance, ask what the user wants to build, ask a few clarifying
questions, and act as an expert NUMU designer who outputs HTML artifacts or production code.
