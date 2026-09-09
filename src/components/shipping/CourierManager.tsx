/**
 * Manage the couriers a merchant runs themselves.
 *
 * These are the Tier 3 couriers — البريد المصري, Cathedis, and the rider
 * on a motorbike. Seeded couriers let a merchant pick a known name
 * instead of typing one plus 27 governorate codes.
 *
 * A seed whose coverage hasn't been confirmed is labelled as such. It
 * ships covering everywhere, which is the safer default — a courier that
 * actually covers less declines the parcel and the merchant finds out
 * immediately, whereas one wrongly limited hides deliveries silently.
 * Saying "unconfirmed" is the honest version of that.
 */

import { useState } from "react";
import {
  Download,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { pickupMessage, whatsAppLink } from "@/lib/whatsapp";
import { CourierLogo } from "./CourierLogo";
import {
  type CourierProfile,
  type CourierSeed,
  courierName,
  coverageLabel,
  seedName,
} from "@/services/courierApi";

interface Props {
  couriers: CourierProfile[];
  seeds: CourierSeed[];
  isAr: boolean;
  saving?: boolean;
  onCreate: (payload: Partial<CourierProfile> & { seed_key?: string }) => void;
  onUpdate: (id: string, payload: Partial<CourierProfile>) => void;
  onDelete: (id: string) => void;
  /** Named in the WhatsApp pickup request so the courier knows the store. */
  storeName: string;
  /** Shipments in `created` — packed and waiting for a courier. */
  readyParcels: number;
  /** Download one courier's parcels as CSV — the Tier 3 handoff. */
  onDownloadSheet?: (courier: CourierProfile) => void;
}

export const CourierManager = ({
  couriers,
  seeds,
  isAr,
  saving = false,
  onCreate,
  onUpdate,
  onDelete,
  storeName,
  readyParcels,
  onDownloadSheet,
}: Props) => {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-extrabold tracking-tight">
            {isAr ? "المناديب وشركات الشحن الخاصة" : "Your couriers"}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {isAr
              ? "الشركات اللي بتتعامل معاها بنفسك — إحنا بنطبع البوليصة ونتابع الحالة."
              : "Couriers you arrange yourself — we print the waybill and track the status."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="me-1.5 h-3.5 w-3.5" />
          {isAr ? "أضف" : "Add"}
        </Button>
      </div>

      {adding && (
        <AddCourier
          seeds={seeds}
          isAr={isAr}
          saving={saving}
          onCreate={(payload) => {
            onCreate(payload);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {couriers.length === 0 && !adding ? (
        <EmptyState isAr={isAr} />
      ) : (
        <ul className="divide-y divide-border/60 rounded-2xl border border-border bg-card">
          {couriers.map((courier) => (
            <CourierRow
              key={courier.id}
              courier={courier}
              isAr={isAr}
              onToggle={(active) => onUpdate(courier.id, { is_active: active })}
              onDelete={() => onDelete(courier.id)}
              storeName={storeName}
              readyParcels={readyParcels}
              onDownloadSheet={
                onDownloadSheet ? () => onDownloadSheet(courier) : undefined
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
};

const EmptyState = ({ isAr }: { isAr: boolean }) => (
  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
    <p className="text-[13px] font-semibold">
      {isAr ? "لسه مضفتش مندوب" : "No couriers yet"}
    </p>
    <p className="mt-1 text-[12px] text-muted-foreground">
      {isAr
        ? "ضيف المندوب أو الشركة اللي بتشحن معاها، وإحنا نطبعلك البوليصة."
        : "Add the courier you ship with and we'll print the waybill."}
    </p>
  </div>
);

const CourierRow = ({
  courier,
  isAr,
  onToggle,
  onDelete,
  storeName,
  readyParcels,
  onDownloadSheet,
}: {
  courier: CourierProfile;
  isAr: boolean;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
  /** Shown to the courier so they know whose parcels these are. */
  storeName: string;
  /** Shipments in `created` — packed, not yet picked up. */
  readyParcels: number;
  /** Download this courier's parcels as CSV. Absent = no sheet offered. */
  onDownloadSheet?: () => void;
}) => {
  /* The Tier 3 handoff, in its cheapest honest form. These couriers all
     work over WhatsApp already; a `wa.me` link needs no Meta template
     approval and no inbound plumbing. Null when the number is unusable,
     so the button is absent rather than broken. */
  const waHref =
    readyParcels > 0
      ? whatsAppLink(
          courier.contact_phone,
          pickupMessage({
            courier: courierName(courier, isAr),
            store: storeName,
            parcels: readyParcels,
            cutoff: courier.cutoff_time,
            isAr,
          }),
        )
      : null;

  return (
  <li className="flex items-center gap-3 px-4 py-3">
    <CourierLogo
      seedKey={courier.seed_key}
      name={courierName(courier, isAr)}
      size={28}
    />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold">{courierName(courier, isAr)}</span>
        {!courier.is_active && (
          <Badge variant="secondary" className="h-5 text-[10px]">
            {isAr ? "موقوف" : "Paused"}
          </Badge>
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {coverageLabel(courier, isAr)}
        </span>
        {courier.contact_phone && (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {/* A phone number is LTR even in an Arabic UI. */}
            <span dir="ltr" className="font-mono">
              {courier.contact_phone}
            </span>
          </span>
        )}
        {courier.cutoff_time && (
          <span dir="ltr" className="font-mono">
            {isAr ? "آخر ميعاد " : "cut-off "}
            {courier.cutoff_time}
          </span>
        )}
      </div>
    </div>

    {onDownloadSheet && (
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={() => onDownloadSheet()}
        title={
          isAr
            ? "ملف CSV بشحنات المندوب ده بس"
            : "A CSV of this courier's parcels only"
        }
      >
        <Download className="h-3.5 w-3.5" />
        {isAr ? "نزّل الكشف" : "Download sheet"}
      </Button>
    )}
    {waHref && (
      <a href={waHref} target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <MessageCircle className="h-3.5 w-3.5" />
          {isAr ? "اطلب استلام" : "Request pickup"}
        </Button>
      </a>
    )}
    <Switch checked={courier.is_active} onCheckedChange={onToggle} />
    <Button
      size="sm"
      variant="ghost"
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onClick={onDelete}
      aria-label={isAr ? "حذف" : "Delete"}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  </li>
  );
};

const AddCourier = ({
  seeds,
  isAr,
  saving,
  onCreate,
  onCancel,
}: {
  seeds: CourierSeed[];
  isAr: boolean;
  saving: boolean;
  onCreate: (payload: Partial<CourierProfile> & { seed_key?: string }) => void;
  onCancel: () => void;
}) => {
  const [selected, setSelected] = useState<CourierSeed | null>(null);
  const [custom, setCustom] = useState({ name: "", phone: "", cutoff: "" });

  const submit = () => {
    if (selected) {
      onCreate({
        seed_key: selected.key,
        ...(custom.phone ? { contact_phone: custom.phone } : {}),
        ...(custom.cutoff ? { cutoff_time: custom.cutoff } : {}),
      });
      return;
    }
    if (!custom.name.trim()) return;
    onCreate({
      name_ar: custom.name,
      name_en: custom.name,
      contact_phone: custom.phone || null,
      cutoff_time: custom.cutoff || null,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <Label className="text-xs font-medium">
          {isAr ? "اختار شركة معروفة" : "Pick a known courier"}
        </Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {seeds.map((seed) => (
            <button
              key={seed.key}
              type="button"
              onClick={() =>
                setSelected((prev) => (prev?.key === seed.key ? null : seed))
              }
              className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
                selected?.key === seed.key
                  ? "border-navy bg-navy/5 font-semibold dark:border-saffron dark:bg-saffron/10"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <CourierLogo
                  seedKey={seed.key}
                  name={seedName(seed, isAr)}
                  size={18}
                />
                {seedName(seed, isAr)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && <SeedNotice seed={selected} isAr={isAr} />}

      {!selected && (
        <div className="space-y-1.5">
          <Label htmlFor="courier-name" className="text-xs font-medium">
            {isAr ? "اسم المندوب أو الشركة" : "Courier name"}
          </Label>
          <Input
            id="courier-name"
            value={custom.name}
            onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))}
            placeholder={isAr ? "مثلاً: عم سيد" : "e.g. Ahmed on the bike"}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="courier-phone" className="text-xs font-medium">
            {isAr ? "رقم التليفون" : "Phone"}
          </Label>
          <Input
            id="courier-phone"
            dir="ltr"
            className="font-mono text-xs"
            value={custom.phone}
            onChange={(e) => setCustom((c) => ({ ...c, phone: e.target.value }))}
            placeholder="+20 10 0000 0000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="courier-cutoff" className="text-xs font-medium">
            {isAr ? "آخر ميعاد استلام" : "Pickup cut-off"}
          </Label>
          <Input
            id="courier-cutoff"
            dir="ltr"
            className="font-mono text-xs"
            value={custom.cutoff}
            onChange={(e) => setCustom((c) => ({ ...c, cutoff: e.target.value }))}
            placeholder="16:00"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={saving || (!selected && !custom.name.trim())}
          onClick={submit}
        >
          {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
          {isAr ? "أضف المندوب" : "Add courier"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {isAr ? "إلغاء" : "Cancel"}
        </Button>
      </div>
    </div>
  );
};

/**
 * Says plainly when a seeded courier's coverage is unconfirmed.
 *
 * The alternative — showing 27 governorates as though we had checked —
 * would be presenting a placeholder as fact.
 */
const SeedNotice = ({ seed, isAr }: { seed: CourierSeed; isAr: boolean }) => {
  const note = isAr ? seed.note_ar : seed.note_en;
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed">
      {note && <p>{note}</p>}
      {!seed.data_verified && (
        <p className="text-muted-foreground">
          {isAr
            ? "التغطية مبدئيًا كل المحافظات — لسه محتاجة تتأكد. عدّلها من إعدادات المندوب."
            : "Coverage defaults to every governorate and is unconfirmed — adjust it in the courier's settings."}
        </p>
      )}
    </div>
  );
};
