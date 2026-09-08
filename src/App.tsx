import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TrialPaywallProvider } from "@/contexts/TrialPaywallContext";
import { StoreProvider, useDashboardStore } from "@/contexts/StoreContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DesktopOnlyRoute } from "@/components/layout/DesktopOnlyRoute";
import { QueryPersistGate } from "@/components/QueryPersistGate";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { BrandLoadingScreen } from "@/components/NumuLoader/BrandLoader";
import { FirstLoginGate } from "@/components/NumuLoader/FirstLoginGate";
import { PageLoader } from "@/components/PageLoader";
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazy-with-retry";

// Lazy-loaded pages for code splitting
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const Products = lazyWithRetry(() => import("@/pages/Products"));
const ProductEditor = lazyWithRetry(() => import("@/pages/ProductEditor"));
const Orders = lazyWithRetry(() => import("@/pages/Orders"));
const OrderDetail = lazyWithRetry(() => import("@/pages/OrderDetail"));
const DraftOrders = lazyWithRetry(() => import("@/pages/DraftOrders"));
const ShippingLabels = lazyWithRetry(() => import("@/pages/ShippingLabels"));
const AbandonedCheckouts = lazyWithRetry(() => import("@/pages/AbandonedCheckouts"));
const OrderImport = lazyWithRetry(() => import("@/pages/OrderImport"));
const CreateOrder = lazyWithRetry(() => import("@/pages/CreateOrder"));
const StoreSettings = lazyWithRetry(() => import("@/pages/StoreSettings"));
const OnlineStoreLanding = lazyWithRetry(() => import("@/pages/online-store/Landing"));
const OnlineStoreThemes = lazyWithRetry(() => import("@/pages/online-store/Themes"));
const OnlineStorePages = lazyWithRetry(() => import("@/pages/online-store/Pages"));
const OnlineStoreBlog = lazyWithRetry(() => import("@/pages/online-store/Blog"));
const OnlineStoreFiles = lazyWithRetry(() => import("@/pages/online-store/Files"));
const OnlineStoreNavigation = lazyWithRetry(() => import("@/pages/online-store/Navigation"));
const OnlineStorePreferences = lazyWithRetry(() => import("@/pages/online-store/Preferences"));
const OnlineStoreCheckoutFields = lazyWithRetry(() => import("@/pages/online-store/CheckoutFields"));
const ThemeCodeEditor = lazyWithRetry(() => import("@/pages/online-store/ThemeCodeEditor"));
const MyThemeSubmissions = lazy(
  () => import("@/pages/online-store/MyThemeSubmissions"),
);
// Viewport switch, not the customizer directly: it lazy-loads EITHER the
// desktop customizer or the Mobile Lite Editor, so a phone never fetches the
// desktop chunk. See ThemeEditorViewportSwitch for why the breakpoint must be
// read synchronously.
const ThemeEditorViewportSwitch = lazy(() =>
  import("@/features/theme-editor-v3/mobile/ThemeEditorViewportSwitch").then((m) => ({
    default: m.ThemeEditorViewportSwitch,
  })),
);
// Session E (2026-05-28) — marketplace detail + full-screen preview iframe.
const MarketplaceThemeDetail = lazy(
  () => import("@/pages/online-store/_marketplace/ThemeDetailPage"),
);
const MarketplaceThemePreview = lazy(
  () => import("@/pages/online-store/_marketplace/ThemePreviewPage"),
);
const Payments = lazyWithRetry(() => import("@/pages/Payments"));
const WalletPage = lazyWithRetry(() => import("@/pages/Wallet"));
const StoreBalancePage = lazyWithRetry(() => import("@/pages/StoreBalance"));
const PaymentSetup = lazyWithRetry(() => import("@/pages/PaymentSetup"));
const TrustNetwork = lazyWithRetry(() => import("@/pages/TrustNetwork"));
const CodAutopilot = lazyWithRetry(() => import("@/pages/CodAutopilot"));
const RateCalculator = lazyWithRetry(() => import("@/pages/logistics/RateCalculator"));
const Logistics = lazyWithRetry(() => import("@/pages/Logistics"));
const ShippingZones = lazyWithRetry(() => import("@/pages/shipping/ZonesPage"));
const ShippingZoneEditor = lazyWithRetry(() => import("@/pages/shipping/ZoneEditorPage"));
const CODReconciliation = lazyWithRetry(() => import("@/pages/CODReconciliation"));
const SocialImport = lazyWithRetry(() => import("@/pages/SocialImport"));
const Customers = lazyWithRetry(() => import("@/pages/Customers"));
const CustomerImport = lazyWithRetry(() => import("@/pages/CustomerImport"));
const AnalyticsExecutive = lazyWithRetry(() => import("@/pages/analytics/ExecutivePage"));
const AnalyticsOverview = lazyWithRetry(() => import("@/pages/analytics/OverviewPage"));
const AnalyticsSales = lazyWithRetry(() => import("@/pages/analytics/SalesPage"));
const AnalyticsOrders = lazyWithRetry(() => import("@/pages/analytics/OrdersPage"));
const AnalyticsCustomers = lazyWithRetry(() => import("@/pages/analytics/CustomersPage"));
const AnalyticsProducts = lazyWithRetry(() => import("@/pages/analytics/ProductsPage"));
const AnalyticsFunnel = lazyWithRetry(() => import("@/pages/analytics/FunnelPage"));
const AnalyticsMarketing = lazyWithRetry(() => import("@/pages/analytics/MarketingPage"));
// AnalyticsLtv + AnalyticsMultiTouch removed in feature 002 US2 —
// their content moved to MarketingAttribution as tabs. Legacy URLs
// `/analytics/ltv` and `/analytics/multi-touch` redirect there.
const AnalyticsLive = lazyWithRetry(() => import("@/pages/analytics/LivePage"));
const AnalyticsInsights = lazyWithRetry(() => import("@/pages/analytics/InsightsPage"));
const AnalyticsForecast = lazyWithRetry(() => import("@/pages/analytics/ForecastPage"));
const AnalyticsJourney = lazyWithRetry(() => import("@/pages/analytics/JourneyPage"));
const AnalyticsReports = lazyWithRetry(() => import("@/pages/analytics/ReportsPage"));
const HealthScore = lazyWithRetry(() => import("@/pages/HealthScore"));
const GrowthGuide = lazyWithRetry(() => import("@/pages/GrowthGuide"));
const MarketingLanding = lazyWithRetry(() => import("@/pages/MarketingLanding"));
const PromotionsList = lazyWithRetry(() => import("@/pages/marketing/PromotionsList"));
const PromotionForm = lazyWithRetry(() => import("@/pages/marketing/PromotionForm"));
const PromotionDetail = lazyWithRetry(() => import("@/pages/marketing/PromotionDetail"));
const Categories = lazyWithRetry(() => import("@/pages/Categories"));
const Invoices = lazyWithRetry(() => import("@/pages/Invoices"));
const Profile = lazyWithRetry(() => import("@/pages/Profile"));
const Settings = lazyWithRetry(() => import("@/pages/Settings"));
const SettingsPreferences = lazyWithRetry(() => import("@/pages/SettingsPreferences"));
const SettingsTracking = lazyWithRetry(() => import("@/pages/SettingsTracking"));
const SettingsMetafields = lazyWithRetry(() => import("@/pages/SettingsMetafields"));
const SettingsBusiness = lazyWithRetry(() => import("@/pages/SettingsBusiness"));
const McpConnect = lazyWithRetry(() => import("@/pages/McpConnect"));
const Apps = lazyWithRetry(() => import("@/pages/Apps"));
const GiftCards = lazyWithRetry(() => import("@/pages/GiftCards"));
const Locations = lazyWithRetry(() => import("@/pages/Locations"));
const PresentmentCurrencies = lazyWithRetry(() => import("@/pages/PresentmentCurrencies"));
const Notifications = lazyWithRetry(() => import("@/pages/Notifications"));
const Login = lazyWithRetry(() => import("@/pages/Login"));
const VerifyEmail = lazyWithRetry(() => import("@/pages/VerifyEmail"));
const CreateStore = lazyWithRetry(() => import("@/pages/CreateStore"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("@/pages/ResetPassword"));
const OnboardingWizard = lazyWithRetry(() => import("@/pages/OnboardingWizard"));
const Waitlist = lazyWithRetry(() => import("@/pages/Waitlist"));
const TokenHandoff = lazyWithRetry(() => import("@/pages/TokenHandoff"));
const BillingPage = lazyWithRetry(() => import("@/pages/billing/Billing"));
const Referrals = lazyWithRetry(() => import("@/pages/Referrals"));
const WhatsApp = lazyWithRetry(() => import("@/pages/WhatsApp"));
const WhatsAppInbox = lazyWithRetry(() => import("@/pages/WhatsAppInbox"));
const WhatsAppCampaigns = lazyWithRetry(() => import("@/pages/WhatsAppCampaigns"));
const WhatsAppBYOConnect = lazyWithRetry(() => import("@/pages/WhatsAppBYOConnect"));
const WhatsAppOptIns = lazyWithRetry(() => import("@/pages/WhatsAppOptIns"));
const WhatsAppDeadLetters = lazyWithRetry(() => import("@/pages/WhatsAppDeadLetters"));
const MarketingCampaigns = lazyWithRetry(() => import("@/pages/MarketingCampaigns"));
const MarketingCampaignDetail = lazyWithRetry(() => import("@/pages/MarketingCampaignDetail"));
const MarketingAttribution = lazyWithRetry(() => import("@/pages/MarketingAttribution"));
const MarketingCampaignsCompare = lazyWithRetry(() => import("@/pages/MarketingCampaignsCompare"));
const MarketingAudiences = lazyWithRetry(() => import("@/pages/MarketingAudiences"));
const AcceptInvitation = lazyWithRetry(() => import("@/pages/AcceptInvitation"));
const AcceptBetaInvite = lazyWithRetry(() => import("@/pages/AcceptBetaInvite"));
const Staff = lazyWithRetry(() => import("@/pages/Staff"));
const Roles = lazyWithRetry(() => import("@/pages/Roles"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const Inbox = lazyWithRetry(() => import("@/pages/Inbox"));
const Channels = lazyWithRetry(() => import("@/pages/Channels"));
const WhatsAppTemplates = lazyWithRetry(() => import("@/pages/WhatsAppTemplates"));
const NewWhatsAppTemplate = lazyWithRetry(() => import("@/pages/NewWhatsAppTemplate"));
const MetaOAuthCallback = lazyWithRetry(() => import("@/pages/MetaOAuthCallback"));
const EmailTemplates = lazyWithRetry(() => import("@/pages/EmailTemplates"));
const EmailTemplateEditor = lazyWithRetry(() => import("@/pages/EmailTemplateEditor"));
const AgentNotes = lazyWithRetry(() => import("@/features/agent-knowledge"));
const Assistant = lazyWithRetry(() => import("@/pages/Assistant"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      // Retry once, and ONLY for outages (network / 5xx). A 4xx — 401 after
      // a failed refresh, 403, 404, and especially 429 — is deterministic;
      // retrying it doubles load precisely when the API is shedding it.
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        const transient = status === undefined || status === 0 || status >= 500;
        return transient && failureCount < 1;
      },
      retryDelay: 2_000,
    },
  },
});

