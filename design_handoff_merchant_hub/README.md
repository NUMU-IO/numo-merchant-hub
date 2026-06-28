# Handoff: NUMU "Souq" — Merchant Hub (nav IA + dashboard + core screens)

## Overview
This package specifies the **NUMU Merchant Hub** — the mobile-first, Arabic-first admin
where an Egyptian small-business owner runs their store (orders, products, COD, shipping,
payments, WhatsApp). It covers a **reorganized navigation IA**, a **strategic dashboard**,
and **internal redesigns of every core screen**.

NUMU is a Shopify-style commerce platform for SMBs in Cairo / Alexandria / Mansoura.
The design language is **"Souq"** — warm, tactile, trustworthy: white app ground, deep
navy primary, saffron energy accent, chunky radii, soft warm-navy shadows.

## About the Design Files
The files under `design_files/` are **design references built in HTML/React-via-Babel** —
runnable prototypes that show the intended look, layout, and behavior. **They are not
production code to copy verbatim.** The Babel-in-browser setup, the inline-style-heavy
JSX, and the global-script component pattern are prototyping conveniences, not patterns to
ship.

Your task: **recreate these designs in the target codebase's real environment.** The
source product is a **React + TypeScript + Vite + Tailwind + react-router** app (a
`tailwind.config.ts` and route table already exist). Implement against that — real
components, real routing, real state, the project's existing libraries. If you are starting
greenfield, React + TypeScript + Tailwind is the expected stack.

Open `design_files/ui_kits/merchant-hub/index.html` in a browser to interact with the
reference: click **Sign in**, then use the sidebar, the header AR/EN + dark toggles, and the
floating **Desktop/Mobile** + **Full-data/First-time** controls.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, motion, and copy are
all specified. Recreate the UI pixel-faithfully using the codebase's component library and
the design tokens below. Mock data in the prototype (`data.js`) is placeholder — wire real
data/endpoints in their place.

---

## Hard rules (non-negotiable — they define the product)
1. **Arabic-first & full RTL.** Every layout must mirror cleanly. Use **logical CSS
   properties only** (`margin-inline-start`, `inset-inline-end`, `padding-inline`,
   `text-align: start/end`, `border-inline-end`) — never hard-coded `left`/`right`. The
   prototype sets `dir="rtl"` on the root in Arabic.
