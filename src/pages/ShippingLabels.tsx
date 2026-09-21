import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Download,
  ExternalLink,
  Loader2,
  Printer,
  Tag,
} from "lucide-react";
import {
  getAwbUrl,
  listShipments,
  type ShipmentListItem,
} from "@/services/shipmentApi";
import { carrierName, listCarriers } from "@/services/carrierApi";

type LabelFilter = "all" | "with" | "without";

const ShippingLabels = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const navigate = useNavigate();
  const isAr = language === "ar";

  const [filter, setFilter] = useState<LabelFilter>("with");

  const shipmentsQuery = useQuery({
    queryKey: ["shipments", storeId, "labels", filter],
    queryFn: () =>
      listShipments(storeId!, {
        limit: 100,
        has_label:
          filter === "with" ? true : filter === "without" ? false : undefined,
      }),
    enabled: !!storeId,
  });

  const carriersQuery = useQuery({
    queryKey: ["carriers", storeId],
    queryFn: () => listCarriers(storeId!),
    enabled: !!storeId,
  });

  const shipments = shipmentsQuery.data ?? [];
  const carriers = carriersQuery.data ?? [];

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US");
  };

  const carrierLabel = (slug: string) => {
    const carrier = carriers.find((c) => c.slug === slug.toLowerCase());
    return carrier ? carrierName(carrier, isAr) : slug;
  };

  // Carriers like J&T print on demand through /awb and never store a URL.
  const canPrint = (s: ShipmentListItem) =>
    !!s.awb_url ||
    carriers.some((c) => c.slug === s.carrier && c.capabilities.supports_labels);

  // Print AWB → open the backend's print endpoint in a new tab. The endpoint
  // returns the PDF inline (Content-Disposition: inline), so the browser
  // renders it and the user hits Cmd/Ctrl-P to print.
  const handlePrint = (s: ShipmentListItem) => {
    if (!storeId) return;
    window.open(
      `/api/v1/stores/${storeId}/shipments/${s.id}/awb`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t("shippingLabels.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("shippingLabels.subtitle")}
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as LabelFilter)}>
        <TabsList>
          <TabsTrigger value="with">{t("shippingLabels.withLabels")}</TabsTrigger>
          <TabsTrigger value="without">
            {t("shippingLabels.withoutLabels")}
          </TabsTrigger>
          <TabsTrigger value="all">{t("shippingLabels.allShipments")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {shipmentsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shipments.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tag}
            title={t("shippingLabels.emptyTitle")}
            description={t(
              filter === "with"
                ? "shippingLabels.emptyWithDescription"
                : filter === "without"
                  ? "shippingLabels.emptyWithoutDescription"
                  : "shippingLabels.emptyAllDescription",
            )}
            action={
              <Button size="sm" onClick={() => navigate("/orders")}>
                {t("shippingLabels.goToOrders")}
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "رقم التتبع" : "Tracking"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "شركة الشحن" : "Carrier"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "الحالة" : "Status"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "تاريخ الإنشاء" : "Created"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s) => (
                  <TableRow key={s.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.tracking_number && s.tracking_url ? (
                          <a
                            href={s.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs font-medium underline-offset-2 hover:underline"
                            title={isAr ? "تتبّع عند شركة الشحن" : "Track on the carrier's site"}
                          >
                            {s.tracking_number}
                          </a>
                        ) : s.tracking_number ? (
                          <span className="font-mono text-xs font-medium">
                            {s.tracking_number}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {isAr ? "بدون رقم تتبع" : "No tracking #"}
                          </span>
                        )}
                        {s.shipment_type === "return" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 bg-orange-500/10 text-orange-600 border-orange-200/50"
                          >
                            {isAr ? "مرتجع" : "Return"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {carrierLabel(s.carrier)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium rounded-md py-0.5"
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(s.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {storeId && canPrint(s) ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1"
                              onClick={() => handlePrint(s)}
                            >
                              <Printer className="h-3 w-3" />
                              {t("shippingLabels.print")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px] gap-1"
                              asChild
                            >
                              <a
                                href={s.awb_url || getAwbUrl(storeId, s.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-3 w-3" />
                                {t("shippingLabels.download")}
                              </a>
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            {isAr ? "لا توجد بطاقة" : "No label"}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => navigate(`/orders/${s.order_id}`)}
                          aria-label={t("shippingLabels.viewOrder")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ShippingLabels;
