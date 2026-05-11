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
  /** Optional: unresolved legacy tokens from the data migration. */
  reportUnresolved?: string[];
}

export function CoverageBanner({ storeId, reportUnresolved }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { data: coverage, isLoading } = useShippingCoverage(storeId);
  const { data: governorates = [] } = useReferenceGovernorates(ar ? "ar" : "en");

  const byCode = new Map(governorates.map((g) => [g.code, g.name] as const));

  if (isLoading || !coverage) return null;

  const hasUncovered = coverage.uncovered.length > 0;
  const hasLegacy = (reportUnresolved?.length ?? 0) > 0;

  if (!hasUncovered && !hasLegacy) return null;

  return (
    <div className="space-y-2">
      {hasUncovered && (
        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-xs">
            <div className="mb-1 font-medium text-destructive">
              {ar
                ? `لا يمكنك الشحن إلى ${coverage.uncovered.length} محافظة`
                : `${coverage.uncovered.length} governorate${
                    coverage.uncovered.length === 1 ? "" : "s"
                  } not deliverable`}
            </div>
            <div className="text-muted-foreground">
              {ar
                ? "العملاء في هذه المناطق لن يجدوها في قائمة المحافظات عند الدفع:"
                : "Customers in these areas won't see them in the checkout dropdown:"}{" "}
              <span className="font-medium text-foreground">
                {coverage.uncovered
                  .map((c) => byCode.get(c) ?? c)
                  .slice(0, 8)
                  .join(ar ? "، " : ", ")}
                {coverage.uncovered.length > 8 &&
                  (ar
                    ? ` و${coverage.uncovered.length - 8} أخرى`
                    : ` +${coverage.uncovered.length - 8} more`)}
              </span>
            </div>
          </div>
        </div>
      )}

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