2. **Numbers, currency, dates, tracking codes, and chart axes stay LTR even in Arabic UI.**
   Wrap them so they don't reorder (the prototype uses a `.ltr-nums { direction: ltr;
   display: inline-block }` helper). This is the Shopify/Stripe/Salla convention.
3. **Currency formatting:** English → `EGP 1,250`. Arabic → `1,250 ج.م` with
   Arabic-Indic digits via `(1250).toLocaleString("ar-EG")` → `١٬٢٥٠ ج.م`.
4. **Mobile-first. Touch targets ≥ 44px.** Mobile bottom nav is **76px** tall with a raised
   navy/saffron **FAB** at the center.
5. **Arabic copy is Egyptian colloquial (عامية مصرية)**, never MSA. e.g. "صباح الفل"
   (greeting), "دوّر في المنتجات" (search), "اتشحن / اتسلّم" (shipped/delivered),
   "محتاج اهتمامك" (needs attention). No emoji in chrome (nav/headings/buttons); emoji used
   only as mock product-image placeholders (👕 👜 🧴).
6. **Don't touch auth pages** (Login/Forgot/Reset/Verify/Onboarding wizard) — they use a
   separate existing brand-surface kit and are out of scope here.

---

## Navigation IA (the core deliverable)
Frequency-weighted + task-based. A **pinned** zone holds the daily drivers; everything else
is grouped by intent. Some parents **expand** to reveal sub-pages (a caret chevron rotates
180° on open; children render as an indented list with a connecting hairline and a small
dot per item — the dot fills saffron when active). The active **child** sets a sub-route;
the **parent** highlights via its base key. Settings lives in the footer with a store
switcher, off the daily path.

| Zone (group label) | Item (route) | Sub-items (sub-routes) |
|---|---|---|
| _(pinned, no label)_ | **Home** `/` | — |
| | **Orders** `/orders` · badge **6** | All `/orders` · Drafts `/orders/drafts` · Abandoned `/orders/abandoned` · Shipping labels `/orders/shipping-labels` |
| | **Products** `/products` | All `/products` · Categories `/categories` · Inventory |
| | **Customers** `/customers` | — |
| **Sell & grow** | **Online Store** `/online-store` | — |
| | **Marketing** `/marketing` | Discounts · Campaigns · WhatsApp |
| | **Analytics** `/analytics` | — |
| **Money** | **Finance** `/payments` | Payouts · Invoices |
| | **COD reconcile** `/cod` · badge **4** | — |
| **Operations** | **Logistics** `/logistics` | Zones · Couriers |
| _(footer)_ | **Settings** `/settings` + store switcher | — |

**Sidebar visuals:** 264px wide, white surface, hairline end-border. Brand row = 38px navy
rounded-square mark (the N monogram) + "numu" in Reem Kufi (navy; in dark mode → `--ink`).
Group labels: 11px, 700, uppercase, +0.08em tracking, `--ink-faint`. Nav item: 46px tall,
14px/600, 14px radius, `--ink-soft`; **hover** → `--surface-2` fill; **active** → solid
`--navy` fill, white text, **icon turns `--saffron`**, soft `--shadow-sm`. Count badge:
saffron pill, `--navy-900` text, 22px min, tabular-nums. Icons are **Phosphor** — `duotone`
weight at rest, `fill` weight when active.

**Mobile bottom nav (76px):** Home · Orders (saffron count badge) · **＋ FAB** · Products ·
**More**. The FAB (50px navy rounded-square, saffron `+`, raised −14px with `--depth-navy`)
opens a **Quick add** bottom sheet (New product / New order / New discount). **More** opens
a bottom sheet listing the entire IA as grouped tiles. Active tab is navy (saffron in dark).

---

## Screens / Views

### 1. Dashboard (`/`) — strategic, three question-led zones
Answers the merchant's real questions in order. Header greeting: "صباح الفل، أحمد 👋" +
one-line status, with **View store** (outline) and **Add product** (navy) actions.

Each zone opens with a **zone header**: a mono eyebrow `§ TODAY` (terracotta, +0.18em,
uppercase) + a faint question + a hairline rule.

- **§ TODAY — "Did I make money — and is anyone waiting on me?"**
  - **Sales hero** (navy card, `--r-lg`, min-height 170px): label "Sales · today", a
    **sage delta pill** (`+12.4%`, bg `rgba(94,138,92,.26)`, text `#9FD89C`), the value in
    `--font-display` 35px/800 (`EGP 48,250`), a **saffron sparkline** across the bottom, and
    a **watermark N monogram** bottom-end corner at ~7% opacity
    (`assets/numu-symbol-white-transparent.webp`).
  - **Waiting-on-you card**: saffron hourglass chip, big count `2`, "Fulfill" accent button,
    then rows for oldest order (`#NM-2836 · 6h`) and its value.
  - **KPI tiles row (4):** Orders / Visitors / Conversion / Net profit. Each = white card,
    15px pad, a duotone **icon chip** (`--ichip` tones: navy/sage/terra/saffron), a delta
    pill (up = `--success`/`--success-bg`, down = `--terracotta`/`--danger-bg`), a 12px
    label, and the value in `--font-display` 23px/800 **tabular-nums**.
- **§ NEEDS YOU — "Is anything broken?"**
  - **Triage list** (card): rows for "2 orders waiting to be fulfilled → Fulfill", "2 products
    low on stock → Restock", "4 COD shipments to reconcile → Reconcile" (+ EGP value), "1
    abandoned checkout → Remind". Each row: icon chip + lead/desc + an end CTA with a caret
    (caret flips direction by `dir`). Row hover = `--surface-2`.
  - **Store-health card**: conic-gradient ring (sage progress over `--surface-2` track),
    centered score `86/100`, "Great", supporting line.
- **§ GROW — "What should I do next?"**
  - **Revenue chart** (smooth area, navy stroke + faint gradient fill, dashed gridlines,
    weekday axis) + **Top sellers** (ranked list with emoji thumb + revenue).
  - **Recent orders** list (avatar + name + mono `#id · time` + status pill + amount).

