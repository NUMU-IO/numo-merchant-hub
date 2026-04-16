import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { listConnections, startOAuth, disconnectChannel, type ChannelConnectionDTO } from "@/services/channelsApi";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Facebook, Instagram, MessageCircle, Loader2, RefreshCw, Unplug } from "lucide-react";

const channelIcons = {
  facebook: Facebook,
  instagram: Instagram,
  whatsapp: MessageCircle,
};

const channelColors = {
  facebook: "text-blue-600",
  instagram: "text-pink-600",
  whatsapp: "text-green-600",
};

const statusColors = {
  active: "bg-green-500",
  expired: "bg-yellow-500",
  revoked: "bg-red-500",
  error: "bg-red-500",
};

export const Channels = () => {
  const { t } = useTranslation();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id;
  const [connectingChannel, setConnectingChannel] = useState<string | null>(null);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["channels", storeId],
    queryFn: () => listConnections(storeId!),
    enabled: !!storeId,
  });

  const connectMutation = useMutation({
    mutationFn: () => startOAuth(storeId!),
    onSuccess: (data) => {
      setConnectingChannel(null);
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.authorization_url,
        "meta_oauth",
        `width=${width},height=${height},left=${left},top=${top}`
      );
    },
    onError: () => {
      setConnectingChannel(null);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) => disconnectChannel(storeId!, connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", storeId] });
    },
  });

  if (!storeId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("omnichannel.channels")}</h1>
        <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
      </div>
    );
  }

  const channels: Array<{ key: "facebook" | "instagram" | "whatsapp"; label: string }> = [
    { key: "facebook", label: t("omnichannel.channel_facebook") },
    { key: "instagram", label: t("omnichannel.channel_instagram") },
    { key: "whatsapp", label: t("omnichannel.channel_whatsapp") },
  ];

  const getConnection = (channel: string) =>
    connections.find((c) => c.channel === channel);

  const handleConnect = (channel: string) => {
    setConnectingChannel(channel);
    connectMutation.mutate();
  };

  const handleDisconnect = (connectionId: string) => {
    if (confirm(t("omnichannel.disconnect") + "?")) {
      disconnectMutation.mutate(connectionId);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("omnichannel.channels")}</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {channels.map(({ key, label }) => {
            const conn = getConnection(key);
            const Icon = channelIcons[key];
            return (
              <Card key={key} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-6 w-6 ${channelColors[key]}`} />
                      <CardTitle className="text-lg">{label}</CardTitle>
                    </div>
                    {conn && (
                      <Badge
                        variant="secondary"
                        className={`${statusColors[conn.status]} text-white`}
                      >
                        {conn.status === "active"
                          ? t("omnichannel.connection_active")
                          : conn.status === "expired"
                          ? t("omnichannel.connection_expired")
                          : conn.status === "revoked"
                          ? t("omnichannel.disconnect")
                          : t("omnichannel.connection_error")}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {conn ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{conn.external_account_name}</p>
                        {conn.last_error && (
                          <p className="text-sm text-red-500 mt-1">{conn.last_error}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(conn.id)}
                          disabled={disconnectMutation.isPending}
                        >
                          <Unplug className="h-4 w-4 mr-1" />
                          {t("omnichannel.disconnect")}
                        </Button>
                        {conn.status === "expired" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConnect(key)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            {t("omnichannel.refresh_token")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleConnect(key)}
                      disabled={connectingChannel !== null}
                      className="w-full"
                    >
                      {connectingChannel === key ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : key === "whatsapp" ? (
                        t("omnichannel.connect_whatsapp")
                      ) : (
                        t("omnichannel.connect_meta")
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Channels;