// Offline reads (PWA Phase 3): give ONLY the persisted query families a longer
// in-memory lifetime.
//
// The global gcTime is 10 minutes. A query garbage-collected out of memory is
// no longer in the cache to dehydrate, so with the default the snapshot would
// only ever hold whatever the merchant touched in the last 10 minutes —
// useless for "open the app tomorrow morning on a dead connection".
//
// Raised per-family rather than globally on purpose: a blanket 24h gcTime
// across ~79 pages would hold every response the merchant ever loaded in
// memory for a day.
// `orders` is deliberately absent: those rows carry customer_name and are no
// longer persisted (see query-persist.ts, defect D14-2), so holding them in
// memory for a day would cost us the memory without buying offline reads.
const OFFLINE_GC_TIME = 24 * 60 * 60 * 1000;
for (const key of [["dashboard"], ["products"]]) {
  queryClient.setQueryDefaults(key, { gcTime: OFFLINE_GC_TIME });
}



/** Redirects unauthenticated users to /login */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, bootError } = useAuth();
  if (isLoading) return <BrandLoadingScreen />;
  // Server unreachable with no cached session: offline screen + Retry,
  // not a bounce to /login (whose chunk may not even be cached).
  if (bootError && !isAuthenticated) return <BrandLoadingScreen error />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Redirects unverified users to /verify-email */