**First-time variant** (toggle in the prototype; in production = zero-data state):
a **pinned onboarding strip** sits at the very top — navy panel, gift chip, title "Finish
setting up your store", sub "Complete all 4 steps & get 1 month Premium — free", a
**saffron→sage progress bar** at 25%, a `1/4` counter, **Start** button, and 4 step pills
(done = sage/checkmark, now = saffron-outlined, todo = faint). Below it the **full dashboard
scaffold renders but ghosted** (`opacity:.5; filter:saturate(.85); pointer-events:none`) —
so the merchant sees the structure they're working toward without it feeling hidden. The
hero shows `EGP 0` with a dashed empty bar, KPIs show `0`/`—`, the health ring is empty.
This solves "show the dashboard structure without making onboarding feel hidden": onboarding
is the one **live** element above a clearly-inactive preview of the real thing.

### 2. Orders (`/orders`)
Page header (title + sub + Export/New order). 4 stat tiles (All / Pending / Shipped /
Revenue). **Filter chips** (All/Pending/Processing/Shipped/Delivered) — a chip flips to
**solid navy** when active — plus a search affordance. **Orders table**: checkbox select,
order id (mono) + time/units, customer (avatar + name + city), payment pill, **status pill**
(soft 14% tinted bg via `color-mix`, colored dot), amount (display/800, end-aligned).
Selecting rows reveals a **navy bulk-action bar** ("N selected" + Fulfill). Clicking a row
opens the **Order drawer** (slides from the inline-end): customer + WhatsApp button, items,
payment summary, a **timeline** (sage filled steps), and footer Print / Fulfill. Fulfilling
shows a navy toast "Order fulfilled ✓".

### 3. Products (`/products`)
Header (Import / Add product). 4 stat tiles. Tabs (All / Published / Drafts). **Product card
grid** (3-up desktop, 1-up mobile): emoji thumb, name, category + mono id, price (+ struck
`was` price), draft pill, and a **stock bar** (sage; turns `--terracotta` when ≤10). Cards
**hover-lift −3px** with a deeper shadow.

### 4. Customers (`/customers`)
Header + Export. 3 **segment cards** (VIP / Loyal / New, each icon chip + count). **Table**:
customer (avatar + name), region, segment pill (tinted), orders (tabular, centered), total
spent (display/800, end-aligned).

### 5. Finance (`/payments`)
Header + Export. **Balance hero** (navy, watermark N): "Available to pay out" + big value +
**Pay out now** (saffron) + "Next auto payout: Thursday". Two stat tiles (Pending clearance,
COD in transit). A **COD callout** card → "Reconcile COD". Segmented control (Overview /
Payouts / Invoices) routing to sub-routes. **Transactions table** (mono ref, method pill,
date, signed amount — green `+` in / terracotta `−` out).

### 6. COD reconcile (`/cod`)
Header + "Reconcile all". 3 tiles (Collected this month / To reconcile / Reconciled).
**Table** of COD orders with Collected (success) vs Pending (warning) status pills and
amounts.

### 7. Logistics (`/logistics`)
Header (Print labels / New shipment). 4 tiles (Ready to ship / In transit / Out for delivery
/ Returns). Segmented (Shipments / Zones / Couriers):
- **Shipments**: table — order id, courier, destination city, **LTR tracking code**, status pill.
- **Zones**: list — zone name, business days (LTR), fee. (Cairo & Giza 1–2d 50; Alexandria
  2–3d 65; Delta & Canal 2–4d 70; Upper Egypt 3–5d 90.)
- **Couriers**: cards — Bosta / Aramex / Mylerz / R2S, active count + ETA + "Connected" pill.

### 8. Analytics (`/analytics`)
Header + date-range segmented (7 / 30 / 90 days). 4 KPI tiles (Revenue / Net profit /
Conversion / Repeat rate, with deltas). **Revenue bar chart** (12 months; last bar saffron,
rest navy). **Sales by channel**: a stacked proportion bar + legend (Online store 62 / IG 21
/ WhatsApp 11 / Facebook 6). **Conversion funnel**: 4 rows (Visits → Added to cart → Reached
checkout → Purchased) each a navy gradient fill bar with the count inside + % at the end.
**Top products** ranked list.

