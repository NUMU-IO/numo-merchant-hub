import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TrialPaywallProvider } from "@/contexts/TrialPaywallContext";
import { StoreProvider, useDashboardStore } from "@/contexts/StoreContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NumuLoadingScreen } from "@/components/NumuLoader";
import { PageLoader } from "@/components/PageLoader";
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazy-with-retry";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Products = lazy(() => import("@/pages/Products"));
const ProductEditor = lazy(() => import("@/pages/ProductEditor"));
const Orders = lazy(() => import("@/pages/Orders"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const DraftOrders = lazy(() => import("@/pages/DraftOrders"));
const ShippingLabels = lazy(() => import("@/pages/ShippingLabels"));
const AbandonedCheckouts = lazy(() => import("@/pages/AbandonedCheckouts"));
const OrderImport = lazy(() => import("@/pages/OrderImport"));
const CreateOrder = lazy(() => import("@/pages/CreateOrder"));
const StoreSettings = lazy(() => import("@/pages/StoreSettings"));
const OnlineStoreLanding = lazy(() => import("@/pages/online-store/Landing"));
const OnlineStoreThemes = lazy(() => import("@/pages/online-store/Themes"));
const OnlineStorePages = lazy(() => import("@/pages/online-store/Pages"));
const OnlineStoreNavigation = lazy(() => import("@/pages/online-store/Navigation"));
const OnlineStorePreferences = lazy(() => import("@/pages/online-store/Preferences"));
const OnlineStoreCheckoutFields = lazy(() => import("@/pages/online-store/CheckoutFields"));
const ThemeEditor = lazy(() => import("@/pages/online-store/ThemeEditor"));
const MyThemeSubmissions = lazy(
  () => import("@/pages/online-store/MyThemeSubmissions"),
);
const ThemeCustomizerV3 = lazy(() => import("@/features/theme-editor-v3/pages/ThemeCustomizerV3"));
// Session E (2026-05-28) — marketplace detail + full-screen preview iframe.
const MarketplaceThemeDetail = lazy(
  () => import("@/pages/online-store/_marketplace/ThemeDetailPage"),
);
const MarketplaceThemePreview = lazy(
  () => import("@/pages/online-store/_marketplace/ThemePreviewPage"),
);
const Payments = lazy(() => import("@/pages/Payments"));
const WalletPage = lazy(() => import("@/pages/Wallet"));
const StoreBalancePage = lazy(() => import("@/pages/StoreBalance"));
const PaymentSetup = lazy(() => import("@/pages/PaymentSetup"));
const Logistics = lazy(() => import("@/pages/Logistics"));
const ShippingZones = lazy(() => import("@/pages/shipping/ZonesPage"));
const ShippingZoneEditor = lazy(() => import("@/pages/shipping/ZoneEditorPage"));
const CODReconciliation = lazy(() => import("@/pages/CODReconciliation"));
const SocialImport = lazy(() => import("@/pages/SocialImport"));
const Customers = lazy(() => import("@/pages/Customers"));
const AnalyticsOverview = lazy(() => import("@/pages/analytics/OverviewPage"));
const AnalyticsSales = lazy(() => import("@/pages/analytics/SalesPage"));
const AnalyticsOrders = lazy(() => import("@/pages/analytics/OrdersPage"));
const AnalyticsCustomers = lazy(() => import("@/pages/analytics/CustomersPage"));
const AnalyticsProducts = lazy(() => import("@/pages/analytics/ProductsPage"));
const AnalyticsFunnel = lazy(() => import("@/pages/analytics/FunnelPage"));
const AnalyticsMarketing = lazy(() => import("@/pages/analytics/MarketingPage"));
// AnalyticsLtv + AnalyticsMultiTouch removed in feature 002 US2 —
// their content moved to MarketingAttribution as tabs. Legacy URLs
// `/analytics/ltv` and `/analytics/multi-touch` redirect there.
const AnalyticsLive = lazy(() => import("@/pages/analytics/LivePage"));
const AnalyticsInsights = lazy(() => import("@/pages/analytics/InsightsPage"));
const AnalyticsForecast = lazy(() => import("@/pages/analytics/ForecastPage"));
const AnalyticsJourney = lazy(() => import("@/pages/analytics/JourneyPage"));
const AnalyticsReports = lazy(() => import("@/pages/analytics/ReportsPage"));
const HealthScore = lazy(() => import("@/pages/HealthScore"));
const GrowthGuide = lazy(() => import("@/pages/GrowthGuide"));
const MarketingLanding = lazy(() => import("@/pages/MarketingLanding"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const PromotionsList = lazy(() => import("@/pages/marketing/PromotionsList"));
const PromotionForm = lazy(() => import("@/pages/marketing/PromotionForm"));
const PromotionDetail = lazy(() => import("@/pages/marketing/PromotionDetail"));
const Categories = lazy(() => import("@/pages/Categories"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const SettingsPreferences = lazy(() => import("@/pages/SettingsPreferences"));
const SettingsTracking = lazy(() => import("@/pages/SettingsTracking"));
const Apps = lazy(() => import("@/pages/Apps"));
const GiftCards = lazy(() => import("@/pages/GiftCards"));
const Locations = lazy(() => import("@/pages/Locations"));
const PresentmentCurrencies = lazy(() => import("@/pages/PresentmentCurrencies"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Login = lazy(() => import("@/pages/Login"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const CreateStore = lazy(() => import("@/pages/CreateStore"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const OnboardingWizard = lazy(() => import("@/pages/OnboardingWizard"));
const Waitlist = lazy(() => import("@/pages/Waitlist"));
const TokenHandoff = lazy(() => import("@/pages/TokenHandoff"));
const BillingPage = lazy(() => import("@/pages/billing/Billing"));
const Referrals = lazy(() => import("@/pages/Referrals"));
const WhatsApp = lazy(() => import("@/pages/WhatsApp"));
const WhatsAppInbox = lazy(() => import("@/pages/WhatsAppInbox"));
const WhatsAppCampaigns = lazy(() => import("@/pages/WhatsAppCampaigns"));
const WhatsAppBYOConnect = lazy(() => import("@/pages/WhatsAppBYOConnect"));
const WhatsAppOptIns = lazy(() => import("@/pages/WhatsAppOptIns"));
const WhatsAppDeadLetters = lazy(() => import("@/pages/WhatsAppDeadLetters"));
const MarketingCampaigns = lazy(() => import("@/pages/MarketingCampaigns"));
const MarketingCampaignDetail = lazy(() => import("@/pages/MarketingCampaignDetail"));
const MarketingAttribution = lazy(() => import("@/pages/MarketingAttribution"));
const MarketingCampaignsCompare = lazy(() => import("@/pages/MarketingCampaignsCompare"));
const MarketingAudiences = lazy(() => import("@/pages/MarketingAudiences"));
const AcceptInvitation = lazy(() => import("@/pages/AcceptInvitation"));
const AcceptBetaInvite = lazy(() => import("@/pages/AcceptBetaInvite"));
const Staff = lazy(() => import("@/pages/Staff"));
const Roles = lazy(() => import("@/pages/Roles"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const Channels = lazy(() => import("@/pages/Channels"));
const WhatsAppTemplates = lazy(() => import("@/pages/WhatsAppTemplates"));
const NewWhatsAppTemplate = lazy(() => import("@/pages/NewWhatsAppTemplate"));
const MetaOAuthCallback = lazy(() => import("@/pages/MetaOAuthCallback"));
const EmailTemplates = lazy(() => import("@/pages/EmailTemplates"));
const EmailTemplateEditor = lazy(() => import("@/pages/EmailTemplateEditor"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});



/** Redirects unauthenticated users to /login */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <NumuLoadingScreen />;
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
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { hasStores, isLoading: storeLoading } = useDashboardStore();

  // Single loading state for all checks
  if (authLoading || (isAuthenticated && storeLoading)) {
    return <NumuLoadingScreen />;
  }

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
      <LanguageProvider>
        <AuthProvider>
          <TrialPaywallProvider>
          <StoreProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
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

                  {/* Full-screen theme editor — outside DashboardLayout */}
                  <Route
                    path="/online-store/themes/editor"
                    element={
                      <RouteResolver>
                        <ThemeEditor />
                      </RouteResolver>
                    }
                  />

                  {/* V3 Theme Customizer — full-screen, outside DashboardLayout */}
                  <Route
                    path="/online-store/themes/editor-v3"
                    element={
                      <RouteResolver>
                        <ThemeCustomizerV3 />
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
                    <Route path="/logistics" element={<Logistics />} />
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
                    <Route path="/online-store/navigation" element={<OnlineStoreNavigation />} />
                    <Route path="/online-store/preferences" element={<OnlineStorePreferences />} />
                    <Route path="/online-store/checkout-fields" element={<OnlineStoreCheckoutFields />} />
                    <Route path="/online-store/my-themes" element={<MyThemeSubmissions />} />
                    <Route path="/social" element={<SocialImport />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/customers/:customerId" element={<Customers />} />
                    <Route path="/analytics" element={<Navigate to="/analytics/overview" replace />} />
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
                    <Route path="/marketing/coupons" element={<Marketing />} />
                    <Route path="/marketing/promotions" element={<PromotionsList />} />
                    <Route path="/marketing/promotions/new" element={<PromotionForm />} />
                    <Route path="/marketing/promotions/:id" element={<PromotionDetail />} />
                    <Route path="/marketing/promotions/:id/edit" element={<PromotionForm />} />
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
            </BrowserRouter>
          </StoreProvider>
          </TrialPaywallProvider>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </GoogleOAuthProvider>
  </ErrorBoundary>
);

export default App;
