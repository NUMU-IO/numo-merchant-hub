import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider, useDashboardStore } from "@/contexts/StoreContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NumuLoadingScreen } from "@/components/NumuLoader";
import { PageLoader } from "@/components/PageLoader";
import { lazy, Suspense } from "react";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Products = lazy(() => import("@/pages/Products"));
const ProductEditor = lazy(() => import("@/pages/ProductEditor"));
const Orders = lazy(() => import("@/pages/Orders"));
const CreateOrder = lazy(() => import("@/pages/CreateOrder"));
const StoreSettings = lazy(() => import("@/pages/StoreSettings"));
const OnlineStoreThemes = lazy(() => import("@/pages/online-store/Themes"));
const OnlineStorePages = lazy(() => import("@/pages/online-store/Pages"));
const OnlineStoreNavigation = lazy(() => import("@/pages/online-store/Navigation"));
const OnlineStorePreferences = lazy(() => import("@/pages/online-store/Preferences"));
const ThemeEditor = lazy(() => import("@/pages/online-store/ThemeEditor"));
const Payments = lazy(() => import("@/pages/Payments"));
const WalletPage = lazy(() => import("@/pages/Wallet"));
const StoreBalancePage = lazy(() => import("@/pages/StoreBalance"));
const PaymentSetup = lazy(() => import("@/pages/PaymentSetup"));
const Logistics = lazy(() => import("@/pages/Logistics"));
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
const AnalyticsLive = lazy(() => import("@/pages/analytics/LivePage"));
const AnalyticsInsights = lazy(() => import("@/pages/analytics/InsightsPage"));
const AnalyticsForecast = lazy(() => import("@/pages/analytics/ForecastPage"));
const AnalyticsJourney = lazy(() => import("@/pages/analytics/JourneyPage"));
const HealthScore = lazy(() => import("@/pages/HealthScore"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const Categories = lazy(() => import("@/pages/Categories"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Login = lazy(() => import("@/pages/Login"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const CreateStore = lazy(() => import("@/pages/CreateStore"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const OnboardingWizard = lazy(() => import("@/pages/OnboardingWizard"));
const Waitlist = lazy(() => import("@/pages/Waitlist"));
const NotFound = lazy(() => import("@/pages/NotFound"));

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
                    <Route path="/orders/create" element={<CreateOrder />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/wallet" element={<WalletPage />} />
                    <Route path="/store-balance" element={<StoreBalancePage />} />
                    <Route path="/payment-setup" element={<PaymentSetup />} />
                    <Route path="/logistics" element={<Logistics />} />
                    <Route path="/store" element={<StoreSettings />} />
                    <Route path="/online-store" element={<Navigate to="/online-store/themes" replace />} />
                    <Route path="/online-store/themes" element={<OnlineStoreThemes />} />
                    <Route path="/online-store/pages" element={<OnlineStorePages />} />
                    <Route path="/online-store/navigation" element={<OnlineStoreNavigation />} />
                    <Route path="/online-store/preferences" element={<OnlineStorePreferences />} />
                    <Route path="/social" element={<SocialImport />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/analytics" element={<Navigate to="/analytics/overview" replace />} />
                    <Route path="/analytics/overview" element={<AnalyticsOverview />} />
                    <Route path="/analytics/sales" element={<AnalyticsSales />} />
                    <Route path="/analytics/orders" element={<AnalyticsOrders />} />
                    <Route path="/analytics/customers" element={<AnalyticsCustomers />} />
                    <Route path="/analytics/products" element={<AnalyticsProducts />} />
                    <Route path="/analytics/funnel" element={<AnalyticsFunnel />} />
                    <Route path="/analytics/marketing" element={<AnalyticsMarketing />} />
                    <Route path="/analytics/live" element={<AnalyticsLive />} />
                    <Route path="/analytics/insights" element={<AnalyticsInsights />} />
                    <Route path="/analytics/forecast" element={<AnalyticsForecast />} />
                    <Route path="/analytics/journey" element={<AnalyticsJourney />} />
                    <Route path="/health-score" element={<HealthScore />} />
                    <Route path="/marketing" element={<Marketing />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/cod" element={<CODReconciliation />} />
                    {/* Redirect old route */}
                    <Route path="/shipments" element={<Navigate to="/logistics" replace />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </StoreProvider>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </GoogleOAuthProvider>
  </ErrorBoundary>
);

export default App;
