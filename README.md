# NUMU Merchant Hub

The merchant dashboard for NUMU e-commerce platform. Built with React 18, TypeScript, Vite, and shadcn/ui.

## Tech Stack

- **Frontend**: React 18, TypeScript 5.8, Vite + SWC
- **Styling**: Tailwind 3, shadcn/ui
- **State**: TanStack React Query v5
- **Routing**: react-router-dom 6
- **i18n**: i18next (English + Arabic)
- **Package Manager**: npm

## Development

```bash
# Install dependencies
npm install

# Start development server (port 8080)
npm run dev

# Build for production
npm run build

# Run lint
npm run lint

# Run typecheck
npx tsc --noEmit

# Run tests
npm run test
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `VITE_META_APP_ID` | Meta (Facebook/Instagram) App ID |
| `VITE_META_LOGIN_CONFIG_ID` | Meta Login Config ID |
| `VITE_META_OAUTH_REDIRECT` | OAuth redirect URI |
| `VITE_WS_URL` | WebSocket URL for realtime inbox |

## Features

~111 pages across these areas (see `src/App.tsx` for the full route map):

- Dashboard, onboarding wizard, health score, growth guide
- Products (editor, variants, images), categories, inventory locations, gift cards
- Orders (drafts, shipping labels, abandoned checkouts, create, import, detail), invoices
- Customers, COD reconciliation, trust network
- **Online Store**: themes + marketplace, **V2 theme editor** and **V3 customizer** (`/online-store/themes/editor-v3`, `src/features/theme-editor-v3/` — sections/blocks/wording/media panels, live preview, version history, server-side undo), pages, files/media, navigation, preferences, checkout fields, theme submissions
- Analytics suite (12 sub-pages: overview, sales, funnel, live, forecast, journey, …)
- Marketing: coupons, promotions (offers v2), campaigns + compare, Meta attribution & audiences, email templates
- WhatsApp: inbox, campaigns, BYO connect, opt-ins, dead letters; omnichannel inbox + channels (Facebook, Instagram, WhatsApp)
- Payments, wallet, store balance, payment setup; logistics + shipping zones
- Settings (preferences, tracking/Meta Pixel, presentment currencies), staff + roles (RBAC), apps, billing, referrals
- Multi-language (English + Egyptian Arabic, full RTL), dark mode

## Project Structure

```
src/
├── components/       # React components
│   ├── layout/       # Layout components (Sidebar, Header)
│   └── ui/           # shadcn/ui components
├── contexts/         # React contexts (Auth, Store, Language, TrialPaywall)
├── features/
│   └── theme-editor-v3/  # V3 customizer (Zustand store, panels, inputs, preview)
├── hooks/            # Custom React hooks
├── i18n/             # Translations (en.ts, ar.ts)
├── lib/              # Utilities
├── pages/            # Route pages (~111)
├── services/         # API services (~48 modules via central api.ts)
└── types/            # TypeScript types
```

See `MERCHANT-HUB-DEEP-DIVE.md` for the full 20-chapter technical deep dive and `NHUB/` for the design system.

## Available Scripts

- `npm run dev` - Start dev server
- `npm run build` - Build production bundle
- `npm run lint` - Run ESLint
- `npm run test` - Run Vitest tests
- `npm run preview` - Preview production build