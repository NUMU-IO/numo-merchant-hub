import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRightCircle,
  PackageOpen,
  Printer,
  RotateCcw,
} from "lucide-react";
import type { Order } from "@/services/orderApi";
import { ORDER_STATUS_COLORS, getNextFulfillmentStatus } from "./_shared";

interface Props {
  order: Order;
  onAdvanceStatus: (next: string) => void;
  onMarkReturned: () => void;
  onPartialAcceptance?: () => void;
  onPrint: () => void;
}

export function OrderHeader({
  order,
  onAdvanceStatus,
  onMarkReturned,
  onPartialAcceptance,
  onPrint,
}: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const nextStatus = getNextFulfillmentStatus(order.status);

  return (
    <>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => navigate("/orders")}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("orders.back")}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onPrint}
          >
            <Printer className="h-3.5 w-3.5" />
            {t("orders.print")}
          </Button>
          {nextStatus && order.status !== "cancelled" && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => onAdvanceStatus(nextStatus)}
            >
              <ArrowRightCircle className="h-3.5 w-3.5" />
              {t("orders.moveTo")} {t(`orders.${nextStatus}`)}
            </Button>
          )}
          {onPartialAcceptance &&
            (order.status === "shipped" || order.status === "delivered") &&
            !order.partial_acceptance && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={onPartialAcceptance}
              >
                <PackageOpen className="h-3.5 w-3.5" />
                {t("orders.partial.action")}
              </Button>
            )}
          {order.status === "shipped" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onMarkReturned}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {language === "ar" ? "تحديد كمرتجع" : "Mark as Returned"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          {t("orders.orderDetails")} {order.order_number}
        </h1>
        <Badge
          variant="secondary"
          className={ORDER_STATUS_COLORS[order.status] || ""}
        >
          {t(`orders.${order.status}`)}
        </Badge>
      </div>
    </>
  );
}
