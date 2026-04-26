/**
 * NewOrderNotifier — polls the orders endpoint and surfaces a toast every
 * time a new order arrives. Mounted once at the dashboard layout level so
 * it watches every page in the merchant hub.
 *
 * Strategy:
 *   • On first mount (per store), call listOrders() once to establish the
 *     "high-water mark" — the timestamp of the newest existing order.
 *     We do NOT toast for orders that already existed before the dashboard
 *     was opened; only for orders that arrive AFTER mount.
 *   • Persist the high-water mark in localStorage keyed by store id so the
 *     dashboard doesn't re-toast the same orders after a hard refresh.
 *   • Poll every 20s. Compare newest order against the mark; toast each
 *     new order (in chronological order) and advance the mark.
 *
 * No sound — browsers gate audio behind a user gesture and inconsistent
 * autoplay would just spam the console. Visual + clickable toast only.
 */

import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { listOrders, type OrderListItem } from "@/services/orderApi";

const POLL_INTERVAL_MS = 20_000;
const STORAGE_PREFIX = "numu.lastOrderSeen.";

function storageKey(storeId: string) {
  return `${STORAGE_PREFIX}${storeId}`;
}

function readMark(storeId: string): string | null {
  try {
    return localStorage.getItem(storageKey(storeId));
  } catch {
    return null;
  }
}

function writeMark(storeId: string, isoTimestamp: string) {
  try {
    localStorage.setItem(storageKey(storeId), isoTimestamp);
  } catch {
    /* quota / private mode — silently ignore, will re-init next session */
  }
}

function formatMoney(cents: number, currency: string, isAr: boolean) {
  const value = (cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US", {
    maximumFractionDigits: 0,
  });
  return isAr ? `${value} ${currency}` : `${currency} ${value}`;
}

interface OrderToastProps {
  order: OrderListItem;
  isAr: boolean;
  toastId: string | number;
  onClick: () => void;
}

function OrderToast({ order, isAr, toastId, onClick }: OrderToastProps) {
  const total = formatMoney(order.total, order.currency, isAr);
  const customer = order.customer_name?.trim();
  const subtitle = customer
    ? `${customer} · ${total}`
    : `${order.order_number} · ${total}`;

  return (
    <button
      type="button"
      onClick={() => {
        toast.dismiss(toastId);
        onClick();
      }}
      className="flex items-center gap-3 rounded-2xl bg-background/95 backdrop-blur-md border border-border/60 shadow-2xl shadow-black/10 dark:shadow-black/30 px-4 py-3 min-w-[280px] text-start hover:bg-background transition-colors"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 shrink-0">
        <ShoppingCart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">
          {isAr ? "طلب جديد!" : "New Order!"}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {subtitle}
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground/60 shrink-0">
        {isAr ? "الآن" : "now"}
      </span>
    </button>
  );
}

export function NewOrderNotifier() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";

  const storeId = currentStore?.id ?? "";
  // Holds the ISO timestamp of the newest order we've already shown a toast
  // for (or seeded as "existing"). Stays in a ref so the polling effect
  // doesn't re-run every time the mark advances.
  const highWaterRef = useRef<string | null>(null);
  // Per-store init flag — prevents the seed call from running twice when
  // React StrictMode double-mounts the effect in development.
  const initializedForRef = useRef<string | null>(null);

  const showOrderToast = useCallback(
    (order: OrderListItem) => {
      const id = `new-order-${order.id}`;
      toast.custom(
        (toastId) => (
          <OrderToast
            order={order}
            isAr={isAr}
            toastId={toastId}
            onClick={() => navigate(`/orders?focus=${order.id}`)}
          />
        ),
        { id, duration: 8000 },
      );
    },
    [isAr, navigate],
  );

  useEffect(() => {
    if (!storeId) {
      highWaterRef.current = null;
      initializedForRef.current = null;
      return;
    }

    // Re-seed the mark whenever the active store changes.
    if (initializedForRef.current !== storeId) {
      highWaterRef.current = readMark(storeId);
      initializedForRef.current = storeId;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const data = await listOrders(storeId, { page: 1, limit: 10 });
        if (cancelled) return;

        // API returns most-recent first (default sort). Find ones we haven't
        // toasted yet — strictly newer than the high-water mark — and walk
        // them oldest→newest so toasts stack in arrival order.
        const mark = highWaterRef.current;
        const fresh = mark
          ? data.items.filter((o) => o.created_at > mark)
          : []; // no mark yet → seed from this response, do NOT toast existing orders

        if (!mark && data.items.length > 0) {
          // First successful fetch for this store. Seed the mark with the
          // newest order so we only toast genuinely new arrivals.
          const newest = data.items[0].created_at;
          highWaterRef.current = newest;
          writeMark(storeId, newest);
        } else if (fresh.length > 0) {
          const sorted = [...fresh].sort((a, b) =>
            a.created_at < b.created_at ? -1 : 1,
          );
          for (const order of sorted) {
            showOrderToast(order);
          }
          const newest = sorted[sorted.length - 1].created_at;
          highWaterRef.current = newest;
          writeMark(storeId, newest);
        } else if (!mark) {
          // No mark, no items — seed with empty sentinel so we don't keep
          // re-checking for "no items" as if it were the first poll.
          const sentinel = new Date().toISOString();
          highWaterRef.current = sentinel;
          writeMark(storeId, sentinel);
        }
      } catch {
        /* network blip — try again next tick */
      } finally {
        if (!cancelled) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    // Kick off immediately so the seed mark is in place before any new
    // orders can sneak in via the long poll interval.
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [storeId, showOrderToast]);

  return null;
}
