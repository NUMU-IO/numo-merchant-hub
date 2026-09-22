import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getOrderWhatsAppSends,
  resendOrderWhatsApp,
  type OrderWhatsAppSend,
} from "@/services/orderApi";

interface Props {
  storeId: string;
  orderId: string;
}

const DOT: Record<OrderWhatsAppSend["status"], string> = {
  queued: "bg-muted-foreground",
  sent: "bg-sky-500",
  delivered: "bg-emerald-500",
  read: "bg-emerald-500",
  failed: "bg-destructive",
};

export function WhatsAppCard({ storeId, orderId }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const key = ["order-whatsapp", storeId, orderId];

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => getOrderWhatsAppSends(storeId, orderId),
  });

  const resend = useMutation({
    mutationFn: () => resendOrderWhatsApp(storeId, orderId),
    onSuccess: (result) => {
      queryClient.setQueryData(key, { sends: result.sends });
      if (result.sent) toast.success(t("orders.whatsapp.resent"));
      else {
        const failure = result.sends.find((send) => send.status === "failed");
        toast.error(
          failure?.error_code
            ? t(
                [
                  `orders.whatsapp.err.${failure.error_code}`,
                  "orders.whatsapp.err.generic",
                ],
                { code: failure.error_code },
              )
            : t("orders.whatsapp.notSent"),
        );
      }
    },
    onError: () => toast.error(t("orders.whatsapp.notSent")),
  });

  const sends = data?.sends ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("orders.whatsapp.title")}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-3">
        {sends.length === 0 && (
          <p className="text-muted-foreground">{t("orders.whatsapp.none")}</p>
        )}
        {sends.map((send) => (
          <div key={send.message_id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${DOT[send.status]}`} />
              <span className="font-medium">
                {t(`orders.whatsapp.status.${send.status}`)}
              </span>
              <span className="text-muted-foreground truncate">
                {send.template_name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(send.sent_at).toLocaleString(
                i18n.language === "ar" ? "ar-EG" : "en-GB",
              )}
            </p>
            {send.status === "failed" && send.error_code && (
              <p className="text-xs text-destructive">
                {t(
                  [
                    `orders.whatsapp.err.${send.error_code}`,
                    "orders.whatsapp.err.generic",
                  ],
                  { code: send.error_code },
                )}
              </p>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {t("orders.whatsapp.resend")}
        </Button>
      </CardContent>
    </Card>
  );
}
