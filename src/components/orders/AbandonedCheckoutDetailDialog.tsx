import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  Tag,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { TrafficSourceIcon } from "@/components/orders/TrafficSourceIcon";
import { listCustomers } from "@/services/customerApi";
import type { AbandonedCheckout } from "@/services/abandonedCheckoutApi";

interface AbandonedCheckoutDetailDialogProps {
  storeId: string;
  checkout: AbandonedCheckout | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWhatsApp: (id: string) => void;
  onSendEmail: (id: string) => void;
  onMarkRecovered: (id: string) => void;
  whatsAppPending: boolean;
  emailPending: boolean;
  recoverPending: boolean;
}

/** Pull a display name out of the loosely-typed checkout shipping_address. */
function addressName(sa: Record<string, unknown> | null): string | null {
  if (!sa) return null;
  const name =
    (sa.name as string) ||
    [sa.first_name, sa.last_name].filter(Boolean).join(" ");
  return name?.trim() ? String(name).trim() : null;
}

function addressLines(sa: Record<string, unknown> | null): string[] {
  if (!sa) return [];
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = sa[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  return [
    pick("address", "address_line1", "street", "line1"),
    [pick("city"), pick("state", "governorate", "region")].filter(Boolean).join(", "),
    pick("country"),
  ].filter((l): l is string => !!l && l.length > 0);
}

export function AbandonedCheckoutDetailDialog({
  storeId,
  checkout: c,
  open,
  onOpenChange,
  onWhatsApp,
  onSendEmail,
  onMarkRecovered,
  whatsAppPending,
  emailPending,
  recoverPending,
}: AbandonedCheckoutDetailDialogProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();

  // Many checkouts are started before the shopper logs in, so the row's
  // customer_id is null even when a registered customer with the same email
  // exists. Resolve by exact email match so the journey link still works.
  const email = c?.email?.trim().toLowerCase() ?? "";
  const resolvedCustomer = useQuery({
    queryKey: ["abandoned-detail-customer", storeId, email],
    queryFn: () => listCustomers(storeId, { query: email, limit: 2 }),
    enabled: open && !!c && !c.customer_id && email.length > 0,
    staleTime: 5 * 60 * 1000,
    select: (res) =>
      res.items.find((cust) => cust.email.toLowerCase() === email) ?? null,
  });

  if (!c) return null;

  const journeyCustomerId = c.customer_id ?? resolvedCustomer.data?.id ?? null;

  const fmtMoney = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const fmtExact = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(isAr ? "ar-EG" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(isAr ? `تم نسخ ${label}` : `${label} copied`);
    } catch {
      toast.error(isAr ? "تعذر النسخ" : "Couldn't copy");
    }
  };

  const name = addressName(c.shipping_address);
  const address = addressLines(c.shipping_address);

  const timeline: Array<{ label: string; at: string | null }> = [
    { label: isAr ? "بدأ السلة" : "Started cart", at: c.created_at },
    { label: isAr ? "آخر نشاط" : "Last activity", at: c.last_activity_at },
    { label: isAr ? "اعتُبرت متروكة" : "Marked abandoned", at: c.abandoned_at },
    { label: isAr ? "أُرسل بريد الاسترداد" : "Recovery email sent", at: c.recovery_email_sent_at },
    { label: isAr ? "تم الاسترداد" : "Recovered", at: c.recovered_at },
  ];

  const ContactRow = ({
    icon: Icon,
    label,
    value,
    copyable,
    ltr,
  }: {
    icon: typeof Mail;
    label: string;
    value: string | null;
    copyable?: boolean;
    ltr?: boolean;
  }) => (
    <div className="flex items-center gap-2.5 min-w-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className="text-sm font-medium break-all leading-snug"
          dir={ltr ? "ltr" : undefined}
          style={ltr && isAr ? { textAlign: "end" } : undefined}
        >
          {value || "—"}
        </p>
      </div>
      {copyable && value && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => copy(value, label)}
          aria-label={`${isAr ? "نسخ" : "Copy"} ${label}`}
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between gap-3 pe-6">
            <DialogTitle className="text-base">
              {isAr ? "تفاصيل السلة المتروكة" : "Abandoned checkout details"}
            </DialogTitle>
            {c.recovered_at ? (
              <Badge variant="outline" className="text-[10px] py-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-200/50">
                <CheckCircle2 className="h-3 w-3 me-1" />
                {isAr ? "مستردة" : "Recovered"}
              </Badge>
            ) : c.recovery_email_sent_at ? (
              <Badge variant="outline" className="text-[10px] py-0.5 bg-blue-500/10 text-blue-600 border-blue-200/50">
                {isAr ? "أُرسل بريد" : "Email sent"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] py-0.5 bg-amber-500/10 text-amber-600 border-amber-200/50">
                {isAr ? "متروكة" : "Abandoned"}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs">
            {isAr
              ? "كل بيانات العميل والسلة في مكان واحد."
              : "Everything about this customer and their cart, in one place."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ── Contact ─────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border/60 p-3.5 space-y-3">
            <ContactRow
              icon={User}
              label={isAr ? "الاسم" : "Name"}
              value={name}
            />
            <ContactRow
              icon={Mail}
              label={isAr ? "الإيميل" : "Email"}
              value={c.email}
              copyable
              ltr
            />
            <ContactRow
              icon={Phone}
              label={isAr ? "الموبايل" : "Phone"}
              value={c.phone}
              copyable
              ltr
            />
            {address.length > 0 && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {isAr ? "العنوان" : "Address"}
                  </p>
                  {address.map((line, i) => (
                    <p key={i} className="text-sm leading-snug">{line}</p>
                  ))}
                </div>
              </div>
            )}

            {journeyCustomerId ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 h-8 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/customers/${journeyCustomerId}`);
                }}
              >
                {isAr ? "عرض العميل ورحلته الكاملة" : "View customer & full journey"}
                <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </Button>
            ) : resolvedCustomer.isFetching ? (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {isAr ? "جارٍ البحث عن ملف العميل…" : "Looking up customer profile…"}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "زائر بدون حساب — لا يوجد ملف عميل أو رحلة لعرضها."
                  : "Guest checkout — no customer profile or journey to open."}
              </p>
            )}
          </div>

          {/* ── Traffic source ──────────────────────────────────────── */}
          {(c.utm_source || c.utm_medium || c.utm_campaign) && (
            <div className="rounded-xl border border-border/60 p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {isAr ? "مصدر الزيارة" : "Traffic source"}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <TrafficSourceIcon source={c.utm_source ?? ""} className="h-4 w-4 shrink-0" />
                <span className="font-medium">{c.utm_source || "—"}</span>
                {c.utm_medium && (
                  <span className="text-xs text-muted-foreground">· {c.utm_medium}</span>
                )}
              </div>
              {c.utm_campaign && (
                <p className="mt-1 text-xs text-muted-foreground break-all">
                  {isAr ? "الحملة: " : "Campaign: "}
                  {c.utm_campaign}
                </p>
              )}
            </div>
          )}

          {/* ── Cart items ──────────────────────────────────────────── */}
          <div className="rounded-xl border border-border/60 p-3.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShoppingBag className="h-3 w-3" />
              {isAr ? `السلة (${c.item_count})` : `Cart (${c.item_count})`}
            </p>
            <div className="space-y-2.5">
              {c.line_items.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isAr ? "لا توجد عناصر مسجلة" : "No items recorded"}
                </p>
              ) : (
                c.line_items.map((li, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {li.product_name || (isAr ? "منتج محذوف" : "Deleted product")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {[li.variant_name, li.sku ? `SKU ${li.sku}` : null]
                          .filter(Boolean)
                          .join(" · ") || null}
                        {(li.variant_name || li.sku) && " · "}
                        {li.quantity} × {fmtMoney(li.unit_price)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">
                      {fmtMoney(li.total_price)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <Separator className="my-3" />

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? "المجموع الفرعي" : "Subtotal"}</span>
                <span className="tabular-nums">{fmtMoney(c.subtotal)}</span>
              </div>
              {c.shipping_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isAr ? "الشحن" : "Shipping"}</span>
                  <span className="tabular-nums">{fmtMoney(c.shipping_cost)}</span>
                </div>
              )}
              {c.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span className="flex items-center gap-1">
                    {isAr ? "الخصم" : "Discount"}
                    {c.coupon_code && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1 text-[10px] font-mono">
                        <Tag className="h-2.5 w-2.5" />
                        {c.coupon_code}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">−{fmtMoney(c.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1">
                <span>{isAr ? "الإجمالي" : "Total"}</span>
                <span className="tabular-nums">{fmtMoney(c.total)}</span>
              </div>
            </div>
          </div>

          {/* ── Timeline ────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border/60 p-3.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              {isAr ? "الخط الزمني" : "Timeline"}
            </p>
            <div className="space-y-1.5">
              {timeline
                .filter((t) => fmtExact(t.at))
                .map((t) => (
                  <div key={t.label} className="flex justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{t.label}</span>
                    <span className="tabular-nums text-end">{fmtExact(t.at)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div className="px-5 py-3.5 border-t border-border/40 bg-muted/20 flex flex-wrap items-center justify-end gap-2">
          {c.recovered_order_id && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                onOpenChange(false);
                navigate(`/orders/${c.recovered_order_id}`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? "عرض الطلب" : "View order"}
            </Button>
          )}
          {!c.recovered_at && c.phone && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-200/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              disabled={whatsAppPending}
              onClick={() => onWhatsApp(c.id)}
            >
              {whatsAppPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5" />
              )}
              {isAr ? "واتساب" : "WhatsApp"}
            </Button>
          )}
          {!c.recovered_at && c.email && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              disabled={emailPending}
              onClick={() => onSendEmail(c.id)}
            >
              {emailPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              {c.recovery_email_sent_at
                ? (isAr ? "إعادة الإرسال" : "Resend")
                : (isAr ? "إرسال بريد الاسترداد" : "Send recovery")}
            </Button>
          )}
          {!c.recovered_at && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={recoverPending}
              onClick={() => onMarkRecovered(c.id)}
            >
              {recoverPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {isAr ? "تحديد كمستردة" : "Mark recovered"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
