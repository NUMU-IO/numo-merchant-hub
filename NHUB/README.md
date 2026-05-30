# NUMU — Design System

> **NUMU (نُمُو)** is an Egyptian e-commerce platform (Shopify-style) for local merchants.
> This repository is the **design system** powering NUMU's surfaces — tokens, type,
> assets, content rules, and a high-fidelity **Merchant Hub** UI kit.

NUMU is **Arabic-first and fully RTL**, used heavily on mobile by small Egyptian
businesses. The flagship surface is the **Merchant Hub**: the dashboard where store
owners manage products, orders, customers, payments, logistics, and marketing.

> ### ⭐ Redesign direction — NUMU "Souq" (v2)
> This system has been **evolved into a warmer, more tactile rebrand** (same brand
> family, fresh take). Headlines below describe both the original product and the
> redesign; where they differ, **the "Souq" redesign is canonical**:
> - **Palette:** **white** app ground + deep **NUMU navy** primary + **saffron** energy accent;
>   warmth (cream/sand) kept only as subtle insets + accents. Terracotta + sage support.
> - **Type:** NUMU's real product fonts — **IBM Plex Sans Arabic** for all UI + headings,
>   **Reem Kufi** reserved for the wordmark. (No new display face introduced.)
> - **Components:** chunky radii (16–24px), pill buttons with a tactile press-down "key"
>   depth, big touch targets — **mobile-first**.
> - **Icons:** **Phosphor** (bold + duotone + fill), rendered as inline SVG via Iconify.
>
> Tokens live in `colors_and_type.css`; the redesign is realised in `ui_kits/merchant-hub/`.

---

## 1. Product & company context

NUMU lets a single merchant own and manage **multiple stores**, each on its own
subdomain (e.g. `my-brand.numu.io`). There are three sibling surfaces under one brand:

| Surface | What it is | Status here |
|---|---|---|
| **Merchant Hub** | The merchant dashboard (this design system's focus). React 18 + TS + Vite, shadcn/ui, Tailwind, i18next. | UI kit built (`ui_kits/merchant-hub/`) |
| **Storefront** | The multi-tenant public shop each store gets. Theme-engine driven (5 built-in themes, Shopify-style section architecture). | Documented, not rebuilt |
| **Admin backoffice** | NUMU's internal ops/admin surface. | Documented, not rebuilt |

The merchant audience is **mostly small businesses, mobile-first** (they run the store
from a phone), and **many are not power users** — so clarity beats density everywhere.
The market is **cash-on-delivery heavy** and **WhatsApp-centric** for customer comms.
Local payments are first-class: **Paymob, Fawry, Kashier, InstaPay**.

### Sources this system was built from (read-only, mounted codebases)

- **`numo-merchant-hub/`** — the full Merchant Hub app (the canonical source).
  - `src/index.css` — the HSL CSS-variable token system (light + dark) + brand "auth surface" kit.
  - `tailwind.config.ts` — token → Tailwind mapping, radii, fonts, animations.
  - `src/i18n/en.ts` + `src/i18n/ar.ts` — all UI copy (English + Egyptian-colloquial Arabic).
  - `src/pages/*` — route-level screens (Dashboard, Orders, Products, Customers, Analytics, …).
  - `src/components/layout/*` — AppSidebar, AppHeader, MobileBottomNav, DashboardLayout.
  - `src/components/ui/*` — 48 shadcn/ui primitives (button, card, badge, table, …).
  - `public/` — logos, payment-provider logos, onboarding illustrations, icons.
  - `MERCHANT-HUB-DEEP-DIVE.md` — a 1,800-line engineering deep-dive (architecture, services, routing).
- **`components/`** — a mirror of `numo-merchant-hub/src/components/` (same files).
- **`src/`** — a mirror of `numo-merchant-hub/src/` (same files, plus extra pages/services).

> The reader of this README may not have access to those mounts — everything needed to
> design on-brand has been distilled into this folder. Assets are copied into `assets/`.

Tech stack (for context): React 18.3 · TypeScript 5.6 · Vite 5 (SWC) · Tailwind 3 ·
shadcn/ui (Radix) · TanStack Query · react-hook-form + Zod · react-router 6 · i18next ·
Recharts · lucide-react icons · Sentry.

---

## 2. CONTENT FUNDAMENTALS

NUMU's voice is **warm, plain-spoken, and encouraging** — a helpful colleague, not a
corporation. The Arabic and English voices are deliberately different in register.

### Voice & tone
- **English:** clear, friendly, lightly imperative. Short sentences. Action-first.
- **Arabic:** **Egyptian colloquial (عامية مصرية)** — not Modern Standard Arabic. This is
  the single most distinctive content trait. It sounds like a real Egyptian person talking
  to a shop owner. Examples straight from the app:
  - "إيراد النهارده" (*today's revenue* — "النهارده" is colloquial, MSA would be "اليوم")
  - "دوّر في المنتجات والطلبات..." (*search products and orders* — "دوّر" = "look/search around")
  - "صباح الفل" / "مساء الفل" (warm colloquial greetings, not literal good morning/evening)
  - "عندك ٣ طلبات محتاجة اهتمامك" (*you have 3 orders needing your attention*)
  - "يلا نبدأ رحلة تجهيز متجرك" (*let's start setting up your store* — "يلا" = "let's go")
  - "حته" used as a casual unit word; "المكسب" for profit; "إمبارح" for yesterday.

### Person & address
- Speaks to the merchant directly as **"you / إنت"** (second person). "Your store",
  "your products", "metga­rak / متجرك".
- NUMU refers to itself sparingly and in first-person plural ("we'll review…", "كلمنا").

### Casing & formatting
- English UI labels are **Title Case for nav/buttons** ("Add Product", "View Reports")
  and **sentence case for descriptions** ("Start by adding products and getting your first order").
- The wordmark is **lowercase** in Latin (`numu`) and **نُمُو** in Arabic (with full tashkeel/harakat).
- **Numbers, currency and dates render LTR even in RTL** (industry convention). Arabic
  numerals localize (`toLocaleString("ar-EG")` → ٣٠ instead of 30) but layout stays LTR.
- Currency: **EGP**, shown as `EGP 1,250` (en) / `1,250 ج.م` (ar). VAT is 14%.

### Microcopy patterns
- **Empty states are encouraging, never dead-ends:** they explain what the thing is and
  give the next action. e.g. drafts: "Start a new draft to save an in-progress order for
  later — customers don't see drafts until you convert them."
- **Onboarding is gamified and rewarding:** "Set up your store & get 1 month Premium free",
  milestone rewards ("First 5 orders → 10% off subscription").
- **Status & attention banners are specific:** "{n} orders need fulfillment", "Trial Expired".

### Emoji
- **Not used as decoration in UI chrome.** No emoji in nav, headings, buttons, or banners.
- Emoji appear **only as product-image placeholders in mock/demo data** (👕 👜 🧴) — a
  stand-in for a real product photo, never a design element. Treat real designs as
  photo-driven; do not introduce decorative emoji.

### Vibe
Modern SaaS confidence (Stripe / Linear / Vercel) translated for an Egyptian SMB owner:
**trustworthy, calm, and on their side.** Generous whitespace, no jargon, no hype.

---

## 3. VISUAL FOUNDATIONS

NUMU runs a **warm, tactile palette** (the "Souq" redesign). One coherent system across
surfaces, with a brand-warm auth/onboarding treatment.

### Palette (Souq — canonical)
- **Ground:** clean **white** `#FFFFFF` (app canvas + cards, separated by hairline + soft shadow).
- **Surfaces:** subtle warm **inset** `#F5F2EB`, `#ECE7DC` track, warm `#ECEAE3` hairlines.
- **Primary:** deep **NUMU navy** `#0C2D54` (hover `#143C6E`, press `#081F3C`).
- **Accent:** **saffron** `#E89A2C` — CTAs, highlights, count badges, active nav icons.
- **Support:** **terracotta** `#C14A1C`, **sage** `#5E8A5C`, **ink** `#14253D` text.
- Signature pairing: **saffron-on-navy** (e.g. active nav icon, count badges).
- *Legacy (original app):* cool near-white `#FCFCFC` + navy-ink `#0F1B2D` HSL token set —
  preserved under `.numu-legacy` in `colors_and_type.css` for reference.

Full token values live in **`colors_and_type.css`**.

### Color usage
- Semantic status colors are consistent and LTR-safe: **green** = delivered/paid,
  **blue** = shipped, **teal** = confirmed, **amber** = processing/warning, **slate** =
  pending, **red** = cancelled. Status renders as a **soft tinted pill** (color at ~14%
  background), never a solid block.
- Primary buttons are navy; the **saffron** accent button is reserved for the single most
  important action (reward/CTA). Destructive is red.
- **Avoid gradient backgrounds** on cards/heroes; the system is flat + hairline + warm soft
  shadow. The one gradient is the onboarding progress bar (saffron→sage).

### Typography
- **IBM Plex Sans Arabic** is the entire UI workhorse (Arabic + Latin, weights 300–700) —
  body, tables, **and headings/KPIs** (at 700/800). Excellent Arabic shaping + tabular figures.
- **Reem Kufi** is reserved for the **wordmark / brand lockup only** (`numu` / `نُمُو`).
- **Tajawal** is an Arabic fallback; **JetBrains Mono** for § labels, codes, ⌘K hints.
- *(The redesign deliberately keeps NUMU's real product fonts — no new display face.)*
- Scale (Souq): display 32/800, page title 24/800, KPI 27/800 tabular, card title 19/700,
  body 15/400, secondary 13/600, micro 11/700-caps. Tracking tightened on large headings.

### Spacing, radii & corners
- **Chunky / tactile** radii: base **16px**, cards **20px**, feature panels **26px**,
  buttons **14px**, chips & pills **full**. (Legacy app used a 10px base.)
- Spacing is generous & mobile-first: page padding 24px, card padding 18–20px, gaps 14px.
  Touch targets ≥ **44px**; the mobile bottom-nav is **76px** tall with a raised center FAB.

### Cards & elevation
- Cards: `bg-card`, 1px hairline border, **soft multi-layer shadow** (`--shadow-card`:
  `0 1px 3px /.04, 0 4px 12px /.03`) — barely-there, not heavy. Rounded-xl.
- In **dark mode**, cards get a subtle "glass" treatment: a faint top-down white gradient
  (5%→2%), a 1px inner white ring, and a deeper shadow.
- **Hover-lift** is the signature card interaction: `-translate-y-0.5` + `shadow-lg` over 200ms.

### Borders & dividers
- Hairlines everywhere: `1px solid hsl(var(--border))`, often at reduced opacity
  (`/.5`, `/.6`, `/.35`) for nested dividers. Borders define structure far more than fills do.

### Backgrounds & texture
- Mostly **solid, calm fills** — no photographic or full-bleed hero backgrounds in the app.
- Two restrained textures exist:
  - The **navy "spotlight" cards** (Store Health, onboarding banner) tile the `numu_v3.webp`
    knot mark at ~3–4% opacity over a navy `hsl(222 47% 11%)` ground.
  - The **brand auth surface** has a faint paper-grain (two ~2.5%-opacity radial washes) and
    an interactive dot-grid that reveals a 5-color quincunx near the cursor.
- No grain/noise on dashboard surfaces. No gl* gradients-as-decoration.

### Transparency & blur
- **Frosted chrome:** the sticky header (`dash-header`) and floating save bar use
  `backdrop-filter: blur(16–24px) saturate(1.4–1.5)` over a translucent surface
  (`hsl(var(--background)/.72)`). Mobile bottom nav uses `bg-background/95 backdrop-blur-lg`.
- Tinted fills use low alpha (`/.04`–`/.10`) for status backgrounds and attention banners.

### Animation & motion
- Easing is **`cubic-bezier(0.16, 1, 0.3, 1)`** (a soft "out-expo") for entrances and the
  save bar; `ease-out` for hovers. Durations 200ms (interactions) to 400–700ms (entrances,
  progress bars).
- Named keyframes: `fade-up` (opacity+8px translate), `scale-in` (0.96→1), `accordion-up/down`,
  staggered `settings-child-in` (4ms steps). Count-up animation on KPI numbers (`useCountUp`).
- Live indicators use `animate-ping` / `animate-pulse` dots. Motion is **purposeful and quick**,
  never bouncy or playful.

### Hover & press states
- **Hover:** primary/accent buttons lighten (`navy→navy-700`, `saffron→saffron-600`); soft/ghost
  rows get a warm `surface-2` fill. Cards **lift** (`translateY(-3px)` + `shadow-lg`).
- **Press / active:** the signature is a **tactile “key” press** — navy & saffron buttons carry a
  2px bottom depth shadow and **translate down 2px** on `:active`, collapsing the shadow.
  Active nav items get a solid **navy fill with a saffron icon**; filter chips flip to solid navy.
- **Focus:** a visible 4px navy focus ring (`box-shadow 0 0 0 4px navy/14%`) — keyboard-nav friendly (WCAG AA).

### RTL & logical properties
- **Everything is built with logical properties** — `ms-/me-`, `ps-/pe-`, `start/end`,
  `inset-inline-start`. The sidebar physically flips to the right in Arabic; chevrons mirror.
  **Never hardcode left/right.** Charts and numeric runs stay LTR (see Content rules).

---

## 4. ICONOGRAPHY

- **Primary icon set (Souq redesign): [Phosphor](https://phosphoricons.com).** Distinctive,
  premium, multi-weight. Used at **bold** (default), **duotone** (feature/KPI icon chips), and
  **fill** (active nav). Rendered as **light-DOM inline SVG via the Iconify JS API** (`ph:` set)
  so icons are crisp, `currentColor`-aware, screenshot-safe, and survive offline bundling.
  - In HTML artifacts: load `https://code.iconify.design/3/3.1.1/iconify.min.js`, then either
    `<span class="iconify" data-icon="ph:house-bold"></span>` (auto-scanned to inline SVG) or,
    in React, the `Icon` component in `ui_kits/merchant-hub/Icons.jsx` (`Iconify.getIcon`).
  - Common icons: `house, shopping-cart, package, users, folders, tag, chart-bar, storefront,
    truck, money, megaphone, bell, gear, magnifying-glass, plus, gift, trend-up, receipt`.
  - Size via `font-size` (icons are `1em`). Weight maps to Phosphor style (`-bold`, `-duotone`, `-fill`).
- *Legacy:* the original app used **Lucide** (`lucide-react`, thin 2px outline). The redesign
  deliberately moves to Phosphor for a more premium, less generic feel.
- **No icon font** in the redesign — all icons are inline SVG. A few brand/marketing
  illustrations are standalone SVG/WebP in `assets/`.
- **Emoji:** used **only** as product-image placeholders in mock data (👕 👜 🧴). Never as
  UI iconography. Do not introduce decorative emoji or unicode glyphs as icons.
- **Brand & payment logos** (copied into `assets/`):
  - NUMU mark — an interlocking double-square "knot" (`numu-mark.webp`, `numu-symbol-navy-transparent.webp`,
    white-on-navy `numu-logo-320.webp`, `numu_v3.webp` texture mark, `numu-app-icon-navy.webp`).
  - Payment providers — **real logos**, treat as first-class: `paymob`, `fawry`, `kashier` (WebP
    logo + icon each) and `instapay` (SVG). In `assets/payments/`.
  - Channel/feature icons: `cod.webp`, `whatsapp.webp`, `fraud-detection.webp` in `assets/icons/`.
  - Onboarding illustrations (flat, brand-colored line art): `welcome.webp`, `reward.svg`,
    `identity.svg`, `shipping.svg`, `support.svg`, `verify.svg` in `assets/onboarding/`.
  - `illustrations/trust-network.svg` — brand network diagram.
- **When you need an icon NUMU doesn't ship:** use the closest **Phosphor** icon (`ph:` set
  via Iconify) at the matching weight. Do **not** hand-draw bespoke SVG icons or mix in a
  second icon family.

---

## 5. Folder index (manifest)

```
README.md                  ← you are here (context, content, visual, iconography)
SKILL.md                   ← Agent Skill front-matter for Claude Code / download
colors_and_type.css        ← all "Souq" tokens (+ legacy under .numu-legacy), light + dark
assets/                    ← logos, payment logos, icons, onboarding illustrations
  numu-*.webp/png/svg      ← brand marks
  payments/                ← paymob, fawry, kashier, instapay logos + icons
  icons/                   ← cod, whatsapp, fraud-detection
  onboarding/              ← welcome, reward, identity, shipping, support, verify
  illustrations/           ← trust-network
preview/                   ← Design System tab cards (small HTML specimens) + _base.css
ui_kits/
  merchant-hub/            ← high-fidelity Merchant Hub recreation (Souq redesign)
    README.md              ← kit overview + component list
    index.html             ← interactive click-through (login → dashboard → orders → mobile)
    app.css                ← kit chrome + layout
    colors_and_type.css    ← (root token file, imported)
    Icons.jsx              ← Phosphor-via-Iconify <Icon> component
    data.js                ← mock data + EN/AR strings
    Primitives.jsx         ← Avatar, Sparkline, StatusPill, PayPill, CountUp
    Chrome.jsx             ← Sidebar, Header, MobileNav
    Screens.jsx            ← Dashboard, Orders, Products, Customers, Login
    App.jsx                ← orchestration (auth, route, AR/EN, dark, mobile toggle)
```

### What's NOT here (and why)
- The **storefront** and **admin backoffice** surfaces are documented above but were not
  rebuilt — the brief centers on the Merchant Hub. Their tokens are the same system.
- No slide template was provided, so `slides/` is intentionally absent.