function RequireVerified({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && !user.is_verified) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}

/** Combined guard: auth + verified + store — single loading screen */
function RouteResolver({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, user, bootError } = useAuth();
  const { hasStores, isLoading: storeLoading } = useDashboardStore();

  // Single loading state for all checks
  if (authLoading || (isAuthenticated && storeLoading)) {
    return <BrandLoadingScreen />;
  }

  if (bootError && !isAuthenticated) return <BrandLoadingScreen error />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !user.is_verified) return <Navigate to="/verify-email" replace />;
  if (!hasStores) return <Navigate to="/create-store" replace />;

  return <>{children}</>;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const App = () => (
  <ErrorBoundary>
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Theme: next-themes owns `.dark` + localStorage.theme (values
          light | dark | system — the legacy "dark"/"light" strings the old
          hand-rolled toggle wrote are the same keys, so nothing migrates).
          First-paint is handled by the blocking script in index.html. */}
      <ThemeProvider attribute="class" storageKey="theme" enableSystem disableTransitionOnChange>
      <LanguageProvider>
        <AuthProvider>
          <TrialPaywallProvider>
          <StoreProvider>
            {/* Offline reads. Inside StoreProvider so it can re-key on a store
                switch — persisted data is only ever restored for the store it
                was captured from. Renders nothing. */}
            <QueryPersistGate />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <FirstLoginGate>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/waitlist" element={<Waitlist />} />
                  <Route path="/accept-invite" element={<AcceptBetaInvite />} />
                  <Route path="/token-handoff" element={<TokenHandoff />} />
                  <Route path="/staff/invite/accept" element={<AcceptInvitation />} />

                  {/* Auth required, verification pending */}
                  <Route
                    path="/verify-email"
                    element={
                      <RequireAuth>
                        <VerifyEmail />
                      </RequireAuth>
                    }
                  />

                  {/* Auth required, no store needed */}
                  <Route
                    path="/create-store"
                    element={
                      <RequireAuth>
                        <RequireVerified>
                          <CreateStore />
                        </RequireVerified>
                      </RequireAuth>
                    }
                  />

                  {/* Auth + verified + store required — onboarding wizard */}
                  <Route
                    path="/onboarding-wizard"
                    element={
                      <RouteResolver>
                        <OnboardingWizard />
                      </RouteResolver>
                    }
                  />

                  {/* v2 (classic) theme editor removed — redirect legacy links to v3 */}
                  <Route
                    path="/online-store/themes/editor"
                    element={<Navigate to="/online-store/themes/editor-v3" replace />}
                  />

                  {/* Theme code editor — full-screen, outside DashboardLayout.
                      Gated above the lazy boundary on purpose: below `md` the
                      DesktopOnlyRoute renders instead of <ThemeCodeEditor/>, so
                      Monaco's ~11.1 MB of chunks are never fetched on a phone.
                      Gating INSIDE the component (or with CSS) would download
                      them first and only then show the message. */}
                  <Route
                    path="/online-store/themes/code-editor"
                    element={
                      <RouteResolver>
                        <DesktopOnlyRoute
                          title="Code editor"
                          titleAr="محرر الأكواد"
                          fallbackPath="/online-store/themes"
                        >
                          <ThemeCodeEditor />
                        </DesktopOnlyRoute>
                      </RouteResolver>
                    }
                  />

                  {/* V3 Theme Customizer — full-screen, outside DashboardLayout.
                      Viewport-split: below `md` the Mobile Lite Editor renders
                      instead of the desktop customizer. Both are lazy, and the
                      mobile branch must NOT import the desktop module or the
                      desktop chunk lands on phones. */}
                  <Route
                    path="/online-store/themes/editor-v3"
                    element={
                      <RouteResolver>
                        <ThemeEditorViewportSwitch />
                      </RouteResolver>
                    }
                  />

                  {/* Marketplace "Try theme" preview — full-screen iframe.
                      Routes the storefront with ?preview_theme_slug=… so
                      the merchant sees the theme rendered against their
                      own products WITHOUT touching store_themes (file 06
                      §5). */}
                  <Route
                    path="/online-store/themes/preview/:slug"
                    element={
                      <RouteResolver>
                        <MarketplaceThemePreview />
                      </RouteResolver>
                    }
                  />

                  {/* Auth + verified + store required — dashboard */}
                  <Route
                    element={
                      <RouteResolver>
                        <DashboardLayout />
                      </RouteResolver>
                    }
                  >
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/products/new" element={<ProductEditor />} />
                    <Route path="/products/:productId/edit" element={<ProductEditor />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/orders/drafts" element={<DraftOrders />} />
                    <Route path="/orders/shipping-labels" element={<ShippingLabels />} />
                    <Route path="/orders/abandoned" element={<AbandonedCheckouts />} />
                    <Route path="/orders/create" element={<CreateOrder />} />
                    <Route path="/orders/import" element={<OrderImport />} />
                    <Route path="/orders/:orderId" element={<OrderDetail />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/wallet" element={<WalletPage />} />
                    <Route path="/store-balance" element={<StoreBalancePage />} />
                    <Route path="/payment-setup" element={<PaymentSetup />} />
                    <Route path="/trust-network" element={<TrustNetwork />} />
                    <Route path="/cod-autopilot" element={<CodAutopilot />} />
                    <Route path="/logistics" element={<Logistics />} />
                    <Route path="/logistics/rate-calculator" element={<RateCalculator />} />
                    <Route path="/shipping/zones" element={<ShippingZones />} />
                    <Route path="/shipping/zones/new" element={<ShippingZoneEditor />} />
                    <Route path="/shipping/zones/:zoneId" element={<ShippingZoneEditor />} />
                    <Route path="/store" element={<StoreSettings />} />
                    <Route path="/online-store" element={<OnlineStoreLanding />} />
                    <Route path="/online-store/themes" element={<OnlineStoreThemes />} />
                    {/* Session E (2026-05-28) — public theme detail page.
                        Inside DashboardLayout so the sidebar + tenant
                        chrome stays around the detail content (file 06 §4.3). */}
                    <Route
                      path="/online-store/themes/marketplace/:slug"
                      element={<MarketplaceThemeDetail />}
                    />
                    <Route path="/online-store/pages" element={<OnlineStorePages />} />
                    <Route path="/online-store/blog" element={<OnlineStoreBlog />} />
                    <Route path="/online-store/files" element={<OnlineStoreFiles />} />
                    <Route path="/online-store/navigation" element={<OnlineStoreNavigation />} />
                    <Route path="/online-store/preferences" element={<OnlineStorePreferences />} />
                    <Route path="/online-store/checkout-fields" element={<OnlineStoreCheckoutFields />} />
                    <Route path="/online-store/my-themes" element={<MyThemeSubmissions />} />
                    <Route path="/social" element={<SocialImport />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/customers/import" element={<CustomerImport />} />
                    <Route path="/customers/:customerId" element={<Customers />} />
                    <Route path="/analytics" element={<Navigate to="/analytics/overview" replace />} />
                    <Route path="/analytics/executive" element={<AnalyticsExecutive />} />
                    <Route path="/analytics/overview" element={<AnalyticsOverview />} />
                    <Route path="/analytics/sales" element={<AnalyticsSales />} />
                    <Route path="/analytics/orders" element={<AnalyticsOrders />} />
                    <Route path="/analytics/customers" element={<AnalyticsCustomers />} />
                    <Route path="/analytics/products" element={<AnalyticsProducts />} />
                    <Route path="/analytics/funnel" element={<AnalyticsFunnel />} />
                    <Route path="/analytics/marketing" element={<AnalyticsMarketing />} />
                    <Route
                      path="/analytics/ltv"
                      element={
                        <Navigate
                          to="/marketing/attribution?from=ltv"
                          replace
                        />
                      }
                    />
                    <Route
                      path="/analytics/multi-touch"
                      element={
                        <Navigate
                          to="/marketing/attribution?from=multi-touch"
                          replace
                        />
                      }
                    />
                    <Route path="/analytics/live" element={<AnalyticsLive />} />
                    <Route path="/analytics/insights" element={<AnalyticsInsights />} />
                    <Route path="/analytics/forecast" element={<AnalyticsForecast />} />
                    <Route path="/analytics/journey" element={<AnalyticsJourney />} />
                    <Route path="/analytics/reports" element={<AnalyticsReports />} />
                    <Route path="/health-score" element={<HealthScore />} />
                    <Route path="/grow" element={<GrowthGuide />} />
                    <Route path="/marketing" element={<MarketingLanding />} />
                    {/* Unified under "Discounts" — the standalone coupons page
                        is retired; its codes are managed as discount-code
                        discounts. Redirect any old links/bookmarks. */}
                    <Route path="/marketing/coupons" element={<Navigate to="/marketing/promotions" replace />} />
                    <Route path="/marketing/promotions" element={<PromotionsList />} />
                    <Route path="/marketing/promotions/new" element={<PromotionForm />} />
                    <Route path="/marketing/promotions/:id" element={<PromotionDetail />} />
                    <Route path="/marketing/promotions/:id/edit" element={<PromotionForm />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/agent-notes" element={<AgentNotes />} />
                    <Route path="/email-templates" element={<EmailTemplates />} />
                    <Route path="/email-templates/new" element={<EmailTemplateEditor />} />
                    <Route path="/email-templates/:id" element={<EmailTemplateEditor />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/apps" element={<Apps />} />
                    <Route path="/gift-cards" element={<GiftCards />} />
                    <Route path="/locations" element={<Locations />} />
                    <Route
                      path="/settings/currencies"
                      element={<PresentmentCurrencies />}
                    />
                    <Route path="/settings/preferences" element={<SettingsPreferences />} />
                    <Route path="/settings/tracking" element={<SettingsTracking />} />
                    <Route path="/settings/metafields" element={<SettingsMetafields />} />
                    <Route path="/settings/business" element={<SettingsBusiness />} />
                    <Route path="/settings/mcp" element={<McpConnect />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/whatsapp" element={<WhatsApp />} />
                    <Route path="/whatsapp/inbox" element={<WhatsAppInbox />} />
                    <Route path="/whatsapp/campaigns" element={<WhatsAppCampaigns />} />
                    <Route path="/whatsapp/byo" element={<WhatsAppBYOConnect />} />
                    <Route path="/whatsapp/opt-ins" element={<WhatsAppOptIns />} />
                    <Route path="/whatsapp/dead-letters" element={<WhatsAppDeadLetters />} />
                    <Route path="/campaigns" element={<MarketingCampaigns />} />
                    <Route path="/campaigns/compare" element={<MarketingCampaignsCompare />} />
                    <Route path="/campaigns/:id" element={<MarketingCampaignDetail />} />
                    <Route path="/marketing/attribution" element={<MarketingAttribution />} />
                    <Route path="/marketing/audiences" element={<MarketingAudiences />} />
                    <Route path="/billing" element={<BillingPage />} />
                    <Route path="/referrals" element={<Referrals />} />
                    <Route path="/cod" element={<CODReconciliation />} />
                    <Route path="/staff" element={<Staff />} />
                    <Route path="/roles" element={<Roles />} />
                    {/* Redirect old route */}
                    <Route path="/shipments" element={<Navigate to="/logistics" replace />} />
                    {/* Omnichannel */}
                    <Route path="/inbox" element={<Inbox />} />
                    <Route path="/inbox/:threadId" element={<Inbox />} />
                    <Route path="/channels" element={<Channels />} />
                    <Route path="/channels/whatsapp/templates" element={<WhatsAppTemplates />} />
                    <Route path="/channels/whatsapp/templates/new" element={<NewWhatsAppTemplate />} />
                    <Route path="/channels/oauth/meta/callback" element={<MetaOAuthCallback />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </FirstLoginGate>
            </BrowserRouter>
          </StoreProvider>
          </TrialPaywallProvider>
        </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </GoogleOAuthProvider>
  </ErrorBoundary>
);

export default App;
