import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatMoney } from "@/lib/format-money";
import { celebrate } from "@/lib/celebrate";
import { getOrder, type OrderListItem } from "@/services/orderApi";

const seenKey = (storeId: string) => `numu:first-order-celebrated:${storeId}`;

function alreadySeen(storeId: string): boolean {
  try {
    return localStorage.getItem(seenKey(storeId)) === "1";
  } catch {
    return false;
  }
}

/**
 * The store's very first order gets its own moment: a full-width card with
 * who ordered, from where and for how much, plus a short confetti burst and
 * chime the first time it is seen. Shown while the store has exactly one
 * order and until the merchant dismisses it.
 */
export default function FirstOrderCelebration({
  storeId,
  order,
}: {
  storeId: string;
  order: OrderListItem;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => alreadySeen(storeId));

  // The list row has no address; the city comes from the order itself.
  const detail = useQuery({
    queryKey: ["order", storeId, order.id],
    queryFn: () => getOrder(storeId, order.id),
    enabled: !hidden,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (hidden) return;
    try {
      if (sessionStorage.getItem(seenKey(storeId))) return;
      sessionStorage.setItem(seenKey(storeId), "1");
    } catch {
      /* storage blocked: still celebrate once per mount */
    }
    celebrate();
  }, [hidden, storeId]);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(seenKey(storeId), "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const name = order.customer_name?.split(" ")[0] || (isAr ? "عميل" : "A customer");
  const city = detail.data?.shipping_address?.city;
  const total = formatMoney(order.total, { fromCents: true, locale: isAr ? "ar" : "en" });

  return (
    <div className="relative overflow-hidden rounded-2xl border border-saffron/40 bg-saffron/10 p-5 sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label={isAr ? "إخفاء" : "Dismiss"}
        className="absolute end-3 top-3 grid h-11 w-11 place-items-center rounded-xl text-muted-foreground hover:bg-background/60"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-saffron/20">
          <PartyPopper className="h-6 w-6 text-saffron" />
        </div>
        <div className="space-y-1.5 pe-10">
          <h2 className="text-lg font-extrabold">
            {isAr ? "أول أوردر! 🥳" : "Your first order! 🥳"}
          </h2>
          <p className="text-sm">
            {isAr
              ? `${name}${city ? ` من ${city}` : ""} طلبت ب ${total}`
              : `${name}${city ? ` from ${city}` : ""} ordered ${total}`}
          </p>
          <Button size="sm" className="mt-2" onClick={() => navigate(`/orders/${order.id}`)}>
            {isAr ? "جهّز الأوردر" : "Prepare the order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
