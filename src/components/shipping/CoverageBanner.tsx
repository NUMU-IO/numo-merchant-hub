/**
 * Coverage banner — surfaces "your customers in these governorates
 * can't check out" as the dashboard equivalent of the resolver's
 * silent empty-options case.
 *
 * Also renders legacy-migration reports when `reportUnresolved` is
 * provided (the Alembic data migration writes unresolved tokens to
 * store.settings.shipping.legacy_migration_report.unresolved).
 */

import { AlertTriangle, Info } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  useReferenceGovernorates,
  useShippingCoverage,
} from "@/hooks/useShippingZones";

interface Props {
  storeId: string | undefined;
  /** Whether the store restricts shipping to its configured zones. Drives
   *  whether uncovered governorates are a hard blocker (restricted → checkout
   *  shows "no shipping options") or merely unpriced (default → they still
   *  ship, at a free fallback rate). */
  restrictToZones?: boolean;
  /** Optional: unresolved legacy tokens from the data migration. */
  reportUnresolved?: string[];
}

export function CoverageBanner({
  storeId,
  restrictToZones,
  reportUnresolved,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { data: coverage, isLoading } = useShippingCoverage(storeId);
  const { data: governorates = [] } = useReferenceGovernorates(ar ? "ar" : "en");

  const byCode = new Map(governorates.map((g) => [g.code, g.name] as const));

  if (isLoading || !coverage) return null;

  const hasUncovered = coverage.uncovered.length > 0;
  const hasLegacy = (reportUnresolved?.length ?? 0) > 0;

  if (!hasUncovered && !hasLegacy) return null;

  const n = coverage.uncovered.length;
  const uncoveredList =
    coverage.uncovered
      .map((c) => byCode.get(c) ?? c)
      .slice(0, 8)
      .join(ar ? "، " : ", ") +
    (n > 8 ? (ar ? ` و${n - 8} أخرى` : ` +${n - 8} more`) : "");

  return (
    <div className="space-y-2">
      {hasUncovered &&
        (restrictToZones ? (
          // Restrict-to-zones ON: these governorates genuinely can't check out.
          <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs">
              <div className="mb-1 font-medium text-destructive">
                {ar
                  ? `لا يمكنك الشحن إلى ${n} محافظة`
                  : `${n} governorate${n === 1 ? "" : "s"} not deliverable`}
              </div>
              <div className="text-muted-foreground">
                {ar
                  ? 'مع تفعيل "اقصر الشحن على مناطقي"، العملاء في هذه المناطق هيشوفوا "لا توجد خيارات شحن" عند الدفع:'
                  : 'With "restrict to zones" on, customers in these areas see "no shipping options" at checkout:'}{" "}
                <span className="font-medium text-foreground">{uncoveredList}</span>
              </div>
            </div>
          </div>
        ) : (
          // Default (not restricted): uncovered governorates still ship — at a
          // free fallback rate — so this is informational, not a blocker.
          <div className="flex gap-3 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-xs">
              <div className="mb-1 font-medium text-amber-700 dark:text-amber-500">
                {ar
                  ? `${n} محافظة من غير منطقة شحن`
                  : `${n} governorate${n === 1 ? "" : "s"} without a zone`}
              </div>
              <div className="text-muted-foreground">
                {ar
                  ? "الطلبات من هذه المناطق هتتشحن بسعر افتراضي مجاني. ضيف منطقة علشان تحدد سعرها:"
                  : "Orders from these areas ship at a free default rate. Add a zone to set their price:"}{" "}
                <span className="font-medium text-foreground">{uncoveredList}</span>
              </div>
            </div>
          </div>
        ))}

      {hasLegacy && (
        <div className="flex gap-3 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-xs">
            <div className="mb-1 font-medium text-amber-700 dark:text-amber-500">
              {ar
                ? `لم نتمكن من التعرف على ${reportUnresolved!.length} من أسماء المحافظات في إعداداتك القديمة`
                : `${reportUnresolved!.length} name${
                    reportUnresolved!.length === 1 ? "" : "s"
                  } from your legacy shipping zones couldn't be matched`}
            </div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {reportUnresolved!.slice(0, 10).join(", ")}
                {reportUnresolved!.length > 10 &&
                  ` +${reportUnresolved!.length - 10} more`}
              </span>
              <div className="mt-1">
                {ar
                  ? "أعد تعيينها يدويًا في المنطقة الصحيحة."
                  : "Reassign them to the right zone manually."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
