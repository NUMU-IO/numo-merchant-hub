import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Phone, User } from "lucide-react";
import { getCustomer } from "@/services/customerApi";
import type { Order } from "@/services/orderApi";
import { formatOrderCurrency, initialsFromName } from "./_shared";

interface Props {
  storeId: string;
  order: Order;
}

export function CustomerPanel({ storeId, order }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const customerQuery = useQuery({
    queryKey: ["customer", storeId, order.customer_id],
    queryFn: () => getCustomer(storeId, order.customer_id),
    enabled: !!order.customer_id,
  });

  const customer = customerQuery.data;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          {t("orders.customer")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {customerQuery.isLoading ? (
          <div className="flex items-center justify-center py-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : !customer ? (
          <p className="text-sm text-muted-foreground">
            {language === "ar" ? "بيانات العميل غير متاحة" : "Customer details unavailable"}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                {initialsFromName(customer.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">
                  {customer.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("orders.ordersCountSpent", {
                    count: customer.total_orders,
                    total: formatOrderCurrency(customer.total_spent, language),
                  })}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              {customer.email && (
                <a
                  href={`mailto:${customer.email}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground truncate"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </a>
              )}
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer.phone}</span>
                </a>
              )}
            </div>

            {order.customer_notes && (
              <div className="border-t pt-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {language === "ar" ? "ملاحظات العميل" : "Customer notes"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.customer_notes}
                </p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate(`/customers/${customer.id}`)}
            >
              {t("orders.viewCustomer")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
