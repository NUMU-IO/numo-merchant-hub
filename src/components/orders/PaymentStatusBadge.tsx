import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* Payment-status pill. Separate from the order-status ramp on purpose:
   "Paid" and "Delivered" are independent axes and the reviewer's
   complaint was that their relationship is hard to scan — the
   `orderStateHint` helper explains the unusual combinations. */
const PAYMENT_STYLE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50",
  cod: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50",
  pending_deposit: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50",
  refunded: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50",
  partially_refunded: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50",
  unpaid: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/50",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/50",
};

const FALLBACK = "bg-muted text-muted-foreground border-border";

export function paymentStatusStyle(status: string | null | undefined) {
  return PAYMENT_STYLE[status ?? ""] ?? FALLBACK;
}

interface PaymentStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const { t } = useTranslation();
  const key = status ?? "";
  const label = t(`orders.${key}`, { defaultValue: key.replace(/_/g, " ") || "—" });
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium rounded-md py-0.5", paymentStatusStyle(status), className)}
    >
      {label}
    </Badge>
  );
}
