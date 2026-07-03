/**
 * Locations page — Phase 8.2.
 *
 * CRUD for fulfillment + pickup locations. A location can fulfill
 * shipping orders (warehouse / dark store), offer in-store pickup,
 * or both. Pickup-eligible locations surface to the storefront at
 * checkout; inventory is tracked per variant per location once the
 * store has more than one.
 *
 * Bilingual (en + Egyptian Arabic) + RTL, on the hub design system.
 */

import { useCallback, useEffect, useState } from "react";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
  type CreateLocationData,
  type Location,
} from "@/services/locationsApi";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Truck,
  Store,
  Loader2,
} from "lucide-react";

interface DraftForm {
  name: string;
  name_ar: string;
  is_active: boolean;
  fulfills_orders: boolean;
  fulfills_pickup: boolean;
  address_line1: string;
  city: string;
  country: string;
  pickup_instructions: string;
}

const EMPTY_DRAFT: DraftForm = {
  name: "",
  name_ar: "",
  is_active: true,
  fulfills_orders: true,
  fulfills_pickup: false,
  address_line1: "",
  city: "",
  country: "EG",
  pickup_instructions: "",
};

export default function LocationsPage() {
  const { currentStore } = useDashboardStore();
  const { isRTL } = useLanguage();
  const t = (en: string, ar: string) => (isRTL ? ar : en);
  const storeId = currentStore?.id;

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Location | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      setLocations(await listLocations(storeId));
    } catch (err) {
      showError(err, t("Couldn't load locations.", "تعذّر تحميل المواقع."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setOpen(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setDraft({
      name: loc.name,
      name_ar: loc.name_ar ?? "",
      is_active: loc.is_active,
      fulfills_orders: loc.fulfills_orders,
      fulfills_pickup: loc.fulfills_pickup,
      address_line1: loc.address?.line1 ?? "",
      city: loc.address?.city ?? "",
      country: loc.address?.country ?? "EG",
      pickup_instructions: loc.pickup_instructions ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    if (!draft.name.trim()) {
      toast.error(t("Location name is required.", "اسم الموقع مطلوب."));
      return;
    }
    // PUT is a full replace — carry through fields the form doesn't expose
    // (position, Arabic pickup text) from the row being edited so they aren't
    // reset to server defaults.
    const payload: CreateLocationData = {
      name: draft.name.trim(),
      name_ar: draft.name_ar.trim() || null,
      is_active: draft.is_active,
      fulfills_orders: draft.fulfills_orders,
      fulfills_pickup: draft.fulfills_pickup,
      address: {
        line1: draft.address_line1.trim() || null,
        city: draft.city.trim() || null,
        country: draft.country.trim() || null,
      },
      pickup_instructions: draft.fulfills_pickup
        ? draft.pickup_instructions.trim() || null
        : null,
      pickup_instructions_ar: editing?.pickup_instructions_ar ?? null,
      position: editing?.position ?? locations.length,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateLocation(storeId, editing.id, payload);
        toast.success(t("Location updated.", "تم تحديث الموقع."));
      } else {
        await createLocation(storeId, payload);
        toast.success(t("Location created.", "تم إنشاء الموقع."));
      }
      setOpen(false);
      await refresh();
    } catch (err) {
      showError(err, t("Couldn't save location.", "تعذّر حفظ الموقع."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(loc: Location) {
    if (!storeId) return;
    if (
      !confirm(
        t(
          `Delete "${loc.name}"? Inventory levels at this location will be unlinked.`,
          `حذف "${loc.name}"؟ سيتم فصل مستويات المخزون في هذا الموقع.`,
        ),
      )
    )
      return;
    setDeletingId(loc.id);
    try {
      await deleteLocation(storeId, loc.id);
      toast.success(t("Location deleted.", "تم حذف الموقع."));
      await refresh();
    } catch (err) {
      showError(err, t("Couldn't delete location.", "تعذّر حذف الموقع."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {t("Locations", "المواقع")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
            {t(
              "Fulfillment + pickup points. Inventory is tracked per variant per location once you have more than one.",
              "نقاط التجهيز والاستلام. يتم تتبّع المخزون لكل متغيّر في كل موقع بمجرد وجود أكثر من موقع.",
            )}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          {t("Add location", "أضف موقع")}
        </Button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : locations.length === 0 ? (
        <Card className="rounded-2xl">
          <EmptyState
            icon={MapPin}
            title={t("No locations yet", "لا توجد مواقع بعد")}
            description={t(
              "Add one to start tracking inventory and enable in-store pickup at checkout.",
              "أضف موقعًا لبدء تتبّع المخزون وتفعيل الاستلام من المتجر عند الدفع.",
            )}
            action={
              <Button onClick={openCreate} className="gap-1.5">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                {t("Add location", "أضف موقع")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {locations.map((loc) => (
            <Card
              key={loc.id}
              className={`group rounded-2xl transition-all hover:shadow-md ${
                loc.is_active ? "" : "opacity-70"
              }`}
            >
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="ichip ichip-saffron shrink-0">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold tracking-tight truncate">
                        {isRTL && loc.name_ar ? loc.name_ar : loc.name}
                      </h3>
                      <p className="text-[13px] text-muted-foreground truncate">
                        {loc.address?.city ||
                          t("No address", "بدون عنوان")}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={loc.is_active ? "secondary" : "outline"}
                    className={
                      loc.is_active
                        ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    {loc.is_active
                      ? t("Active", "نشط")
                      : t("Inactive", "غير نشط")}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {loc.fulfills_orders && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("Ships orders", "يشحن الطلبات")}
                    </span>
                  )}
                  {loc.fulfills_pickup && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                      <Store className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("In-store pickup", "استلام من المتجر")}
                    </span>
                  )}
                  {!loc.fulfills_orders && !loc.fulfills_pickup && (
                    <span className="text-[11px] text-muted-foreground">
                      {t("No fulfillment roles", "لا توجد أدوار تجهيز")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 pt-1 border-t border-border/60 -mx-1 px-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(loc)}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("Edit", "تعديل")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deletingId === loc.id}
                    onClick={() => handleDelete(loc)}
                    className="gap-1.5 text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === loc.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {t("Delete", "حذف")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-lg"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("Edit location", "تعديل الموقع")
                : t("New location", "موقع جديد")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="loc-name">{t("Name", "الاسم")}</Label>
                <Input
                  id="loc-name"
                  required
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder={t("Main warehouse", "المخزن الرئيسي")}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="loc-name-ar">
                  {t("Name (Arabic)", "الاسم (بالعربية)")}
                </Label>
                <Input
                  id="loc-name-ar"
                  dir="rtl"
                  value={draft.name_ar}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name_ar: e.target.value }))
                  }
                  placeholder="المخزن الرئيسي"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="loc-addr">{t("Address", "العنوان")}</Label>
                <Input
                  id="loc-addr"
                  value={draft.address_line1}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, address_line1: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-city">{t("City", "المدينة")}</Label>
                <Input
                  id="loc-city"
                  value={draft.city}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, city: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-country">{t("Country", "الدولة")}</Label>
                <Input
                  id="loc-country"
                  value={draft.country}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, country: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Roles */}
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="flex items-center gap-2.5 text-sm">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  {t("Fulfills shipping orders", "يجهّز طلبات الشحن")}
                </span>
                <Switch
                  checked={draft.fulfills_orders}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({ ...d, fulfills_orders: v }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="flex items-center gap-2.5 text-sm">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  {t("Offers in-store pickup", "يوفّر الاستلام من المتجر")}
                </span>
                <Switch
                  checked={draft.fulfills_pickup}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({ ...d, fulfills_pickup: v }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="flex items-center gap-2.5 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {t("Active", "نشط")}
                </span>
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({ ...d, is_active: v }))
                  }
                />
              </label>
            </div>

            {draft.fulfills_pickup && (
              <div className="space-y-1.5">
                <Label htmlFor="loc-pickup">
                  {t(
                    "Pickup instructions (shown to customers)",
                    "تعليمات الاستلام (تظهر للعملاء)",
                  )}
                </Label>
                <Textarea
                  id="loc-pickup"
                  rows={3}
                  value={draft.pickup_instructions}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      pickup_instructions: e.target.value,
                    }))
                  }
                  placeholder={t(
                    "e.g. Open 10am–9pm. Bring your order confirmation.",
                    "مثال: من ١٠ص إلى ٩م. أحضر تأكيد الطلب.",
                  )}
                />
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t("Cancel", "إلغاء")}
              </Button>
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing
                  ? t("Save changes", "حفظ التغييرات")
                  : t("Create location", "إنشاء الموقع")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