### 9. Online Store (`/online-store`)
Header (Visit store / Customize). **Live theme** card with a CSS mock-storefront preview
(navy header band + product-emoji grid), domain `cairothreads.numu.store`, Published pill,
Customize. **Pages** list (Home/About/Shipping published, Contact draft). **Themes** gallery
(Souq=navy live, Bazaar=terracotta, Minimal=sage) each with a preview + Preview button.

### 10. Marketing (`/marketing`)
Header + New discount. 4 tiles (Active discounts / Campaigns / Reach / Redeemed). Segmented
(Overview / Discounts / Campaigns / WhatsApp):
- **Discounts**: table — code (mono, navy), type, redeemed count, Active/Ended pill.
- **Campaigns**: cards — Ramadan offers / New arrivals, Live pill, reach + redeemed stats.
- **WhatsApp**: broadcast card — sage WhatsApp chip, last broadcast, sent / opened %,
  New broadcast.

### 11. Settings (`/settings`)
Header + a 2-col grid of hover-lift cards: Store profile, Payments, Shipping, Staff & roles,
Notifications, Plan & billing — each icon chip + title + description + end caret.

---

## Interactions & Behavior
- **Motion/easing:** entrances and drawer/sheet slides use **`cubic-bezier(0.16, 1, 0.3, 1)`**
  ("out-expo"). Hover transitions use `ease-out` ~160ms.
- **Buttons — tactile "key" press:** navy and saffron buttons carry a 2px solid bottom shadow
  (`--depth-navy` / `--depth-saffron`); on `:active` they `translateY(2px)` and drop the
  bottom shadow so the button physically presses down.
- **Cards hover-lift** −2 to −3px with a deeper warm shadow over ~200ms.
- **Filter chips** flip to solid navy when on; **status pills** use soft 14% tinted
  backgrounds (`color-mix(in srgb, <color> 14%, transparent)`), never saturated blocks.
- **Order drawer** and **bottom sheets** slide in from the inline-end / bottom with a dimmed
  backdrop; closing on backdrop click.
- **Watermark navy panels** use the N monogram at ~6–7% opacity as a corner accent.
- **⚠️ Animation caveat:** keep entrance transforms small (never fully off-screen / never
  `opacity:0` as the only visible state) so content stays visible if a tab is backgrounded
  and CSS animations are throttled. (In a real React app this matters less, but bottom
  sheets sliding `translateY(100%)` from a frozen state can hide content — slide a modest
  distance.)
- **Theme & locale** are global toggles (dark mode, AR/EN). **Currency/number formatting is
  locale-derived** (see hard rules).

## State Management
Minimum state the screens imply:
- `route` + optional `subRoute` (the parent/child IA). In production use react-router; the
  table above lists real paths.
- `locale` (`en` | `ar`) → sets `dir` and copy; `theme` (`light` | `dark`).
- `viewport` (the prototype fakes desktop/mobile; in production this is just responsive CSS).
- `firstTime` / store-setup completion (drives the onboarding strip + ghosted zero-data
  dashboard). Real value comes from the store's setup status.
- Per-screen UI state: order filter, product tab, selected-rows + bulk bar, open order
  drawer, open mobile sheet (more/add), analytics date range, finance/logistics/marketing
  segmented tab.
- Data fetching: orders, products, customers, transactions/payouts, shipments, analytics
  aggregates, discounts/campaigns, store/theme/pages. The prototype's `data.js` is the
  placeholder shape.

## Design Tokens
Full source: **`design_files/colors_and_type.css`** (light `:root` + `.dark` overrides +
status ramp). Key values:

**Color (light)**
- Surfaces: `--bg`/`--surface` `#FFFFFF` · `--surface-2` `#F5F2EB` · `--surface-3` `#ECE7DC` · `--cream` `#F4EDE0`
- Ink: `--ink` `#14253D` · `--ink-soft` `#5B6A7E` · `--ink-faint` `#909BAA`
- Brand: `--navy` `#0C2D54` · `--navy-700` `#143C6E` · `--navy-900` `#081F3C` · `--saffron` `#E89A2C` · `--saffron-600` `#D2841A` · `--saffron-100` `#FBEBCF` · `--terracotta` `#C14A1C` · `--sage` `#5E8A5C`
- Lines: `--border` `#ECEAE3` · `--border-strong` `#DCD6C9`
- Semantic: success `#2E9E5B`/bg `#E2F1E7` · warning `#DE941E`/bg `#FBEBCF` · danger `#D64541`/bg `#F8E2E1` · info `#2D6CB5`/bg `#E2ECF7`
- Order status ramp: delivered `#2E9E5B` · shipped `#2D6CB5` · confirmed `#2E8B8B` · processing `#DE941E` · pending `#8A93A3` · cancelled `#D64541`
- Dark mode: see `.dark` block (navy becomes a luminous `#2E6BB3` for contrast; surfaces go `#0B1420`/`#131F2E`).

**Radii:** xs 8 · sm 12 · base 16 · lg 20 (cards) · xl 26 (feature panels) · pill 999

**Shadows:** `--shadow-sm`, `--shadow-card`, `--shadow-lg`, `--shadow-pop`; tactile
`--depth-navy` = `0 2px 0 var(--navy-900), 0 6px 14px -4px rgba(12,45,84,.45)` and the
saffron equivalent.

**Type:**
- `--font-ui` / `--font-display` = **IBM Plex Sans Arabic** (body, UI, headings, KPIs)
- `--font-brand` = **Reem Kufi** (wordmark / brand lockup ONLY)
- `--font-mono` = **JetBrains Mono** (ids, § eyebrows, codes)
- Scale: display 32 · h1 24 · h2 19 · body 15 · sm 13 · xs 12 · 2xs 11. KPIs/amounts use
  `font-variant-numeric: tabular-nums`. **Minimum body text 12px on mobile.**
- Fonts load from Google Fonts in the prototype; self-host or use the codebase's font
  pipeline in production.

## Assets
In `design_files/assets/` (copy into the app's asset pipeline):
- **`numu-app-icon-stars.jpg`** — the current **N monogram / app icon** (also wired as the
  favicon). Cream interlocking N on navy with subtle star corners.
- `numu-symbol-white-transparent.webp` / `numu-symbol-navy-transparent.webp` — transparent
  marks for **watermarks** (navy panels) and light-surface use.
- `numu-n-mark.jpg`, `numu-mark*.webp`, `numu-logo-320.webp` — additional mark variants.
- `payments/` — Paymob, Fawry, Kashier, InstaPay logos/icons (first-class payment rails).
- `icons/` — cod, fraud-detection, whatsapp chips. `onboarding/` — illustration set.
- **Icons:** **Phosphor** (via `@phosphor-icons/react` in a real React app) — `bold` default,
  `duotone` for feature chips, `fill` for active nav. The prototype loads them via the
  Iconify `ph:` set; map names 1:1.

## Files
- `design_files/ui_kits/merchant-hub/index.html` — runnable reference entry point.
- `…/App.jsx` — orchestration: auth, route + sub-route split, locale/theme/viewport,
  first-time, mobile sheets. **Read this to understand the IA wiring.**
- `…/Chrome.jsx` — Sidebar (2-level expandable IA), Header, MobileNav, MoreSheet, AddSheet.
- `…/DashboardScreen.jsx` — the strategic zone dashboard (full + first-time, desktop+mobile).
- `…/Screens.jsx` — Orders, Products, Customers, Login + shared `PageHead`/`StatTile`.
- `…/ScreensExtra.jsx` — Finance, COD, Logistics, Analytics, OnlineStore, Marketing, Settings.
- `…/Primitives.jsx` — Avatar, Sparkline, StatusPill, PayPill.
- `…/Icons.jsx` — Phosphor icon renderer. `…/data.js` — placeholder data + EN/AR strings.
- `…/app.css` — all chrome/layout/zone/component styles (the styling source of truth).
- `design_files/colors_and_type.css` — design tokens (light + dark).
- `…/README.md` — kit walkthrough.
