/**
 * Event Match Quality card — the measurement loop, surfaced.
 *
 * Until this shipped, NUMU could not report EMQ for any store: the service
 * returned a hardcoded empty list, no snapshot table existed, and the poll
 * task had no caller. Merchants had to leave for Meta Events Manager to learn
 * whether their conversions were matchable — and the platform had no way to
 * tell whether a tracking change had helped.
 *
 * Two deliberate choices:
 *
 * 1. **Per-key coverage is shown, not just the score.** A composite of 6.1
 *    tells a merchant nothing actionable; "email 0%, phone 0%, browser ID
 *    100%" tells them exactly what is missing. The score is capped by which
 *    keys are present, not by how well the present ones perform.
 * 2. **Meta's diagnostics are rendered verbatim.** Each one names the problem
 *    AND states the fix, in Meta's own words. Paraphrasing them into our copy
 *    would add a translation layer that can only lose fidelity.
 */

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Info } from "lucide-react";

import { useTranslation } from "react-i18next";
import {
  fetchMetaMatchQuality,
  type MetaMatchQualityEvent,
} from "@/services/metaTrackingApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Meta's match-key names → something a merchant can act on. */
const MATCH_KEY_LABELS: Record<string, string> = {
  em: "Email",
  ph: "Phone",
  fn: "First name",
  ln: "Last name",
  ct: "City",
  st: "State / governorate",
  zp: "Postal code",
  country: "Country",
  external_id: "Customer / session ID",
  fbp: "Browser ID (_fbp)",
  fbc: "Click ID (_fbc)",
  ip_address: "IP address",
  user_agent: "Browser",
  lead_id: "Lead ID",
  fb_login_id: "Facebook Login ID",
};

function scoreTone(score: number, threshold: number) {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (score >= threshold) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function EventRow({
  event,
  threshold,
}: {
  event: MetaMatchQualityEvent;
  threshold: number;
}) {
  // Worst-covered keys first: the top of this list is the work to do.
  const keys = [...event.match_keys].sort(
    (a, b) => a.coverage_percentage - b.coverage_percentage,
  );

  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{event.event_name}</span>
          <span className="text-xs text-muted-foreground">
            {event.total_events.toLocaleString()} events
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-2xl font-semibold tabular-nums",
              scoreTone(event.emq_score, threshold),
            )}
          >
            {event.emq_score.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">/ 10</span>
        </div>
      </div>

      {event.event_coverage != null && (
        <p className="mt-1 text-xs text-muted-foreground">
          {event.event_coverage.toFixed(0)}% of browser events also arrived
          server-side
        </p>
      )}

      {keys.length > 0 && (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {keys.map((k) => (
            <div key={k.identifier} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">
                {MATCH_KEY_LABELS[k.identifier] ?? k.identifier}
              </span>
              <Progress value={k.coverage_percentage} className="h-1.5" />
              <span className="w-10 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                {k.coverage_percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {event.diagnostics.length > 0 && (
        <div className="mt-3 space-y-2">
          {event.diagnostics.map((d, i) => (
            <div
              key={`${d.name ?? "diag"}-${i}`}
              className="flex gap-2 rounded-md bg-muted/50 p-2.5 text-xs"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div className="space-y-1">
                {d.description && <p>{d.description}</p>}
                {d.solution && (
                  <p className="text-muted-foreground">{d.solution}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MetaMatchQualityCard({ storeId }: { storeId?: string }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["meta-match-quality", storeId],
    queryFn: () => fetchMetaMatchQuality(storeId!),
    enabled: !!storeId,
    retry: 1,
    // Written by a 6-hourly beat task — refetching more often than that only
    // re-reads the same rows.
    staleTime: 30 * 60_000,
  });

  const data = query.data;
  const threshold = data?.low_score_threshold ?? 6.5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          {t("meta.matchQuality.title", "Event Match Quality")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading && <Skeleton className="h-24 w-full" />}

        {!query.isLoading && (!data || data.events.length === 0) && (
          <div className="flex gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t(
                "meta.matchQuality.empty",
                "No match-quality data yet. Scores are collected from Meta a few times a day once your pixel is receiving events.",
              )}
            </p>
          </div>
        )}

        {data?.events.map((event) => (
          <EventRow
            key={`${event.pixel_id}-${event.event_name}`}
            event={event}
            threshold={threshold}
          />
        ))}

        {data?.last_polled_at && (
          <p className="text-xs text-muted-foreground">
            {t("meta.matchQuality.updated", "Updated")}{" "}
            {new Date(data.last_polled_at).toLocaleString()}
            {" · "}
            <Badge variant="outline" className="ms-1 text-[10px]">
              {t("meta.matchQuality.source", "from Meta")}
            </Badge>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
