# NUMU "Souq" — Merchant Hub UI kit

A high-fidelity, interactive recreation of the NUMU **Merchant Hub** dashboard, rebuilt
in the **"Souq" redesign** language: warm sand-cream surfaces, deep navy + saffron,
chunky tactile components, Phosphor icons, and full **Arabic / RTL** support.

Open **`index.html`** — it's a click-through prototype:

1. **Login** (brand panel + form) → click **Sign in**.
2. **Dashboard** — greeting, attention cards, KPI cards w/ sparklines, setup-reward
   banner, recent orders + top sellers.
3. **Sidebar nav** → Orders (filterable table w/ bulk-select), Products (cards),
   Customers (cards).
4. **AR/EN toggle** (header globe) — flips the whole UI to RTL with Egyptian-colloquial copy.
5. **Dark mode** (header moon).
6. **Mobile / Desktop toggle** (floating control, bottom-center) — the mobile view shows
   the bottom-nav + stacked, touch-friendly layouts.

## Files
| File | What it holds |
|---|---|
| `index.html` | Entry — loads fonts, Iconify, React/Babel, and the scripts below |
| `app.css` | Kit chrome + layout (sidebar, header, cards, buttons, table, mobile) |
| `Icons.jsx` | `<Icon name weight>` — Phosphor via Iconify, light-DOM inline SVG |
| `data.js` | Mock products / orders / customers + EN/AR strings (`tx` helper) |
| `Primitives.jsx` | `Avatar`, `Sparkline`, `StatusPill`, `PayPill`, `CountUp` |
| `Chrome.jsx` | `Sidebar`, `Header`, `MobileNav` |
| `Screens.jsx` | `Dashboard`, `Orders`, `Products`, `Customers`, `Login` |
| `App.jsx` | State orchestration (auth, route, AR/EN, dark, mobile) |

## Notes
- Tokens come from the root `../../colors_and_type.css` (the "Souq" system).
- Icons render as **light-DOM inline SVG** (not the `<iconify-icon>` web component) so they
  survive screenshots and offline bundling.
- This is a **cosmetic recreation** for design exploration — no real data/network. It
  faithfully reflects the redesign's visual + interaction language, not production code.
- Everything uses **logical properties** (start/end) so RTL flips cleanly.
