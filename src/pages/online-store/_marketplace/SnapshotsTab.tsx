/**
 * SnapshotsTab — Session F (2026-05-29). File 06 §9.
 *
 * The merchant-facing, read-only mirror of the admin snapshot browser.
 * Lists the store's own `store_theme_snapshots` rows (newest first) via
 * the RLS-scoped `GET /stores/{id}/marketplace/snapshots` endpoint added
 * this session. Each row shows:
 *   - reason (localized label, falls back to the raw reason string)
 *   - created date
 *   - from-theme name (the "transition" hint)
 *   - section / section-group counts
 *   - [View JSON]   → dialog with the snapshot record (metadata)
 *   - [Restore]     → DISABLED with tooltip; the rollback endpoint is
 *                     deferred pending explicit authorization (same
 *                     posture as the admin browser in Session C).
 *
 * Snapshots are a free safety net for every merchant — not plan-gated.
 */

import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { History, RotateCcw, Code2, Clock } from "lucide-react";
import { useState } from "react";
import { listSnapshots, type ThemeSnapshot } from "@/services/marketplaceApi";
import { useDashboardStore } from "@/contexts/StoreContext";

export function SnapshotsTab() {
  const { t } = useTranslation();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;
  const [jsonTarget, setJsonTarget] = useState<ThemeSnapshot | null>(null);

  const snapshotsQuery = useQuery({
    queryKey: ["marketplace-snapshots", storeId],
    queryFn: () => listSnapshots(storeId as string),
    enabled: storeId !== null,
    staleTime: 30_000,
  });

  // Localized reason label with a graceful fallback to the raw reason
  // string for any reason the dictionary doesn't cover yet.
  const reasonLabel = (reason: string) =>
    t(`marketplace.snapshots.reasonLabels.${reason}`, { defaultValue: reason });

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  if (snapshotsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (snapshotsQuery.isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("marketplace.snapshots.loadError")}{" "}
          <Button
            variant="link"
            className="px-1"
            onClick={() => snapshotsQuery.refetch()}
          >
            {t("marketplace.snapshots.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const snapshots = snapshotsQuery.data?.snapshots ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("marketplace.snapshots.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("marketplace.snapshots.intro")}
        </p>
      </div>

      {snapshots.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <History className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">{t("marketplace.snapshots.empty")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {t("marketplace.snapshots.emptyHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snap) => (
            <Card key={snap.id} className="transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0 text-muted-foreground">
                    <Clock className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">
                        {reasonLabel(snap.reason)}
                      </h3>
                      {snap.theme_name && (
                        <Badge variant="outline" className="text-[11px] gap-1">
                          {snap.theme_name}
                        </Badge>
                      )}
                      {snap.restored_at && (
                        <Badge className="text-[11px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                          {t("marketplace.snapshots.restoredOn", {
                            date: formatDate(snap.restored_at),
                          })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("marketplace.snapshots.created")}: {formatDate(snap.created_at)}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span>
                        {t("marketplace.snapshots.sections", {
                          count: snap.section_count,
                        })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t("marketplace.snapshots.blocks", {
                          count: snap.section_group_count,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ms-auto shrink-0 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setJsonTarget(snap)}
                    >
                      <Code2 className="h-3.5 w-3.5 me-1.5" />
                      {t("marketplace.snapshots.viewJson")}
                    </Button>
                    {/* Restore deferred — rollback endpoint not authorized
                        yet. Same disabled-with-tooltip posture as the admin
                        browser (Session C). */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button size="sm" variant="ghost" disabled>
                            <RotateCcw className="h-3.5 w-3.5 me-1.5" />
                            {t("marketplace.snapshots.restore")}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t("marketplace.snapshots.restoreSoon")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View-JSON dialog — shows the snapshot record (metadata). The full
          customization payload is not fetched merchant-side; this is the
          structured audit record the list endpoint returns. */}
      <Dialog open={jsonTarget !== null} onOpenChange={(v) => !v && setJsonTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("marketplace.snapshots.jsonTitle")}</DialogTitle>
          </DialogHeader>
          <pre
            className="text-[11px] font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-[60vh]"
            dir="ltr"
          >
            {jsonTarget ? JSON.stringify(jsonTarget, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SnapshotsTab;
