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

- Dashboard with analytics
- Product management
- Order management
- Customer management
- Omnichannel inbox (Facebook, Instagram, WhatsApp)
- Channel management
- WhatsApp template management
- Multi-language support (English, Arabic)

## Project Structure

```
src/
├── components/       # React components
│   ├── layout/       # Layout components (Sidebar, Header)
│   └── ui/           # shadcn/ui components
├── contexts/         # React contexts (Auth, Store, Language)
├── hooks/            # Custom React hooks
├── i18n/             # Translations (en.ts, ar.ts)
├── lib/              # Utilities
├── pages/            # Route pages
├── services/         # API services
└── types/            # TypeScript types
```

## Available Scripts

- `npm run dev` - Start dev server
- `npm run build` - Build production bundle
- `npm run lint` - Run ESLint
- `npm run test` - Run Vitest tests
- `npm run preview` - Preview production build