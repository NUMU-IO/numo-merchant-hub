import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  listConnections,
  startOAuth,
  disconnectChannel,
  syncHistory,
  type ChannelConnectionDTO,
} from "@/services/channelsApi";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Facebook,
  Instagram,
  MessageCircle,
  Loader2,
  Plus,
  History,
  Unplug,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

type Channel = ChannelConnectionDTO["channel"];

const channelMeta: Record<
  Channel,
  { Icon: typeof Facebook; tint: string; ring: string }
> = {
  facebook: { Icon: Facebook, tint: "bg-[#1877F2]", ring: "ring-[#1877F2]/20" },
  instagram: {
    Icon: Instagram,
    tint: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
    ring: "ring-[#DD2A7B]/20",
  },
  whatsapp: { Icon: MessageCircle, tint: "bg-[#25D366]", ring: "ring-[#25D366]/20" },
};

export const Channels = () => {
  const { t } = useTranslation();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id;
  const [pendingDisconnect, setPendingDisconnect] =
    useState<ChannelConnectionDTO | null>(null);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["channels", storeId],
    queryFn: () => listConnections(storeId!),
    enabled: !!storeId,
  });

  // The OAuth popup posts back when the merchant finishes choosing assets.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === "meta-connected") {
        queryClient.invalidateQueries({ queryKey: ["channels", storeId] });
        toast.success(t("omnichannel.connected_toast"));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [queryClient, storeId, t]);

  const connectMutation = useMutation({
    mutationFn: () => startOAuth(storeId!),
    onSuccess: (data) => {
      const width = 620;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.authorization_url,
        "meta_oauth",
        `width=${width},height=${height},left=${left},top=${top}`,
      );
    },
    onError: () => toast.error(t("omnichannel.connect_failed")),
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) => disconnectChannel(storeId!, connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", storeId] });
      toast.success(t("omnichannel.disconnected_toast"));
    },
    onError: () => toast.error(t("omnichannel.disconnect_failed")),
  });

  const syncMutation = useMutation({
    mutationFn: (connectionId: string) => syncHistory(storeId!, connectionId),
    onSuccess: () => toast.success(t("omnichannel.sync_started")),
    onError: () => toast.error(t("omnichannel.sync_failed")),
  });

  if (!storeId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t("omnichannel.channels")}
        </h1>
        <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
      </div>
    );
  }

  const metaConnections = connections.filter((c) => c.channel !== "whatsapp");
  const whatsapp = connections.find((c) => c.channel === "whatsapp");

  const statusBadge = (conn: ChannelConnectionDTO) => {
    if (conn.status === "active") {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1">
          <ShieldCheck className="h-3 w-3" />
          {t("omnichannel.connection_active")}
        </Badge>
      );
    }
    const label =
      conn.status === "expired"
        ? t("omnichannel.connection_expired")
        : conn.status === "revoked"
          ? t("omnichannel.connection_revoked")
          : t("omnichannel.connection_error");
    return (
      <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-100">
        <AlertTriangle className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {t("omnichannel.channels")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-prose">
            {t("omnichannel.channels_subtitle")}
          </p>
        </div>
        <Button
          onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending}
        >
          {connectMutation.isPending ? (
            <Loader2 className="h-4 w-4 me-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 me-2" />
          )}
          {metaConnections.length > 0
            ? t("omnichannel.connect_more")
            : t("omnichannel.connect_meta")}
        </Button>
      </header>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("omnichannel.meta_accounts")}
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : metaConnections.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <div className="mx-auto h-11 w-11 rounded-full bg-muted grid place-items-center">
              <Facebook className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-3 font-medium">{t("omnichannel.no_accounts_title")}</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {t("omnichannel.no_accounts_hint")}
            </p>
            <Button className="mt-4" onClick={() => connectMutation.mutate()}>
              {t("omnichannel.connect_meta")}
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {metaConnections.map((conn) => {
              const { Icon, tint, ring } = channelMeta[conn.channel];
              return (
                <li
                  key={conn.id}
                  className="flex flex-wrap items-center gap-4 p-4"
                >
                  <span
                    className={`h-10 w-10 shrink-0 rounded-full grid place-items-center ring-4 ${tint} ${ring}`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">
                        {conn.external_account_name || conn.external_account_id}
                      </p>
                      {statusBadge(conn)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(`omnichannel.channel_${conn.channel}`)}
                      {conn.webhook_subscribed_at
                        ? ` · ${t("omnichannel.receiving_messages")}`
                        : ""}
                    </p>
                    {conn.last_error && (
                      <p className="text-xs text-destructive mt-1">{conn.last_error}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ms-auto">
                    {conn.status !== "active" ? (
                      <Button size="sm" onClick={() => connectMutation.mutate()}>
                        {t("omnichannel.reconnect")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncMutation.mutate(conn.id)}
                        disabled={syncMutation.isPending}
                      >
                        <History className="h-4 w-4 me-1" />
                        {t("omnichannel.sync_history")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setPendingDisconnect(conn)}
                    >
                      <Unplug className="h-4 w-4 me-1" />
                      {t("omnichannel.disconnect")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("omnichannel.channel_whatsapp")}
        </h2>
        <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-4">
          <span className="h-10 w-10 shrink-0 rounded-full grid place-items-center ring-4 bg-[#25D366] ring-[#25D366]/20">
            <MessageCircle className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            {whatsapp ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">
                    {whatsapp.external_account_name}
                  </p>
                  {statusBadge(whatsapp)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("omnichannel.channel_whatsapp")}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">{t("omnichannel.channel_whatsapp")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("omnichannel.whatsapp_hint")}
                </p>
              </>
            )}
          </div>
          {whatsapp ? (
            <Button
              variant="ghost"
              size="sm"
              className="ms-auto text-muted-foreground"
              onClick={() => setPendingDisconnect(whatsapp)}
            >
              <Unplug className="h-4 w-4 me-1" />
              {t("omnichannel.disconnect")}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="ms-auto"
              onClick={() => connectMutation.mutate()}
            >
              {t("omnichannel.connect_whatsapp")}
            </Button>
          )}
        </div>
      </section>

      <AlertDialog
        open={!!pendingDisconnect}
        onOpenChange={(open) => !open && setPendingDisconnect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("omnichannel.disconnect_title", {
                name:
                  pendingDisconnect?.external_account_name ??
                  pendingDisconnect?.external_account_id ??
                  "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("omnichannel.disconnect_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDisconnect) {
                  disconnectMutation.mutate(pendingDisconnect.id);
                  setPendingDisconnect(null);
                }
              }}
            >
              {t("omnichannel.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Channels;
