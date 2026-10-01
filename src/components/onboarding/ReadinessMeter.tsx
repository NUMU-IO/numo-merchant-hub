import { useNavigate } from "react-router-dom";
import { Check, Circle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReadinessKey } from "@/services/storeApi";
import { useStoreReadiness } from "@/hooks/useStoreReadiness";

const ITEMS: Record<ReadinessKey, { ar: string; en: string; fixAr: string; fixEn: string; to: string }> = {
  product_live: { ar: "منتج ظاهر للعملاء", en: "A product customers can buy", fixAr: "ضيف منتج", fixEn: "Add a product", to: "/products/new" },
  shipping_priced: { ar: "سعر شحن", en: "A shipping price", fixAr: "حدد أسعار الشحن", fixEn: "Set shipping prices", to: "/shipping/zones" },
  payment_method: { ar: "طريقة دفع", en: "A way to get paid", fixAr: "فعّل طريقة دفع", fixEn: "Turn on a payment method", to: "/payment-setup" },
  contact_number: { ar: "رقم تواصل", en: "A contact number", fixAr: "ضيف رقم", fixEn: "Add a number", to: "/store" },
};

/** "2 of 4" toward taking orders, each missing condition named with its fix.
 *  The four conditions are computed by the API (one place), so this, the
 *  go-live step and any gate agree. */
export function ReadinessMeter({ storeId }: { storeId: string | undefined }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const { data } = useStoreReadiness(storeId);
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">
          {data.ready
            ? isAr ? "جاهز تستقبل أوردرات ✅" : "Ready to take orders ✅"
            : isAr ? `${data.done} من ${data.total} — قرّبت تستقبل أوردرات` : `${data.done} of ${data.total} — almost ready for orders`}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(data.done / data.total) * 100}%` }} />
      </div>
      <ul className="space-y-2">
        {data.items.map((item) => {
          const copy = ITEMS[item.key];
          return (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <Check className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              )}
              <span className={item.done ? "text-muted-foreground" : "font-medium"}>{isAr ? copy.ar : copy.en}</span>
              {!item.done && (
                <Button size="sm" variant="outline" className="ms-auto h-7 text-xs" onClick={() => navigate(copy.to)}>
                  {isAr ? copy.fixAr : copy.fixEn}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {data.lock_reason === "awaiting_verification" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
          <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            {isAr ? "أكّد إيميلك عشان تفتح متجرك للناس." : "Confirm your email to open your store to customers."}
          </span>
          <Button size="sm" className="h-7 text-xs" onClick={() => navigate("/verify-email")}>
            {isAr ? "أكّد دلوقتي" : "Verify now"}
          </Button>
        </div>
      )}
    </div>
  );
}
