

# NUMU Merchant Dashboard — Phase 1 (Updated)

## Overview
A clean, minimal merchant dashboard for the NUMU e-commerce platform with mock data, bilingual support (Arabic RTL + English), and core pages including a full Store Management section. Modern real-world SaaS aesthetic inspired by platforms like Shopify, Salla, and Zid.

## Design Direction
- **Clean & Minimal** SaaS aesthetic — generous white space, subtle shadows, soft borders
- Light mode primary with a polished neutral + brand accent color palette
- Inter font family, clean iconography via Lucide
- Collapsible sidebar navigation with mini icon mode
- Fully responsive across desktop, tablet, and mobile

## Pages & Features

### 1. Layout & Navigation
- Collapsible sidebar: Dashboard, Products, Orders, Store
- Top header: store name, language switcher (AR/EN), notification bell, merchant avatar dropdown
- Automatic RTL when Arabic is selected
- Breadcrumbs on inner pages

### 2. Dashboard Home
- Welcome greeting with merchant name
- Summary KPI cards: Today's Revenue, Orders, New Customers, Avg Order Value
- Revenue trend chart (area chart) with period selector (7d / 30d / 90d)
- Top 5 selling products list
- Recent 5 orders mini-table
- Order status donut chart

### 3. Products Page
- Product listing table with thumbnails, name, price (EGP), stock, status badge
- Search + filter by status (Draft / Published / Archived)
- "Add Product" dialog/form with: images, title, description, pricing, variants, inventory, status
- Product detail/edit view
- ~15 mock products with realistic Egyptian market items

### 4. Orders Page
- Orders table: order #, customer, date, total, payment & fulfillment status
- Tab filters: All, Pending, Processing, Shipped, Delivered, Cancelled
- Order detail view: line items, customer info, address, payment, status timeline
- Color-coded status badges
- ~20 mock orders

### 5. Store Management (NEW)
A dedicated "Store" section in the sidebar with tabbed sub-sections, styled like a modern SaaS settings area:

- **Store Profile** — Store name, logo upload area, description, contact email, phone, social media links. Clean card-based form layout.
- **Store Customization** — Theme color picker (primary/accent colors), font selection dropdown, hero banner upload placeholder, layout style toggle (grid vs list for storefront). Live preview mock showing how changes would look.
- **Store Domain** — Current subdomain display (storename.numu.com), custom domain input field (placeholder), SSL status badge.
- **Store Policies** — Editable text areas for Return Policy, Shipping Policy, Privacy Policy, Terms of Service. Tabs to switch between them.
- **Store Status** — Toggle store Online/Offline (maintenance mode), store creation date, plan/tier badge display.
- **Delivery & Shipping** — Shipping zones table (Cairo, Alexandria, Upper Egypt) with flat rate pricing fields, free shipping threshold input, estimated delivery days per zone.

All settings use a save button per section with success toast feedback. Data is mock/local state only.

### 6. Internationalization (i18n)
- Language toggle (AR 🇪🇬 / EN 🇬🇧) in header
- Full RTL layout support for Arabic
- All UI labels, nav items, buttons, table headers translated
- Currency in EGP (ج.م) format
- Numbers and dates localized

## Technical Approach
- Hardcoded mock data in TypeScript service files (swappable for API later)
- React Router for navigation with nested routes for Store sub-tabs
- Recharts for dashboard charts
- i18next + react-i18next for translations with RTL auto-detection
- Tailwind CSS for responsive design
- Sonner toasts for save/action feedback
- Shadcn UI components throughout (cards, tables, tabs, forms, dialogs, switches)

