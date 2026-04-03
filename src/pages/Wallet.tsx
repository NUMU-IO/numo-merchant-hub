import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { apiClient } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, ChevronLeft, ChevronRight, ArrowLeft,
  Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";

const NUMU_PRIMARY = "hsl(222.2, 47.4%, 11.2%)";

const Wallet = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const navigate = useNavigate();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fmtBig = (cents: number) => (cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    apiClient<{ wallet_balance_cents: number; store_balance_cents: number }>(`/stores/${storeId}/payments/balances`)
      .then(b => setBalance(b.wallet_balance_cents))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  return (
    <div className="max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/payments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">{isAr ? "المحفظة" : "Wallet"}</h1>
      </div>

      {/* Balance Card */}
      <div className="rounded-xl overflow-hidden text-white" style={{ background: NUMU_PRIMARY }}>
        <div className="relative">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('/numu_v3.webp')", backgroundSize: "80px", backgroundRepeat: "repeat" }} />
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <WalletIcon className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-sm text-white/60">{isAr ? "رصيد المحفظة الحالي" : "Current Wallet Balance"}</p>
            </div>
            <div className="flex items-baseline gap-2">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
              ) : (
                <>
                  <span className="text-4xl sm:text-5xl font-bold tabular-nums text-white">{fmtBig(balance)}</span>
                  <span className="text-lg font-medium text-white/50">{isAr ? "ج.م" : "EGP"}</span>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button size="sm" className="h-9 text-sm rounded-lg bg-white text-gray-900 hover:bg-white/90 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {isAr ? "إضافة رصيد" : "Add Balance"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Transactions */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-bold">{isAr ? "سجل المعاملات" : "Transaction History"}</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <WalletIcon className="h-8 w-8 text-muted-foreground/20" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{isAr ? "لا توجد معاملات بعد" : "No wallet transactions yet"}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{isAr ? "ستظهر معاملات المحفظة هنا عند إضافة رصيد" : "Wallet transactions will appear here when you add balance"}</p>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
