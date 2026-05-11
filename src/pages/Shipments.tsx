import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  listShipments, getShipmentStats, getCodSummary, getShipment,
  createShipment, bulkCreateShipments, cancelShipment, requestReturn,
  trackShipment, getAwbUrl, listPickups, createPickup, deletePickup,
  getPickupLocations,
  type ShipmentListItem, type ShipmentStats, type CodSummary,
  type Shipment, type TrackingInfo, type BulkShipmentResult,
} from "@/services/shipmentApi";
import {
  Package, Truck, CheckCircle2, Clock, Loader2, ArrowLeft,
  Plus, FileText, XCircle, RotateCcw, MapPin, CalendarDays,
  ChevronLeft, ChevronRight, CircleDollarSign, PackageCheck,
  ExternalLink, Printer, Search, Upload, Trash2,
} from "lucide-react";

type ShipmentStatus = "all" | "created" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "returned" | "failed";
type MainTab = "shipments" | "cod" | "pickups";

const PAGE_SIZE = 20;

const Shipments = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();
  const isAr = language === "ar";

  // Main tab
  const [mainTab, setMainTab] = useState<MainTab>("shipments");

  // Shipments list state
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus>("all");
  const [page, setPage] = useState(0);

  // Detail panel
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createOrderId, setCreateOrderId] = useState("");
  const [createMethod, setCreateMethod] = useState("standard");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Bulk create dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkOrderIds, setBulkOrderIds] = useState("");
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkShipmentResult | null>(null);

  // Cancel / Return loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Queries ──

  const statsQuery = useQuery({
    queryKey: ["shipment-stats", storeId],
    queryFn: () => getShipmentStats(storeId!),
    enabled: !!storeId,
  });

  const shipmentsQuery = useQuery({
    queryKey: ["shipments", storeId, statusFilter, page],
    queryFn: () =>
      listShipments(storeId!, {
        status: statusFilter === "all" ? undefined : statusFilter,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    enabled: !!storeId,
  });

  const codQuery = useQuery({
    queryKey: ["cod-summary", storeId],
    queryFn: () => getCodSummary(storeId!),
    enabled: !!storeId && mainTab === "cod",
  });

  const pickupsQuery = useQuery({
    queryKey: ["pickups", storeId],
    queryFn: () => listPickups(storeId!) as Promise<Array<Record<string, unknown>>>,
    enabled: !!storeId && mainTab === "pickups",
  });

  // ── Helpers ──

  const stats = statsQuery.data;
  const shipments = shipmentsQuery.data ?? [];
  const codSummary = codQuery.data;
  const pickups = (pickupsQuery.data ?? []) as Array<Record<string, unknown>>;

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(isAr ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const truncateId = (id: string) => id.length > 8 ? `${id.slice(0, 8)}...` : id;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["shipments", storeId] });
    queryClient.invalidateQueries({ queryKey: ["shipment-stats", storeId] });
    queryClient.invalidateQueries({ queryKey: ["cod-summary", storeId] });
  };

  // ── Status badge config ──

  const statusConfig: Record<string, { bg: string; label: string; labelAr: string }> = {
    created:           { bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/60",       label: "Created",          labelAr: "تم الإنشاء" },
    picked_up:         { bg: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200/60", label: "Picked Up",        labelAr: "تم الاستلام" },
    in_transit:        { bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/60", label: "In Transit",       labelAr: "في الطريق" },
    out_for_delivery:  { bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/60", label: "Out for Delivery", labelAr: "خارج للتسليم" },
    delivered:         { bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60", label: "Delivered",     labelAr: "تم التسليم" },
    returned:          { bg: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/60",            label: "Returned",         labelAr: "مرتجع" },
    cancelled:         { bg: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/60",         label: "Cancelled",        labelAr: "ملغي" },
    failed:            { bg: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/60",            label: "Failed",           labelAr: "فشل" },
  };

  const renderStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || { bg: "bg-muted text-muted-foreground", label: status, labelAr: status };
    return (
      <Badge variant="outline" className={`text-[10px] font-medium gap-1.5 rounded-md py-0.5 ${cfg.bg}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${
          status === "delivered" ? "bg-emerald-500" :
          status === "in_transit" || status === "out_for_delivery" ? "bg-orange-500" :
          status === "created" ? "bg-blue-500" :
          status === "picked_up" ? "bg-yellow-500" :
          status === "returned" || status === "failed" ? "bg-red-500" :
          status === "cancelled" ? "bg-zinc-400" : "bg-zinc-400"
        }`} />
        {isAr ? cfg.labelAr : cfg.label}
      </Badge>
    );
  };

  // ── Actions ──

  const openDetail = async (shipmentId: string) => {
    if (!storeId) return;
    setDetailLoading(true);
    setTrackingInfo(null);
    try {
      const s = await getShipment(storeId, shipmentId);
      setSelectedShipment(s);
    } catch (err) {
      showError(err, language);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTrack = async (shipmentId: string) => {
    if (!storeId) return;
    setTrackingLoading(true);
    try {
      const info = await trackShipment(storeId, shipmentId);
      setTrackingInfo(info);
    } catch (err) {
      showError(err, language);
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleCancel = async (shipmentId: string) => {
    if (!storeId) return;
    setActionLoading(shipmentId);
    try {
      const updated = await cancelShipment(storeId, shipmentId);
      toast.success(isAr ? "تم إلغاء الشحنة" : "Shipment cancelled");
      if (selectedShipment?.id === shipmentId) setSelectedShipment(updated);
      invalidateAll();
    } catch (err) {
      showError(err, language);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturn = async (shipmentId: string) => {
    if (!storeId) return;
    setActionLoading(shipmentId);
    try {
      const updated = await requestReturn(storeId, shipmentId);
      toast.success(isAr ? "تم طلب الإرجاع" : "Return requested");
      if (selectedShipment?.id === shipmentId) setSelectedShipment(updated);
      invalidateAll();
    } catch (err) {
      showError(err, language);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreate = async () => {
    if (!storeId || !createOrderId.trim()) return;
    setCreating(true);
    try {
      await createShipment(storeId, {
        order_id: createOrderId.trim(),
        shipping_method: createMethod,
        notes: createNotes.trim() || undefined,
      });
      toast.success(isAr ? "تم إنشاء الشحنة بنجاح" : "Shipment created successfully");
      setCreateOpen(false);
      setCreateOrderId("");
      setCreateNotes("");
      setCreateMethod("standard");
      invalidateAll();
    } catch (err) {
      showError(err, language);
    } finally {
      setCreating(false);
    }
  };

  const handleBulkCreate = async () => {
    if (!storeId || !bulkOrderIds.trim()) return;
    setBulkCreating(true);
    setBulkResult(null);
    try {
      const ids = bulkOrderIds
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        toast.error(isAr ? "أدخل معرفات الطلبات" : "Enter order IDs");
        setBulkCreating(false);
        return;
      }
      const result = await bulkCreateShipments(storeId, ids);
      setBulkResult(result);
      toast.success(
        isAr
          ? `تم إنشاء ${result.succeeded} شحنة من ${result.total}`
          : `Created ${result.succeeded} of ${result.total} shipments`
      );
      invalidateAll();
    } catch (err) {
      showError(err, language);
    } finally {
      setBulkCreating(false);
    }
  };

  const handleDeletePickup = async (pickupId: string) => {
    if (!storeId) return;
    try {
      await deletePickup(storeId, pickupId);
      toast.success(isAr ? "تم حذف موعد الاستلام" : "Pickup deleted");
      queryClient.invalidateQueries({ queryKey: ["pickups", storeId] });
    } catch (err) {
      showError(err, language);
    }
  };

  // ── Loading state ──

  if (statsQuery.isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Detail view ──

  if (selectedShipment) {
    const s = selectedShipment;
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => { setSelectedShipment(null); setTrackingInfo(null); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight">
              {s.tracking_number || truncateId(s.id)}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {s.carrier} · {formatDate(s.created_at)}
            </p>
          </div>
          {renderStatusBadge(s.status)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {s.awb_url && (
            <a href={s.awb_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg">
                <Printer className="h-3.5 w-3.5" />
                {isAr ? "طباعة بوليصة الشحن" : "Print AWB"}
              </Button>
            </a>
          )}
          {!s.awb_url && storeId && (
            <a href={getAwbUrl(storeId, s.id)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg">
                <Printer className="h-3.5 w-3.5" />
                {isAr ? "طباعة بوليصة الشحن" : "Print AWB"}
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 rounded-lg"
            onClick={() => handleTrack(s.id)}
            disabled={trackingLoading}
          >
            {trackingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {isAr ? "تتبع" : "Track"}
          </Button>
          {!["delivered", "cancelled", "returned", "failed"].includes(s.status) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 rounded-lg text-destructive hover:text-destructive"
              onClick={() => handleCancel(s.id)}
              disabled={actionLoading === s.id}
            >
              {actionLoading === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
          )}
          {s.status === "delivered" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 rounded-lg"
              onClick={() => handleReturn(s.id)}
              disabled={actionLoading === s.id}
            >
              {actionLoading === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {isAr ? "طلب إرجاع" : "Request Return"}
            </Button>
          )}
          {s.tracking_url && (
            <a href={s.tracking_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg">
                <ExternalLink className="h-3.5 w-3.5" />
                {isAr ? "تتبع عبر الناقل" : "Carrier Tracking"}
              </Button>
            </a>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Shipment Info */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{isAr ? "تفاصيل الشحنة" : "Shipment Details"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "رقم التتبع" : "Tracking Number"}</p>
                  <p className="font-medium font-mono">{s.tracking_number || "---"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "رقم الطلب" : "Order ID"}</p>
                  <p className="font-medium font-mono">{truncateId(s.order_id)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "الناقل" : "Carrier"}</p>
                  <p className="font-medium">{s.carrier}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "نوع الشحنة" : "Shipment Type"}</p>
                  <p className="font-medium">{s.shipment_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "طريقة الشحن" : "Shipping Method"}</p>
                  <p className="font-medium">{s.shipping_method || "---"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "تكلفة الشحن" : "Shipping Cost"}</p>
                  <p className="font-medium">{formatCurrency(s.shipping_cost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "مبلغ الدفع عند الاستلام" : "COD Amount"}</p>
                  <p className="font-medium">{formatCurrency(s.cod_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "تم تحصيل الدفع" : "COD Collected"}</p>
                  <p className="font-medium">{s.cod_collected ? (isAr ? "نعم" : "Yes") : (isAr ? "لا" : "No")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{isAr ? "محاولات التسليم" : "Delivery Attempts"}</p>
                  <p className="font-medium">{s.delivery_attempts}</p>
                </div>
                {s.shipped_at && (
                  <div>
                    <p className="text-muted-foreground text-xs">{isAr ? "تاريخ الشحن" : "Shipped At"}</p>
                    <p className="font-medium">{formatDateTime(s.shipped_at)}</p>
                  </div>
                )}
                {s.delivered_at && (
                  <div>
                    <p className="text-muted-foreground text-xs">{isAr ? "تاريخ التسليم" : "Delivered At"}</p>
                    <p className="font-medium">{formatDateTime(s.delivered_at)}</p>
                  </div>
                )}
                {s.cancelled_at && (
                  <div>
                    <p className="text-muted-foreground text-xs">{isAr ? "تاريخ الإلغاء" : "Cancelled At"}</p>
                    <p className="font-medium">{formatDateTime(s.cancelled_at)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar: Status Timeline */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{isAr ? "سجل الحالة" : "Status History"}</CardTitle>
              </CardHeader>
              <CardContent>
                {s.status_history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{isAr ? "لا يوجد سجل" : "No history"}</p>
                ) : (
                  <div className="relative space-y-0">
                    {s.status_history.map((entry, i) => (
                      <div key={i} className="flex gap-3 pb-4 last:pb-0">
                        <div className="relative flex flex-col items-center">
                          <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${
                            i === s.status_history.length - 1 ? "bg-primary" : "bg-muted-foreground/30"
                          }`} />
                          {i < s.status_history.length - 1 && (
                            <div className="w-px flex-1 bg-border mt-1" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(entry.to)}
                          </div>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(entry.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Tracking */}
            {trackingInfo && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Truck className="h-4 w-4" />
                    {isAr ? "التتبع المباشر" : "Live Tracking"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 mb-3">
                    <p className="text-xs text-muted-foreground">
                      {isAr ? "الحالة:" : "Status:"} <span className="font-medium text-foreground">{trackingInfo.status}</span>
                    </p>
                    {trackingInfo.estimated_delivery && (
                      <p className="text-xs text-muted-foreground">
                        {isAr ? "التسليم المتوقع:" : "ETA:"} <span className="font-medium text-foreground">{formatDate(trackingInfo.estimated_delivery)}</span>
                      </p>
                    )}
                  </div>
                  {trackingInfo.events.length > 0 && (
                    <div className="space-y-0 border-t pt-3">
                      {trackingInfo.events.map((event, i) => (
                        <div key={i} className="flex gap-3 pb-3 last:pb-0">
                          <div className="relative flex flex-col items-center">
                            <div className={`h-2 w-2 rounded-full mt-1.5 ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                            {i < trackingInfo.events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium">{event.description}</p>
                            {event.location && <p className="text-[10px] text-muted-foreground">{event.location}</p>}
                            <p className="text-[10px] text-muted-foreground">{formatDateTime(event.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5" />
            {isAr ? "الشحنات" : "Shipments"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {isAr ? "إدارة شحنات Bosta وتتبعها" : "Manage and track your Bosta shipments"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            {isAr ? "إنشاء مجمع" : "Bulk Create"}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {isAr ? "إنشاء شحنة" : "Create Shipment"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{isAr ? "إجمالي الشحنات" : "Total Shipments"}</p>
                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{isAr ? "في الطريق" : "In Transit"}</p>
                <p className="text-2xl font-bold">{(stats?.by_status?.in_transit ?? 0) + (stats?.by_status?.out_for_delivery ?? 0)}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-orange-500/10 text-orange-600">
                <Truck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{isAr ? "تم التسليم" : "Delivered"}</p>
                <p className="text-2xl font-bold">{stats?.by_status?.delivered ?? 0}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{isAr ? "دفع عند الاستلام معلق" : "COD Pending"}</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.cod_pending ?? 0)}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-amber-500/10 text-amber-600">
                <CircleDollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
        <TabsList className="h-9 p-0.5 bg-muted/60">
          <TabsTrigger value="shipments" className="text-xs h-8 rounded-md px-3 gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {isAr ? "الشحنات" : "Shipments"}
          </TabsTrigger>
          <TabsTrigger value="cod" className="text-xs h-8 rounded-md px-3 gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5" />
            {isAr ? "الدفع عند الاستلام" : "COD"}
          </TabsTrigger>
          <TabsTrigger value="pickups" className="text-xs h-8 rounded-md px-3 gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {isAr ? "مواعيد الاستلام" : "Pickups"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab: Shipments */}
      {mainTab === "shipments" && (
        <Card>
          <CardHeader className="pb-3">
            <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v as ShipmentStatus); setPage(0); }}>
              <TabsList className="h-9 p-0.5 bg-muted/60 flex-wrap">
                <TabsTrigger value="all" className="text-xs h-8 rounded-md px-3">{isAr ? "الكل" : "All"}</TabsTrigger>
                <TabsTrigger value="created" className="text-xs h-8 rounded-md px-3">{isAr ? "تم الإنشاء" : "Created"}</TabsTrigger>
                <TabsTrigger value="picked_up" className="text-xs h-8 rounded-md px-3">{isAr ? "تم الاستلام" : "Picked Up"}</TabsTrigger>
                <TabsTrigger value="in_transit" className="text-xs h-8 rounded-md px-3">{isAr ? "في الطريق" : "In Transit"}</TabsTrigger>
                <TabsTrigger value="delivered" className="text-xs h-8 rounded-md px-3">{isAr ? "تم التسليم" : "Delivered"}</TabsTrigger>
                <TabsTrigger value="returned" className="text-xs h-8 rounded-md px-3">{isAr ? "مرتجع" : "Returned"}</TabsTrigger>
                <TabsTrigger value="failed" className="text-xs h-8 rounded-md px-3">{isAr ? "فشل" : "Failed"}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {shipmentsQuery.isLoading && shipments.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : shipments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Package className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {isAr ? "لا توجد شحنات" : "No shipments found"}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-y border-border/40">
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 ps-5">{isAr ? "رقم التتبع" : "Tracking #"}</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "رقم الطلب" : "Order ID"}</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "الحالة" : "Status"}</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "النوع" : "Type"}</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "الدفع عند الاستلام" : "COD Amount"}</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "الناقل" : "Carrier"}</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "تاريخ الإنشاء" : "Created At"}</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 w-28">{isAr ? "إجراءات" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((sh) => (
                      <TableRow
                        key={sh.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openDetail(sh.id)}
                      >
                        <TableCell className="font-mono text-[13px] ps-5 tabular-nums">
                          {sh.tracking_number || "---"}
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-muted-foreground tabular-nums">
                          {truncateId(sh.order_id)}
                        </TableCell>
                        <TableCell>{renderStatusBadge(sh.status)}</TableCell>
                        <TableCell className="text-[13px]">
                          <Badge variant="secondary" className="text-[10px] font-normal">{sh.shipment_type}</Badge>
                        </TableCell>
                        <TableCell className="text-[13px] font-medium tabular-nums">
                          {sh.cod_amount > 0 ? formatCurrency(sh.cod_amount) : "---"}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">{sh.carrier}</TableCell>
                        <TableCell className="text-[13px] text-muted-foreground tabular-nums">
                          {formatDate(sh.created_at)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={isAr ? "تتبع" : "Track"}
                              onClick={() => { openDetail(sh.id); }}
                            >
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                            {storeId && (
                              <a
                                href={sh.tracking_number ? (getAwbUrl(storeId, sh.id)) : "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => { if (!sh.tracking_number) e.preventDefault(); }}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title={isAr ? "بوليصة الشحن" : "AWB"}
                                  disabled={!sh.tracking_number}
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            )}
                            {!["delivered", "cancelled", "returned", "failed"].includes(sh.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title={isAr ? "إلغاء" : "Cancel"}
                                onClick={() => handleCancel(sh.id)}
                                disabled={actionLoading === sh.id}
                              >
                                {actionLoading === sh.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {isAr
                      ? `عرض ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + shipments.length}`
                      : `Showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + shipments.length}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      disabled={page <= 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      disabled={shipments.length < PAGE_SIZE}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: COD */}
      {mainTab === "cod" && (
        <div className="space-y-4">
          {codQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : codSummary ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{isAr ? "إجمالي المتوقع" : "Total Expected"}</p>
                      <p className="text-2xl font-bold">{formatCurrency(codSummary.total_expected)}</p>
                      <p className="text-xs text-muted-foreground">{codSummary.total_shipments} {isAr ? "شحنة" : "shipments"}</p>
                    </div>
                    <div className="rounded-lg p-2.5 bg-primary/10 text-primary">
                      <CircleDollarSign className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{isAr ? "إجمالي المحصل" : "Total Collected"}</p>
                      <p className="text-2xl font-bold">{formatCurrency(codSummary.total_collected)}</p>
                      <p className="text-xs text-muted-foreground">{codSummary.collected_count} {isAr ? "شحنة" : "shipments"}</p>
                    </div>
                    <div className="rounded-lg p-2.5 bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{isAr ? "إجمالي المعلق" : "Total Pending"}</p>
                      <p className="text-2xl font-bold">{formatCurrency(codSummary.total_pending)}</p>
                    </div>
                    <div className="rounded-lg p-2.5 bg-amber-500/10 text-amber-600">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{isAr ? "تم التسليم بدون تحصيل" : "Delivered Not Collected"}</p>
                      <p className="text-2xl font-bold">{codSummary.delivered_not_collected}</p>
                      <p className="text-xs text-muted-foreground">{isAr ? "شحنة تحتاج متابعة" : "need follow-up"}</p>
                    </div>
                    <div className="rounded-lg p-2.5 bg-destructive/10 text-destructive">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12">
              <CircleDollarSign className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {isAr ? "لا توجد بيانات الدفع عند الاستلام" : "No COD data available"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Pickups */}
      {mainTab === "pickups" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{isAr ? "مواعيد الاستلام" : "Scheduled Pickups"}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {pickupsQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pickups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {isAr ? "لا توجد مواعيد استلام مجدولة" : "No scheduled pickups"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-y border-border/40">
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 ps-5">{isAr ? "المعرف" : "ID"}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "التاريخ المجدول" : "Scheduled Date"}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "الموقع" : "Location"}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickups.map((p, i) => (
                    <TableRow key={String(p.id || i)}>
                      <TableCell className="font-mono text-[13px] ps-5">{String(p.id || "---")}</TableCell>
                      <TableCell className="text-[13px] tabular-nums">
                        {p.scheduled_date ? formatDate(String(p.scheduled_date)) : "---"}
                      </TableCell>
                      <TableCell className="text-[13px]">
                        <Badge variant="secondary" className="text-[10px]">{String(p.status || "---")}</Badge>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {String(p.business_location_id || p.location || "---")}
                      </TableCell>
                      <TableCell>
                        {p.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeletePickup(String(p.id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Shipment Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? "إنشاء شحنة" : "Create Shipment"}</DialogTitle>
            <DialogDescription>
              {isAr ? "أنشئ شحنة جديدة لطلب موجود" : "Create a new shipment for an existing order"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{isAr ? "معرف الطلب" : "Order ID"}</label>
              <Input
                placeholder={isAr ? "أدخل معرف الطلب (UUID)" : "Enter order UUID"}
                value={createOrderId}
                onChange={(e) => setCreateOrderId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{isAr ? "طريقة الشحن" : "Shipping Method"}</label>
              <Select value={createMethod} onValueChange={setCreateMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{isAr ? "عادي" : "Standard"}</SelectItem>
                  <SelectItem value="express">{isAr ? "سريع" : "Express"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{isAr ? "ملاحظات" : "Notes"}</label>
              <Textarea
                placeholder={isAr ? "ملاحظات اختيارية..." : "Optional notes..."}
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !createOrderId.trim()} className="gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {isAr ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) setBulkResult(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isAr ? "إنشاء شحنات مجمعة" : "Bulk Create Shipments"}</DialogTitle>
            <DialogDescription>
              {isAr ? "أدخل معرفات الطلبات مفصولة بفواصل أو أسطر جديدة" : "Enter order IDs separated by commas or new lines"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={isAr ? "معرف-طلب-1, معرف-طلب-2, ..." : "order-id-1, order-id-2, ..."}
              value={bulkOrderIds}
              onChange={(e) => setBulkOrderIds(e.target.value)}
              rows={5}
              className="font-mono text-sm"
            />

            {bulkResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                    {bulkResult.succeeded} {isAr ? "نجح" : "succeeded"}
                  </Badge>
                  {bulkResult.failed > 0 && (
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                      {bulkResult.failed} {isAr ? "فشل" : "failed"}
                    </Badge>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{isAr ? "الطلب" : "Order"}</TableHead>
                        <TableHead className="text-xs">{isAr ? "الحالة" : "Status"}</TableHead>
                        <TableHead className="text-xs">{isAr ? "التفاصيل" : "Details"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkResult.results.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{truncateId(r.order_id)}</TableCell>
                          <TableCell>
                            {r.success ? (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" />{isAr ? "نجح" : "OK"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] bg-destructive/10 text-destructive gap-1">
                                <XCircle className="h-2.5 w-2.5" />{isAr ? "فشل" : "Failed"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.success ? (r.tracking_number || "---") : (r.error || "---")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkOpen(false); setBulkResult(null); }}>
              {bulkResult ? (isAr ? "إغلاق" : "Close") : (isAr ? "إلغاء" : "Cancel")}
            </Button>
            {!bulkResult && (
              <Button onClick={handleBulkCreate} disabled={bulkCreating || !bulkOrderIds.trim()} className="gap-1.5">
                {bulkCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {isAr ? "إنشاء مجمع" : "Bulk Create"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail loading overlay */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};

export default Shipments;
