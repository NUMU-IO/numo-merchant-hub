import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider, useDashboardStore } from "@/contexts/StoreContext";
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
const Payments = lazy(() => import("@/pages/Payments"));
const PaymentSetup = lazy(() => import("@/pages/PaymentSetup"));
const Logistics = lazy(() => import("@/pages/Logistics"));
const CODReconciliation = lazy(() => import("@/pages/CODReconciliation"));
const SocialImport = lazy(() => import("@/pages/SocialImport"));
const Customers = lazy(() => import("@/pages/Customers"));
const Analytics = lazy(() => import("@/pages/Analytics"));
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

/** Redirects authenticated users without stores to /create-store */
function RequireStore({ children }: { children: React.ReactNode }) {
  const { hasStores, isLoading } = useDashboardStore();
  if (isLoading) return <NumuLoadingScreen />;
  if (!hasStores) return <Navigate to="/create-store" replace />;
  return <>{children}</>;
}

/** Redirects unverified users to /verify-email */
function RequireVerified({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && !user.is_verified) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
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
                      <RequireAuth>
                        <RequireVerified>
                          <RequireStore>
                            <OnboardingWizard />
                          </RequireStore>
                        </RequireVerified>
                      </RequireAuth>
                    }
                  />

                  {/* Auth + verified + store required — dashboard */}
                  <Route
                    element={
                      <RequireAuth>
                        <RequireVerified>
                          <RequireStore>
                            <DashboardLayout />
                          </RequireStore>
                        </RequireVerified>
                      </RequireAuth>
                    }
                  >
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/products/new" element={<ProductEditor />} />
                    <Route path="/products/:productId/edit" element={<ProductEditor />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/orders/create" element={<CreateOrder />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/payment-setup" element={<PaymentSetup />} />
                    <Route path="/logistics" element={<Logistics />} />
                    <Route path="/store" element={<StoreSettings />} />
                    <Route path="/social" element={<SocialImport />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/analytics" element={<Analytics />} />
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
  </ErrorBoundary>
);

export default App;
