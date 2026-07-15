import { useLanguage } from "@/contexts/LanguageContext";
import { formatMoney } from "@/lib/format-money";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Download, RefreshCw } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  DateRangePicker,
  useDateRangeUrlState,
  type DateRange,
} from "@/components/filters/DateRangePicker";

/** Pages register a callback so the layout's Export button knows what
 *  CSV to build. Returning `null` from the callback disables the
 *  button (e.g. while data is still loading). */
type ExportHandler = () => void | Promise<void> | null;

interface AnalyticsContextValue {
  /** Selected date range from the Shopify-style picker. Drives every
   *  analytics query on every page that wraps in AnalyticsLayout. */
  range: DateRange;
  /** Compare-to-previous-period toggle (header button). Pages that
   *  support comparison overlay the previous window's series/deltas
   *  when this is on; pages that don't simply ignore it. */
  compare: boolean;
  formatCurrency: (cents: number) => string;
  registerExport: (handler: ExportHandler | null) => void;
}

// Lazy default so importers calling useAnalyticsContext outside the
// provider don't crash on first render. The provider always
// overrides with a real range derived from the URL.
const fallbackRange = (): DateRange => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return {
    start,
    end: now,
    preset: "last-n",
    lastN: { n: 30, unit: "day" },
    granularity: "day",
    includeToday: true,
  };
};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  range: fallbackRange(),
  compare: false,
  formatCurrency: () => "",
  registerExport: () => {},
});

export const useAnalyticsContext = () => useContext(AnalyticsContext);

interface AnalyticsLayoutProps {
  children: React.ReactNode;
  title?: { en: string; ar: string };
  subtitle?: { en: string; ar: string };
  showPeriod?: boolean;
}

export function AnalyticsLayout({
  children,
  title = { en: "Analytics", ar: "التحليلات" },
  subtitle = { en: "Your store reports and statistics", ar: "تقارير وإحصائيات متجرك" },
  showPeriod = true,
}: AnalyticsLayoutProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const { range, setRange } = useDateRangeUrlState();

  // Session-sticky so flipping between analytics tabs keeps the mode;
  // deliberately NOT in the URL (the range already owns that surface).
  const [compare, setCompare] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("numu_analytics_compare") === "1";
    } catch {
      return false;
    }
  });
  const toggleCompare = useCallback(() => {
    setCompare((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("numu_analytics_compare", next ? "1" : "0");
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  const [isRefetching, setIsRefetching] = useState(false);
  const exportHandlerRef = useRef<ExportHandler | null>(null);
  const [hasExport, setHasExport] = useState(false);

  const registerExport = useCallback((handler: ExportHandler | null) => {
    exportHandlerRef.current = handler;
    setHasExport(handler !== null);
  }, []);

  const handleRefresh = async () => {
    setIsRefetching(true);
    await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    setIsRefetching(false);
  };

  const handleExport = async () => {
    const fn = exportHandlerRef.current;
    if (fn) await fn();
  };

  const formatCurrency = useCallback(
    (cents: number) =>
      formatMoney(cents, { fromCents: true, locale: isAr ? "ar" : "en" }),
    [isAr],
  );

  const ctxValue = useMemo<AnalyticsContextValue>(
    () => ({ range, compare, formatCurrency, registerExport }),
    [range, compare, formatCurrency, registerExport],
  );

  return (
    <AnalyticsContext.Provider value={ctxValue}>
      <div className="space-y-5 max-w-[1500px] mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isAr ? title.ar : title.en}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {isAr ? subtitle.ar : subtitle.en}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {showPeriod && (
              <DateRangePicker
                value={range}
                onChange={setRange}
                size="sm"
                align="end"
              />
            )}
            {showPeriod && (
              <Button
                variant={compare ? "secondary" : "ghost"}
                size="sm"
                className="h-7 rounded-lg gap-1.5 text-[12px] px-2.5"
                onClick={toggleCompare}
                title={isAr ? "قارن بالفترة السابقة" : "Compare to previous period"}
                aria-pressed={compare}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {isAr ? "مقارنة" : "Compare"}
              </Button>
            )}
            {hasExport && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={handleExport}
                title={isAr ? "تصدير CSV" : "Export CSV"}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleRefresh} disabled={isRefetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {children}
      </div>
    </AnalyticsContext.Provider>
  );
}
