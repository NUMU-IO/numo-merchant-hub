/**
 * COD Trust Decisions feed.
 *
 * Rendered below the COD trust filter settings on PaymentSetup. Shows the
 * merchant the most recent decisions the filter has made — allowed,
 * warned, or blocked — so the feature feels real even when the network
 * data is sparse. Empty until at least one COD checkout fires.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, ShieldAlert } from "lucide-react";

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

  useEffect(() => {
    if (!storeId || !open) return;
    let cancelled = false;
    setLoading(true);
    apiClient<DecisionsResponse>(
      `/stores/${storeId}/cod-trust/decisions?limit=20&offset=0`,
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
                  {data.items.map((d) => (
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
                      <td className="px-3 py-2 text-muted-foreground">
                        {d.factors.length === 0
                          ? "—"
                          : d.factors
                              .map((f) => f.code)
                              .slice(0, 3)
                              .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
