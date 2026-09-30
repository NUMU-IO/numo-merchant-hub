/**
 * One-time explainer for "cash with courier" on the orders page.
 *
 * A paid COD order used to look finished even while the courier still held
 * the money. Merchants need to know the new badge exists and what to do
 * about it, so this opens once per tenant when there is something to act on.
 * Seen-state lives in localStorage like FounderWelcomeDialog: a nicety, not a
 * record. `?intro=cod-cash` forces it open for support checks.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Coins, Truck } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const seenKey = (tenantId: string) => `numu.intro.cod-cash.${tenantId}`;

interface Props {
  /** Orders whose cash is still with the courier; the dialog waits for one. */
  count: number;
  isAr: boolean;
  onShowOrders: () => void;
}

export function CodCashIntroDialog({ count, isAr, onShowOrders }: Props) {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const forced = new URLSearchParams(window.location.search).get("intro") === "cod-cash";
    if (!forced) {
      if (count === 0) return;
      try {
        if (localStorage.getItem(seenKey(tenantId)) === "1") return;
      } catch {
        // Storage disabled: show it; seeing it again is harmless.
      }
    }
    setOpen(true);
  }, [count, tenantId]);

  const dismiss = () => {
    setOpen(false);
    if (!tenantId) return;
    try {
      localStorage.setItem(seenKey(tenantId), "1");
    } catch {
      /* it will simply show again */
    }
  };

  const rows = [
    {
      icon: <Truck className="h-4 w-4 text-amber-600" />,
      title: isAr ? "مدفوع · الفلوس مع الشحن" : "Paid · Cash with courier",
      body: isAr
        ? "العميل دفع للمندوب، بس شركة الشحن لسه ما حوّلتلكش الفلوس."
        : "The customer paid the courier, but the courier hasn't handed the money to you yet.",
    },
    {
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      title: isAr ? "مدفوع · الفلوس وصلتك" : "Paid · Cash collected",
      body: isAr
        ? "لما شركة الشحن تحوّلك، دوس \"استلمت الفلوس\" من صفحة الطلب، أو حدد كذا طلب ودوسها مرة واحدة."
        : "When the courier pays you, tap \"Cash collected\" on the order, or select several orders and mark them at once.",
    },
    {
      icon: <Coins className="h-4 w-4 text-sky-600" />,
      title: isAr ? "عربون" : "Deposit",
      body: isAr
        ? "الطلبات اللي العميل دفع فيها عربون مقدّم بيظهر عليها المبلغ، والباقي بيتحصّل وقت التوصيل."
        : "Orders where the customer paid a deposit up front show the amount; the rest is collected on delivery.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAr ? "جديد: تابع فلوس الدفع عند الاستلام" : "New: track your COD cash"}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "الطلب بيبقى مدفوع أول ما العميل يدفع للمندوب، لكن الفلوس بتوصلك بعدها بأيام. دلوقتي تقدر تعرف الفرق."
              : "An order is paid once the customer pays the courier, but the cash reaches you days later. Now you can tell the difference."}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.title} className="flex gap-3">
              <span className="mt-0.5 shrink-0">{r.icon}</span>
              <span className="text-sm">
                <b className="block">{r.title}</b>
                <span className="text-muted-foreground">{r.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss}>
            {isAr ? "تمام" : "Got it"}
          </Button>
          {count > 0 && (
            <Button
              onClick={() => {
                dismiss();
                onShowOrders();
              }}
            >
              {isAr ? `اعرض الفلوس اللي مع الشحن (${count})` : `Show cash with courier (${count})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
