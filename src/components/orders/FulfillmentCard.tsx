import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, Printer, Truck } from "lucide-react";
import { toast } from "sonner";
import { updateOrder, type Order } from "@/services/orderApi";
import { listShipments } from "@/services/shipmentApi";
import { showError } from "@/lib/show-error";

interface Props {
  storeId: string;
  order: Order;
  onUpdateStatus: (status: string) => void;
}

export function FulfillmentCard({ storeId, order, onUpdateStatus }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [trackingInput, setTrackingInput] = useState("");

  const saveTracking = useMutation({
    mutationFn: (tracking_number: string) =>
      updateOrder(storeId, order.id, { tracking_number }),
    onSuccess: () => {
      toast.success(
        language === "ar" ? "تم حفظ رقم التتبع" : "Tracking number saved",
      );
      setTrackingInput("");
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    },
    onError: (err) => showError(err, language),
  });

  // Fetch shipments for this order so we can surface the carrier label
  // (AWB PDF) when one exists. Only runs when the order has a tracking
  // number — without one, there's nothing useful to show anyway.
  const shipmentsQuery = useQuery({
    queryKey: ["order-shipments", storeId, order.id],
    queryFn: () => listShipments(storeId, { order_id: order.id, limit: 5 }),
    enabled: !!order.tracking_number,
  });
  const labelShipment = (shipmentsQuery.data ?? []).find((s) => s.awb_url);

  const handlePrintLabel = () => {
    if (!labelShipment) return;
    window.open(
      `/api/v1/stores/${storeId}/shipments/${labelShipment.id}/awb`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {language === "ar" ? "الشحن والتتبع" : "Shipping & Tracking"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {order.shipping_method && (
          <p className="text-sm text-muted-foreground">
            {order.shipping_method}
          </p>
        )}
        {order.tracking_number ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {language === "ar" ? "رقم التتبع" : "Tracking Number"}
            </p>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40">
              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono font-medium flex-1">
                {order.tracking_number}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => {
                  navigator.clipboard.writeText(order.tracking_number!);
                  toast.success(language === "ar" ? "تم النسخ" : "Copied");
                }}
              >
                {language === "ar" ? "نسخ" : "Copy"}
              </Button>
            </div>
            {order.tracking_url && (
              <a
                href={order.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {language === "ar" ? "تتبع الشحنة ←" : "Track shipment →"}
              </a>
            )}
            {labelShipment && (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] gap-1"
                  onClick={handlePrintLabel}
                >
                  <Printer className="h-3 w-3" />
                  {t("shippingLabels.printLabel")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] gap-1"
                  asChild
                >
                  <a
                    href={labelShipment.awb_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3 w-3" />
                    {t("shippingLabels.download")}
                  </a>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {language === "ar" ? "إضافة رقم تتبع" : "Add Tracking Number"}
            </p>
            <div className="flex gap-2">
              <Input
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder={
                  language === "ar"
                    ? "مثلاً: EG123456789"
                    : "e.g. EG123456789"
                }
                className="h-9 text-sm rounded-lg flex-1"
              />
              <Button
                size="sm"
                className="h-9 rounded-lg gap-1.5"
                disabled={!trackingInput.trim() || saveTracking.isPending}
                onClick={() => saveTracking.mutate(trackingInput.trim())}
              >
                {saveTracking.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Truck className="h-3.5 w-3.5" />
                )}
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {language === "ar"
                ? "أضف رقم التتبع قبل تحديث الحالة لشحن"
                : "Add tracking before marking as shipped"}
            </p>
          </div>
        )}

        <div className="border-t pt-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {t("orders.updateStatus")}
          </p>
          <Select value={order.status} onValueChange={onUpdateStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "pending",
                  "processing",
                  "shipped",
                  "delivered",
                  "cancelled",
                ] as const
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`orders.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
