import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ONE order-status colour ramp. Before this the hub carried three
   divergent maps (Dashboard, Orders legacy detail, Orders list/mobile)
   so the same order was tinted differently depending on where you
   looked. Keys are the API's OrderStatus values. */
const STATUS_STYLE: Record<string, { pill: string; dot: string }> = {
  delivered: {
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50",
    dot: "bg-emerald-500",
  },
  fulfilled: {
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50",
    dot: "bg-emerald-500",
  },
  shipped: {
    pill: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50",
    dot: "bg-blue-500",
  },
  confirmed: {
    pill: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200/50",
    dot: "bg-teal-500",
  },
  processing: {
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50",
    dot: "bg-amber-500",
  },
  pending_deposit: {
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50",
    dot: "bg-amber-500",
  },
  cancelled: {
    pill: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/50",
    dot: "bg-red-500",
  },
  returned: {
    pill: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200/50",
    dot: "bg-orange-500",
  },
  draft: {
    pill: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/50",
    dot: "bg-zinc-400",
  },
};

const FALLBACK = { pill: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/40" };

export function orderStatusStyle(status: string | null | undefined) {
  return STATUS_STYLE[status ?? ""] ?? FALLBACK;
}

interface OrderStatusBadgeProps {
  status: string | null | undefined;
  /** Show the leading colour dot (list rows do, compact cells may not). */
  dot?: boolean;
  className?: string;
}

export function OrderStatusBadge({ status, dot = true, className }: OrderStatusBadgeProps) {
  const { t } = useTranslation();
  const s = orderStatusStyle(status);
  const key = status ?? "";
  const label = t(`orders.${key}`, { defaultValue: key.replace(/_/g, " ") || "—" });
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium rounded-md py-0.5 gap-1", s.pill, className)}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />}
      {label}
    </Badge>
  );
}
