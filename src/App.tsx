import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider, useDashboardStore } from "@/contexts/StoreContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import StoreSettings from "@/pages/StoreSettings";
import CODReconciliation from "@/pages/CODReconciliation";
import SocialImport from "@/pages/SocialImport";
import Customers from "@/pages/Customers";
import Analytics from "@/pages/Analytics";
import Marketing from "@/pages/Marketing";
import Categories from "@/pages/Categories";
import Login from "@/pages/Login";
import VerifyEmail from "@/pages/VerifyEmail";
import CreateStore from "@/pages/CreateStore";
import NotFound from "./pages/NotFound";
import { NumuLoadingScreen } from "@/components/NumuLoader";

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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <AuthProvider>
          <StoreProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

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
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/store" element={<StoreSettings />} />
                  <Route path="/cod" element={<CODReconciliation />} />
                  <Route path="/social" element={<SocialImport />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/marketing" element={<Marketing />} />
                  <Route path="/categories" element={<Categories />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </StoreProvider>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
