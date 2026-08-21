/**
 * CustomerJourneyTimeline — reverse-chrono touchpoint timeline.
 *
 * Backed by GET /stores/{id}/customers/{id}/journey. Each row is a
 * UTM-tagged inbound visit (refresh / internal nav is filtered out
 * server-side via _has_attribution_signal). The first touch gets a
 * "First touch" badge regardless of where it falls in the result set.
 */

import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Compass, ExternalLink, MousePointerClick } from "lucide-react";
import { getCustomerJourney, type JourneyTouch } from "@/services/customerApi";

interface CustomerJourneyTimelineProps {
  storeId: string;
  customerId: string;
}

const CHANNEL_TINTS: Record<string, string> = {
  facebook: "bg-blue-50 text-blue-800 border-blue-200",
  instagram: "bg-pink-50 text-pink-800 border-pink-200",
  whatsapp: "bg-green-50 text-green-800 border-green-200",
  tiktok: "bg-zinc-50 text-zinc-800 border-zinc-200",
  email: "bg-emerald-50 text-emerald-800 border-emerald-200",
  google: "bg-amber-50 text-amber-800 border-amber-200",
  sms: "bg-purple-50 text-purple-800 border-purple-200",
};

function chipClassFor(source: string | null): string {
  if (!source) return "bg-muted text-muted-foreground";
  return CHANNEL_TINTS[source.toLowerCase()] || "bg-muted text-foreground";
}

function describeReferrer(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    // Strip "www." for readability; users only care which site.
    return u.hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function formatTs(ts: string, isAr: boolean): string {
  const d = new Date(ts);
  return d.toLocaleString(isAr ? "ar-EG" : "en-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CustomerJourneyTimeline({
  storeId,
  customerId,
}: CustomerJourneyTimelineProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const query = useQuery({
    queryKey: ["customer", "journey", storeId, customerId],
    queryFn: () => getCustomerJourney(storeId, customerId, 100),
    enabled: !!storeId && !!customerId,
  });

  const touches = query.data?.touches ?? [];

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Compass className="h-4 w-4 text-muted-foreground" />
          {isAr ? "رحلة العميل" : "Customer Journey"}
          {touches.length > 0 && (
            <span className="text-[11px] text-muted-foreground font-normal">
              ({touches.length}{" "}
              {isAr ? "نقطة تتبع" : touches.length === 1 ? "touch" : "touches"})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : touches.length > 0 ? (
          <ol className="relative space-y-3 pl-5 border-l-2 border-border/40 ml-1.5">
            {touches.map((t) => (
              <TouchRow key={t.id} touch={t} isAr={isAr} />
            ))}
          </ol>
        ) : (
          <EmptyState
            icon={MousePointerClick}
            title={isAr ? "لم تُسجل نقاط تتبع بعد" : "No touchpoints recorded yet"}
            description={
              isAr
                ? "ستظهر هنا كل زيارة دخلت برابط حملة بعد إصدار حملة وربط العميل بها"
                : "Every UTM-tagged inbound visit shows up here once the customer is linked to a session"
            }
            className="py-6"
          />
        )}
      </CardContent>
    </Card>
  );
}

interface TouchRowProps {
  touch: JourneyTouch;
  isAr: boolean;
}

function TouchRow({ touch, isAr }: TouchRowProps) {
  const referrerHost = describeReferrer(touch.referrer);
  return (
    <li className="relative">
      {/* Timeline dot */}
      <span
        className={`absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-background ${
          touch.is_first_touch ? "bg-emerald-500" : "bg-primary"
        }`}
      />
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {touch.utm_source && (
            <Badge
              variant="outline"
              className={`text-[10px] ${chipClassFor(touch.utm_source)}`}
            >
              {touch.utm_source}
            </Badge>
          )}
          {touch.utm_medium && (
            <Badge variant="outline" className="text-[10px] bg-muted/50">
              {touch.utm_medium}
            </Badge>
          )}
          {touch.campaign_name ? (
            <span className="text-[12px] font-medium">{touch.campaign_name}</span>
          ) : touch.utm_campaign ? (
            <span className="text-[12px] font-mono text-muted-foreground">
              {touch.utm_campaign}
            </span>
          ) : null}
          {touch.is_first_touch && (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900"
            >
              {isAr ? "أول نقطة" : "First touch"}
            </Badge>
          )}
        </div>

        <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
          <span>{formatTs(touch.ts, isAr)}</span>
          {touch.landing_path && (
            <>
              <span>·</span>
              <span className="font-mono truncate max-w-[16rem]" dir="ltr">
                {touch.landing_path}
              </span>
            </>
          )}
          {referrerHost && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {referrerHost}
              </span>
            </>
          )}
        </div>

        {(touch.utm_term ||
          touch.utm_content ||
          touch.gclid ||
          touch.fbclid ||
          touch.ttclid) && (
          <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
            {touch.utm_term && (
              <span className="font-mono">term: {touch.utm_term}</span>
            )}
            {touch.utm_content && (
              <span className="font-mono">content: {touch.utm_content}</span>
            )}
            {touch.gclid && (
              <span className="font-mono">gclid: {touch.gclid.slice(0, 12)}…</span>
            )}
            {touch.fbclid && (
              <span className="font-mono">fbclid: {touch.fbclid.slice(0, 12)}…</span>
            )}
            {touch.ttclid && (
              <span className="font-mono">ttclid: {touch.ttclid.slice(0, 12)}…</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
