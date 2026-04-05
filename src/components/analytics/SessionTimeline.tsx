import { useLanguage } from "@/contexts/LanguageContext";
import {
  Eye, ShoppingCart, CreditCard, Package, Truck, MousePointerClick,
} from "lucide-react";
import type { TimelineEvent } from "@/services/analyticsApi";

interface SessionTimelineProps {
  timeline: TimelineEvent[];
  formatCurrency: (cents: number) => string;
}

const STEP_CONFIG: Record<string, { icon: typeof Eye; color: string; label_en: string; label_ar: string }> = {
  page_view: { icon: Eye, color: "text-blue-500", label_en: "Page View", label_ar: "مشاهدة صفحة" },
  product_view: { icon: Package, color: "text-cyan-500", label_en: "Product View", label_ar: "مشاهدة منتج" },
  add_to_cart: { icon: ShoppingCart, color: "text-violet-500", label_en: "Added to Cart", label_ar: "إضافة للسلة" },
  checkout_started: { icon: CreditCard, color: "text-amber-500", label_en: "Checkout", label_ar: "بدء الدفع" },
  order_completed: { icon: MousePointerClick, color: "text-emerald-500", label_en: "Order Completed", label_ar: "اكتمال الطلب" },
  order_delivered: { icon: Truck, color: "text-green-600", label_en: "Delivered", label_ar: "تم التسليم" },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function timeBetween(a: string, b: string): string {
  try {
    const diff = Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s`;
    if (diff < 3600) return `${Math.round(diff / 60)}m`;
    return `${Math.round(diff / 3600)}h`;
  } catch {
    return "";
  }
}

export function SessionTimeline({ timeline, formatCurrency }: SessionTimelineProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  if (timeline.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground text-center py-4">
        {isAr ? "مفيش أحداث في الجلسة دي" : "No events in this session"}
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute top-0 bottom-0 left-4 w-px bg-border/60" />

      <div className="space-y-0">
        {timeline.map((event, i) => {
          const config = STEP_CONFIG[event.type] || STEP_CONFIG.page_view;
          const Icon = config.icon;
          const gap = i > 0 ? timeBetween(timeline[i - 1].timestamp, event.timestamp) : null;

          return (
            <div key={i}>
              {/* Time gap indicator */}
              {gap && (
                <div className="flex items-center gap-2 py-0.5 pl-2.5">
                  <div className="h-2 w-2 rounded-full bg-border/40" />
                  <span className="text-[9px] text-muted-foreground/50">{gap}</span>
                </div>
              )}

              <div className="flex items-start gap-3 py-1.5 pl-0.5">
                {/* Icon dot */}
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted shrink-0 z-10 ${config.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold">
                      {isAr ? config.label_ar : config.label_en}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>

                  {event.path && (
                    <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                      {event.path}
                    </p>
                  )}

                  {event.step_data && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {event.step_data.total && (
                        <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 tabular-nums">
                          {formatCurrency(event.step_data.total as number)}
                        </span>
                      )}
                      {event.step_data.product_name && (
                        <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 truncate max-w-[150px]">
                          {String(event.step_data.product_name)}
                        </span>
                      )}
                      {event.step_data.payment_method && (
                        <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 capitalize">
                          {String(event.step_data.payment_method)}
                        </span>
                      )}
                      {event.step_data.item_count && (
                        <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                          {event.step_data.item_count as number} {isAr ? "منتج" : "items"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
