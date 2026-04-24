/**
 * Shipping zones table — the merchant's main view.
 *
 * Empty state: two CTAs — "Use Egypt 4-zone preset" (recommended) and
 * "Start blank". With data, shows a table of zones + their rates, COD
 * status, ETA, with edit / disable actions.
 *
 * The coverage banner sits at the top and flags any governorates the
 * merchant isn't shipping to.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Power, Sparkles, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CoverageBanner } from "@/components/shipping/CoverageBanner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  useApplyEgypt4ZonePreset,
  useDeleteShippingZone,
  useReferenceGovernorates,
  useShippingZones,
} from "@/hooks/useShippingZones";
import type { RateConfigFlat, ShippingRate } from "@/services/shippingApi";

export default function ZonesPage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const { data: zones = [], isLoading } = useShippingZones(storeId);
  const { data: governorates = [] } = useReferenceGovernorates(
    ar ? "ar" : "en",
  );
  const applyPreset = useApplyEgypt4ZonePreset(storeId);
  const deleteZone = useDeleteShippingZone(storeId);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmPreset, setConfirmPreset] = useState(false);

  const nameByCode = useMemo(
    () => new Map(governorates.map((g) => [g.code, g.name] as const)),
    [governorates],
  );

  function formatRate(rate: ShippingRate): string {
    if (rate.rate_type === "flat") {
      const cfg = rate.config as unknown as RateConfigFlat;
      return `${rate.label} ${(cfg.amount_cents / 100).toFixed(0)} ${ar ? "ج.م" : "EGP"}`;
    }
    if (rate.rate_type === "free_over") {
      return `${rate.label} ${ar ? "(شحن مجاني مشروط)" : "(free over threshold)"}`;
    }
    if (rate.rate_type === "weight_band") {
      return `${rate.label} ${ar ? "(حسب الوزن)" : "(by weight)"}`;
    }
    return rate.label;
  }

  function formatCoverage(codes: string[]): string {
    if (codes.length === 0) return ar ? "لا شيء" : "None";
    const shown = codes.slice(0, 3).map((c) => nameByCode.get(c) ?? c);
    if (codes.length > 3) {
      shown.push(ar ? `+${codes.length - 3} أخرى` : `+${codes.length - 3}`);
    }
    return shown.join(ar ? "، " : ", ");
  }

  const handlePreset = async () => {
    setConfirmPreset(false);
    try {
      await applyPreset.mutateAsync();
      toast.success(ar ? "تم تطبيق إعداد 4 مناطق" : "Egypt 4-zone preset applied");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);
    try {
      await deleteZone.mutateAsync(id);
      toast.success(ar ? "تم تعطيل المنطقة" : "Zone deactivated");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(message);
    }
  };

  if (!storeId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {ar ? "اختر متجرًا أولًا" : "Select a store first"}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ar ? "مناطق الشحن" : "Shipping zones"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "جمّع محافظات مصر في مناطق، وحدد لكل منطقة أسعار الشحن ووقت التسليم."
              : "Group Egypt's governorates into zones, and set shipping rates + ETAs per zone."}
          </p>
        </div>
        {zones.length > 0 && (
          <Button asChild>
            <Link to="/shipping/zones/new">
              <Plus className="mr-1 h-4 w-4" />
              {ar ? "منطقة جديدة" : "Add zone"}
            </Link>
          </Button>
        )}
      </div>

      <CoverageBanner storeId={storeId} />

      {isLoading && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {ar ? "جارٍ التحميل…" : "Loading…"}
        </div>
      )}

      {!isLoading && zones.length === 0 && (
        <Card>
          <CardHeader className="items-center text-center">
            <Truck className="h-8 w-8 text-muted-foreground" />
            <CardTitle>
              {ar ? "ابدأ بتهيئة مناطق الشحن" : "Set up your shipping zones"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "استخدم الإعداد السريع لتغطية كل مصر بأربع مناطق، أو ابدأ من الصفر."
                : "Use the quick preset to cover all of Egypt in four zones, or start from scratch."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => setConfirmPreset(true)}
              disabled={applyPreset.isPending}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              {ar
                ? "استخدم إعداد 4 مناطق (موصى به)"
                : "Use Egypt 4-zone preset (Recommended)"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/shipping/zones/new">
                {ar ? "ابدأ من الصفر" : "Start blank"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && zones.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? "المنطقة" : "Zone"}</TableHead>
                <TableHead>{ar ? "المحافظات" : "Governorates"}</TableHead>
                <TableHead>{ar ? "الأسعار" : "Rates"}</TableHead>
                <TableHead>{ar ? "الدفع عند الاستلام" : "COD"}</TableHead>
                <TableHead>{ar ? "المدة" : "ETA"}</TableHead>
                <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-end">
                  {ar ? "إجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">
                    {ar && zone.name_ar ? zone.name_ar : zone.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatCoverage(zone.governorate_codes)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {zone.rates.filter((r) => r.is_active).length === 0
                      ? (ar ? "—" : "—")
                      : zone.rates
                          .filter((r) => r.is_active)
                          .map(formatRate)
                          .join(" · ")}
                  </TableCell>
                  <TableCell>
                    {zone.cod_enabled ? (
                      <Badge variant="outline">{ar ? "✓" : "✓"}</Badge>
                    ) : (
                      <Badge variant="outline" className="opacity-60">
                        {ar ? "—" : "—"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {zone.estimated_days_min === zone.estimated_days_max
                      ? `${zone.estimated_days_min} ${ar ? "يوم" : "d"}`
                      : `${zone.estimated_days_min}-${zone.estimated_days_max} ${ar ? "يوم" : "d"}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={zone.is_active ? "default" : "outline"}>
                      {zone.is_active
                        ? ar
                          ? "مفعّلة"
                          : "Active"
                        : ar
                        ? "معطّلة"
                        : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/shipping/zones/${zone.id}`)}
                        aria-label={ar ? "تعديل" : "Edit"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {zone.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(zone.id)}
                          aria-label={ar ? "تعطيل" : "Disable"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Preset confirmation */}
      <Dialog open={confirmPreset} onOpenChange={setConfirmPreset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ar ? "تطبيق إعداد 4 مناطق؟" : "Apply the 4-zone preset?"}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "سيتم إنشاء أربع مناطق (القاهرة الكبرى، الإسكندرية والدلتا، القناة/الصعيد، النائية) وتوزيع الـ27 محافظة عليها بأسعار افتراضية."
                : "This creates 4 zones (Greater Cairo, Alexandria & Delta, Canal/Upper Egypt, Remote) and assigns all 27 governorates with default rates."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPreset(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handlePreset} disabled={applyPreset.isPending}>
              {applyPreset.isPending
                ? ar ? "جارٍ…" : "Applying…"
                : ar ? "تطبيق" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ar ? "تعطيل هذه المنطقة؟" : "Disable this zone?"}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "الطلبات الحالية لن تتأثر. لن يستطيع العملاء اختيار هذه المنطقة في طلبات جديدة."
                : "Existing orders keep their records. Customers won't be able to check out to these governorates for new orders."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteZone.isPending}
            >
              {ar ? "تعطيل" : "Disable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
