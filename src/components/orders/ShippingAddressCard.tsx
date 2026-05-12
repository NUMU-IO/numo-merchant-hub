import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Order } from "@/services/orderApi";

interface Props {
  order: Order;
}

export function ShippingAddressCard({ order }: Props) {
  const { t } = useTranslation();
  const address = order.shipping_address;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("orders.shippingAddress")}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <p className="font-medium">{address.full_name}</p>
        <p className="text-muted-foreground">{address.address_line1}</p>
        {address.address_line2 && (
          <p className="text-muted-foreground">{address.address_line2}</p>
        )}
        <p className="text-muted-foreground">
          {address.city}
          {address.state ? `, ${address.state}` : ""}
        </p>
        {address.phone && (
          <p className="text-muted-foreground">{address.phone}</p>
        )}
      </CardContent>
    </Card>
  );
}
