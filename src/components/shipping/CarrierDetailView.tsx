/**
 * Detail page for any carrier that has no bespoke view.
 *
 * Bosta keeps its own screen because it carries a shipments list, COD
 * reconciliation and pickups. Every other carrier gets this: header,
 * declared capabilities, and a connect-form generated from the registry.
 * That is what makes a newly registered carrier usable without a
 * frontend commit.
 */

import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CarrierCredentialsForm } from "./CarrierCredentialsForm";
import { CarrierMark } from "./CarrierMark";
import {
  type Carrier,
  type CarrierCapabilities,
  carrierName,
} from "@/services/carrierApi";

interface Props {
  carrier: Carrier;
  isAr: boolean;
  saving?: boolean;
  verifying?: boolean;
  togglingAutoCreate?: boolean;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
  onVerify: () => void;
  onDisconnect: () => void;
  onToggleAutoCreate: (value: boolean) => void;
}

/** Only capabilities a merchant would recognise as a feature. */
const CAPABILITY_LABELS: Partial<
  Record<keyof CarrierCapabilities, { en: string; ar: string }>
> = {
  supports_cod: { en: "Cash on delivery", ar: "الدفع عند الاستلام" },
  supports_tracking: { en: "Live tracking", ar: "تتبّع مباشر" },
  supports_labels: { en: "Printed waybills", ar: "طباعة البوليصة" },
  supports_pickup: { en: "Scheduled pickups", ar: "حجز استلام" },
  supports_return: { en: "Returns", ar: "مرتجعات" },
  supports_cancel: { en: "Cancel a shipment", ar: "إلغاء الشحنة" },
  supports_live_rates: { en: "Live rates", ar: "أسعار مباشرة" },
};

export const CarrierDetailView = ({
  carrier,
  isAr,
  saving,
  verifying,
  togglingAutoCreate,
  onBack,
  onSave,
  onVerify,
  onDisconnect,
  onToggleAutoCreate,
}: Props) => {
  const name = carrierName(carrier, isAr);
  const supported = (
    Object.keys(CAPABILITY_LABELS) as (keyof CarrierCapabilities)[]
  ).filter((key) => carrier.capabilities[key]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {isAr ? "رجوع" : "Back"}
      </Button>

      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{ background: `${carrier.brand_color ?? "#71717A"}12` }}
        >
          <CarrierMark
            slug={carrier.slug}
            name={carrier.name_en}
            brandColor={carrier.brand_color}
            size={26}
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight">{name}</h1>
          {/* The slug is an identifier — LTR even in an Arabic UI. */}
          <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
            {carrier.slug}
          </p>
        </div>
      </div>

      {supported.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-[13px] font-bold">
            {isAr ? "الشركة دي بتدعم" : "This carrier supports"}
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {supported.map((key) => (
              <Badge key={key} variant="secondary" className="text-[11px] font-medium">
                {isAr ? CAPABILITY_LABELS[key]!.ar : CAPABILITY_LABELS[key]!.en}
              </Badge>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
            {isAr
              ? "الحاجات اللي مش في القايمة دي مش هتبان في لوحة الشحنات، عشان متضغطش على حاجة الشركة مش بتعملها."
              : "Anything not listed stays hidden in the shipments view, so you never click an action this carrier cannot perform."}
          </p>
        </div>
      )}

      {carrier.status.is_configured && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold">
              {isAr ? "إنشاء الشحنة تلقائي" : "Auto-create shipments"}
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {isAr
                ? "أي طلب جديد بالدفع عند الاستلام بيتسجل عند الشركة على طول. لو تأكيد الطلب على واتساب شغال، بيتسجل بعد ما العميل يأكد. الطلبات المدفوعة أونلاين بتتسجل بعد الدفع."
                : "New cash-on-delivery orders are booked with this carrier right away. If WhatsApp order confirmation is on, they're booked once the customer confirms. Online-payment orders are booked once paid."}
            </p>
          </div>
          <Switch
            checked={carrier.status.auto_create_shipment}
            disabled={togglingAutoCreate}
            onCheckedChange={onToggleAutoCreate}
            aria-label={isAr ? "إنشاء الشحنة تلقائي" : "Auto-create shipments"}
          />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[13px] font-bold">
          {isAr ? "بيانات الربط" : "Connection details"}
        </h2>
        <p className="mt-0.5 mb-3.5 text-[11.5px] text-muted-foreground">
          {isAr
            ? "البيانات بتتشفّر عندنا، ومحدش بيقدر يشوفها تاني بعد ما تتحفظ."
            : "Stored encrypted, and never shown again after saving."}
        </p>
        <CarrierCredentialsForm
          carrier={carrier}
          isAr={isAr}
          saving={saving}
          verifying={verifying}
          onSave={onSave}
          onVerify={onVerify}
          onDisconnect={onDisconnect}
        />
      </div>
    </div>
  );
};
