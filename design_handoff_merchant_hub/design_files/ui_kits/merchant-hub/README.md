# NUMU "Souq" — Merchant Hub UI kit

A high-fidelity, interactive recreation of the NUMU **Merchant Hub** dashboard, rebuilt
in the **"Souq" redesign** language: warm sand-cream surfaces, deep navy + saffron,
chunky tactile components, Phosphor icons, and full **Arabic / RTL** support.

Open **`index.html`** — it's a click-through prototype:

1. **Login** (brand panel + form) → click **Sign in**.
2. **Strategic Dashboard** — reorganized into three question-led zones:
   **§ TODAY** (Sales hero w/ watermark + saffron sparkline · "who's waiting" card · KPI
   tiles: Orders / Visitors / Conversion / Net profit) → **§ NEEDS YOU** (triage list +
   store-health ring) → **§ GROW** (revenue chart, top sellers, recent orders).
3. **Reorganized sidebar nav** (see IA below) — grouped, with expandable sub-pages.
4. **Destination screens** — Orders, Products, Customers, Online Store, Marketing,
   Analytics, Finance, COD reconcile, Logistics, Settings.
5. **First-time toggle** (floating control) — zero-data dashboard with a pinned saffron→sage
   onboarding strip over a ghosted scaffold (structure stays visible, never hidden).
6. **AR/EN toggle** (header globe) — flips the whole UI to RTL with Egyptian-colloquial copy.
7. **Dark mode** (header moon).
8. **Mobile / Desktop toggle** — mobile shows the 76px bottom nav (Home · Orders · ＋FAB ·
   Products · More) plus **More** and **Quick add** bottom sheets.

## Navigation IA (reorganized)
Frequency-weighted + task-based. A **pinned** zone holds the daily drivers; everything else
is grouped by intent, with deep features tucked into expandable parents. Settings lives in
the footer, off the daily path.

| Zone | Items |
|---|---|
| _(pinned)_ | **Home** · **Orders** ⌄ (All · Drafts · Abandoned · Shipping labels) · **Products** ⌄ (All · Categories · Inventory) · **Customers** |
| **Sell & grow** | **Online Store** · **Marketing** ⌄ (Discounts · Campaigns · WhatsApp) · **Analytics** |
| **Money** | **Finance** ⌄ (Payouts · Invoices) · **COD reconcile** |
| **Operations** | **Logistics** ⌄ (Zones · Couriers) |
| _(footer)_ | **Settings** · store switcher |

## Files
| File | What it holds |
|---|---|
| `index.html` | Entry — loads fonts, Iconify, React/Babel, and the scripts below |
| `app.css` | Kit chrome + layout (sidebar, header, cards, buttons, table, mobile) |
| `Icons.jsx` | `<Icon name weight>` — Phosphor via Iconify, light-DOM inline SVG |
| `data.js` | Mock products / orders / customers + EN/AR strings (`tx` helper) |
| `Primitives.jsx` | `Avatar`, `Sparkline`, `StatusPill`, `PayPill`, `CountUp` |
| `Chrome.jsx` | `Sidebar` (2-level expandable IA), `Header`, `MobileNav`, `MoreSheet`, `AddSheet` |
| `Screens.jsx` | `Orders`, `Products`, `Customers`, `Login` + shared `PageHead`/`StatTile` |
| `DashboardScreen.jsx` | Strategic zone-based `Dashboard` (full data + first-time, desktop + mobile) |
| `ScreensExtra.jsx` | `Finance`, `COD`, `Logistics`, `Analytics`, `OnlineStore`, `Marketing`, `Settings` |
| `App.jsx` | State orchestration (auth, route + sub-routes, AR/EN, dark, mobile, first-time) |

## Notes
- Tokens come from the root `../../colors_and_type.css` (the "Souq" system).
- Icons render as **light-DOM inline SVG** (not the `<iconify-icon>` web component) so they
  survive screenshots and offline bundling.
- This is a **cosmetic recreation** for design exploration — no real data/network. It
  faithfully reflects the redesign's visual + interaction language, not production code.
- Everything uses **logical properties** (start/end) so RTL flips cleanly.
