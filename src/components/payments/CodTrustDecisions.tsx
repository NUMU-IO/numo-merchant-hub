/**
 * COD Trust Decisions feed.
 *
 * Rendered below the COD trust filter settings on PaymentSetup. Shows the
 * merchant the most recent decisions the filter has made — allowed,
 * warned, or blocked — so the feature feels real even when the network
 * data is sparse. Empty until at least one COD checkout fires.
 */

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldAlert,
  Download,
} from "lucide-react";

import { apiClient } from "@/services/api";

interface DecisionFactor {
  code: string;
  weight: number;
  detail?: string | null;
}

interface Decision {
  id: string;
  order_id: string | null;
  order_number: string | null;
  created_at: string;
  risk_score: number;
  risk_level: string;
  action_taken: string | null;
  suggested_action: string | null;
  factors: DecisionFactor[];
  phone_last4: string | null;
}

interface DecisionsResponse {
  items: Decision[];
  total: number;
  limit: number;
  offset: number;
}

interface Props {
  storeId: string;
  isAr: boolean;
}

function actionBadgeClass(action: string | null): string {
  switch (action) {
    case "blocked_high_risk":
      return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30";
    case "warned_high_risk":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "below_threshold":
    case "new_customer":
    case "low_confidence":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function actionLabel(action: string | null, isAr: boolean): string {
  switch (action) {
    case "blocked_high_risk":
      return isAr ? "محظور" : "Blocked";
    case "warned_high_risk":
      return isAr ? "تحذير" : "Warned";
    case "below_threshold":
      return isAr ? "مسموح" : "Allowed";
    case "new_customer":
      return isAr ? "عميل جديد" : "New customer";
    case "low_confidence":
      return isAr ? "ثقة منخفضة" : "Low confidence";
    case "disabled":
      return isAr ? "الفلتر متوقف" : "Filter off";
    case "no_phone":
      return isAr ? "بدون رقم هاتف" : "No phone";
    case "lookup_error":
      return isAr ? "تعذر البحث" : "Lookup error";
    default:
      return action || "—";
  }
}

const _SIGNAL_LABELS: Record<string, { en: string; ar: string }> = {
  no_location: { en: "No location", ar: "بدون موقع" },
  location_teleport: { en: "Location mismatch", ar: "تضارب في الموقع" },
  low_accuracy_gps: { en: "Low GPS accuracy", ar: "دقة موقع منخفضة" },
  high_network_rto: { en: "High RTO elsewhere", ar: "رفض عالٍ في متاجر أخرى" },
  network_rto: { en: "RTO history", ar: "سجل رفض سابق" },
  serial_abuser: { en: "Serial abuser", ar: "مُسيء متكرر" },
  trusted_buyer: { en: "Trusted elsewhere", ar: "موثوق في متاجر أخرى" },
};

/** Map a raw factor code to a readable label; humanize unknown codes instead
 *  of dumping the raw value (which is what made the feed look broken). */
function signalLabel(code: string, isAr: boolean): string {
  const m = _SIGNAL_LABELS[code];
  if (m) return isAr ? m.ar : m.en;
  return code.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** A decision's meaningful signals — drops the backend "unknown" placeholder
 *  so a new customer with no network history reads as such, not "unknown ×3". */
function meaningfulSignals(factors: DecisionFactor[]): string[] {
  return factors.map((f) => f.code).filter((c) => c && c !== "unknown");
}

type DecisionFilter = "all" | "blocked" | "warned" | "allowed";

function formatTime(iso: string, isAr: boolean): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(isAr ? "ar-EG" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CodTrustDecisions({ storeId, isAr }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DecisionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DecisionFilter>("all");

  useEffect(() => {
    if (!storeId || !open) return;
    let cancelled = false;
    setLoading(true);
    apiClient<DecisionsResponse>(
      `/stores/${storeId}/cod-trust/decisions?limit=50&offset=0`,
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, open]);

  const items = data?.items ?? [];
  const filtered = items.filter((d) => {
    if (filter === "blocked") return d.action_taken === "blocked_high_risk";
    if (filter === "warned") return d.action_taken === "warned_high_risk";
    if (filter === "allowed")
      return (
        d.action_taken !== "blocked_high_risk" &&
        d.action_taken !== "warned_high_risk"
      );
    return true;
  });

  function exportCsv() {
    if (!data) return;
    const header = ["time", "phone_last4", "action", "score", "signals"];
    const lines = data.items.map((d) =>
      [
        d.created_at,
        d.phone_last4 || "",
        actionLabel(d.action_taken, false),
        String(d.risk_score),
        meaningfulSignals(d.factors).join(" | "),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cod-trust-decisions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const FILTERS: { key: DecisionFilter; en: string; ar: string }[] = [
    { key: "all", en: "All", ar: "الكل" },
    { key: "blocked", en: "Blocked", ar: "محظور" },
    { key: "warned", en: "Warned", ar: "تحذير" },
    { key: "allowed", en: "Allowed", ar: "مسموح" },
  ];

  return (
    <div className="rounded-xl border bg-background mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-bold">
            {isAr ? "آخر القرارات" : "Recent decisions"}
          </span>
          {data && (
            <span className="text-[10px] text-muted-foreground">
              ({data.total})
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-xs text-red-600">{error}</div>
          ) : !data || data.items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {isAr
                ? "لا توجد قرارات بعد. ستظهر هنا بعد تفعيل الفلتر وإجراء طلبات."
                : "No decisions yet. They'll appear here after the filter sees COD checkouts."}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
                <div className="inline-flex rounded-lg border bg-background p-0.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                        filter === f.key
                          ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {isAr ? f.ar : f.en}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Download size={12} />
                  {isAr ? "تصدير CSV" : "Export CSV"}
                </button>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">
                      {isAr ? "الوقت" : "Time"}
                    </th>
                    <th className="text-left font-medium px-3 py-2">
                      {isAr ? "آخر ٤ أرقام" : "Phone (last 4)"}
                    </th>
                    <th className="text-left font-medium px-3 py-2">
                      {isAr ? "الإجراء" : "Action"}
                    </th>
                    <th className="text-left font-medium px-3 py-2 tabular-nums">
                      {isAr ? "الدرجة" : "Score"}
                    </th>
                    <th className="text-left font-medium px-3 py-2">
                      {isAr ? "الإشارات" : "Signals"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-4 text-center text-xs text-muted-foreground"
                      >
                        {isAr ? "لا نتائج لهذا الفلتر" : "No matches for this filter"}
                      </td>
                    </tr>
                  )}
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {formatTime(d.created_at, isAr)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {d.phone_last4 ? `••${d.phone_last4}` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${actionBadgeClass(
                            d.action_taken,
                          )}`}
                        >
                          {actionLabel(d.action_taken, isAr)}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums font-medium">
                        {d.risk_score}
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          const sigs = meaningfulSignals(d.factors);
                          if (sigs.length === 0)
                            return (
                              <span className="text-[10px] text-muted-foreground/70 italic">
                                {isAr
                                  ? "عميل جديد · لا إشارات"
                                  : "New customer · no signals"}
                              </span>
                            );
                          return (
                            <div className="flex flex-wrap gap-1">
                              {sigs.slice(0, 3).map((code, i) => (
                                <span
                                  key={i}
                                  className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground/80"
                                >
                                  {signalLabel(code, isAr)}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
