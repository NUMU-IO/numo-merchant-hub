/**
 * Settings → Tracking & Pixels.
 *
 * Layout: at-a-glance connection strip (one tile per ad platform, live
 * status + health), a segmented platform switcher synced to
 * `?platform=meta|tiktok`, the selected platform's panel, and the
 * Sales-channels zone (TikTok Shop) at the bottom.
 *
 * The overview tiles reuse the exact query keys the panels use, so
 * react-query serves both from one fetch.
 */

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { MetaTrackingPanel } from "@/components/settings/MetaTrackingPanel";
import { TikTokTrackingPanel } from "@/components/settings/TikTokTrackingPanel";
import { TikTokShopCard } from "@/components/settings/TikTokShopCard";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import { MetaGlyph, TikTokGlyph } from "@/components/settings/tracking/PlatformGlyphs";
import {
  StatusPill,
  relTime,
  type TrackingStatusKind,
} from "@/components/settings/tracking/TrackingShared";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  fetchMetaTrackingStatus,
  fetchTrackingSettings,
} from "@/services/metaTrackingApi";
import {
  fetchTikTokTracking,
  fetchTikTokTrackingStatus,
} from "@/services/tiktokTrackingApi";
import { cn } from "@/lib/utils";

type Platform = "meta" | "tiktok";

export default function SettingsTracking() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [params, setParams] = useSearchParams();
  const platform: Platform = params.get("platform") === "tiktok" ? "tiktok" : "meta";
  const switchTo = (p: Platform) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("platform", p);
      return next;
    });

  // ── Overview data (cache-shared with the panels via identical keys) ──
  const metaSettingsQ = useQuery({
    queryKey: ["tracking-settings", storeId],
    queryFn: () => fetchTrackingSettings(storeId!),
    enabled: !!storeId,
    retry: 1,
  });
  const tiktokSettingsQ = useQuery({
    queryKey: ["tiktok-tracking-settings", storeId],
    queryFn: () => fetchTikTokTracking(storeId!),
    enabled: !!storeId,
  });
  const metaStatusQ = useQuery({
    queryKey: ["meta-tracking-status", storeId],
    queryFn: () => fetchMetaTrackingStatus(storeId!),
    enabled: !!storeId,
    retry: 1,
    staleTime: 60_000,
  });
  const tiktokStatusQ = useQuery({
    queryKey: ["tiktok-tracking-status", storeId],
    queryFn: () => fetchTikTokTrackingStatus(storeId!),
    enabled: !!storeId,
    retry: false,
    staleTime: 60_000,
  });

  const meta = metaSettingsQ.data?.meta;
  const tiktok = tiktokSettingsQ.data;

  return (
    <div className="max-w-[1160px] space-y-6">
      <div>
        <SettingsBreadcrumb current={isAr ? "التتبع والـ Pixels" : "Tracking & Pixels"} />
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
          {isAr ? "التتبع والـ Pixels" : "Tracking & Pixels"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "وصّل إعلاناتك بمتجرك — كل مشاهدة وإضافة للسلة وشراء بتوصل لـ Meta وTikTok علشان حملاتك تستهدف صح"
            : "Wire your ads to your store — every view, add-to-cart, and purchase reaches Meta and TikTok so your campaigns optimize on real signals"}
        </p>
      </div>

      {/* ── Connection overview strip ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PlatformTile
          active={platform === "meta"}
          onClick={() => switchTo("meta")}
          glyph={
            <div className="ichip ichip-navy">
              <MetaGlyph className="h-6 w-6" />
            </div>
          }
          name={isAr ? "Meta — فيسبوك وإنستجرام" : "Meta — Facebook & Instagram"}
          sub={isAr ? "Pixel + Conversions API" : "Pixel + Conversions API"}
          status={(meta?.status ?? "disabled") as TrackingStatusKind}
          lastEventAt={metaStatusQ.data?.last_validated_at ?? meta?.last_validated_at ?? null}
          failureRate={metaStatusQ.data?.recent_failure_rate ?? null}
          eventCount={metaStatusQ.data?.recent_event_count ?? null}
          isAr={isAr}
        />
        <PlatformTile
          active={platform === "tiktok"}
          onClick={() => switchTo("tiktok")}
          glyph={
            <div className="ichip bg-[#0f0f0f] text-white dark:bg-white dark:text-[#0f0f0f]">
              <TikTokGlyph size={22} />
            </div>
          }
          name="TikTok"
          sub={isAr ? "Pixel + Events API" : "Pixel + Events API"}
          status={(tiktok?.status ?? "disabled") as TrackingStatusKind}
          lastEventAt={
            tiktokStatusQ.data?.last_validated_at ?? tiktok?.last_validated_at ?? null
          }
          failureRate={tiktokStatusQ.data?.recent_failure_rate ?? null}
          eventCount={tiktokStatusQ.data?.recent_event_count ?? null}
          isAr={isAr}
        />
      </div>

      {/* ── Platform switcher ── */}
      <div className="flex items-center bg-muted/50 rounded-full p-1 w-fit" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={platform === "meta"}
          onClick={() => switchTo("meta")}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-all",
            platform === "meta"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MetaGlyph className="h-3.5 w-3.5" />
          Meta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={platform === "tiktok"}
          onClick={() => switchTo("tiktok")}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-all",
            platform === "tiktok"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <TikTokGlyph className="h-3.5 w-3.5" />
          TikTok
        </button>
      </div>

      {/* ── Selected platform panel (keyed → re-runs entrance stagger) ── */}
      <div key={platform} className="settings-section-enter">
        {platform === "meta" ? <MetaTrackingPanel /> : <TikTokTrackingPanel />}
      </div>

      {/* ── Sales channels zone ── */}
      <div className="pt-2">
        <div className="souq-zhead">
          <span className="souq-eyebrow">§ {isAr ? "قنوات البيع" : "SALES CHANNELS"}</span>
          <span className="line" />
        </div>
        <TikTokShopCard />
      </div>
    </div>
  );
}

// ─── Overview tile ─────────────────────────────────────────────────────────

interface PlatformTileProps {
  active: boolean;
  onClick: () => void;
  glyph: React.ReactNode;
  name: string;
  sub: string;
  status: TrackingStatusKind;
  lastEventAt: string | null;
  failureRate: number | null;
  eventCount: number | null;
  isAr: boolean;
}

function PlatformTile({
  active,
  onClick,
  glyph,
  name,
  sub,
  status,
  lastEventAt,
  failureRate,
  eventCount,
  isAr,
}: PlatformTileProps) {
  const nf = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US");
  const last = relTime(lastEventAt, isAr);
  const delivered =
    eventCount !== null && eventCount > 0 && failureRate !== null
      ? Math.round((1 - failureRate) * 100)
      : null;

  const statLine =
    status === "disabled" ? (
      <span className="flex items-center gap-1 font-bold text-navy dark:text-primary">
        {isAr ? "ابدأ الربط" : "Set up"}
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={2.4} />
      </span>
    ) : (
      <span className="text-muted-foreground">
        {last
          ? isAr
            ? `آخر حدث ${last}`
            : `Last event ${last}`
          : isAr
            ? "لا أحداث بعد"
            : "No events yet"}
        {delivered !== null && (
          <>
            {" · "}
            <span
              className={cn(
                "font-bold tabular-nums",
                delivered >= 90 ? "text-sage" : "text-terracotta",
              )}
            >
              {nf.format(delivered)}
              {isAr ? "٪" : "%"}
            </span>{" "}
            {isAr ? "واصل" : "delivered"}
          </>
        )}
      </span>
    );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "souq-section p-4 text-start transition-all",
        active
          ? "border-navy/60 ring-2 ring-navy/15"
          : "hover:border-[hsl(var(--border-strong))]",
      )}
    >
      <div className="flex items-center gap-3">
        {glyph}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[14.5px] font-extrabold leading-tight">{name}</span>
            <StatusPill status={status} isAr={isAr} />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
        </div>
      </div>
      <div className="mt-3 text-[12.5px]">{statLine}</div>
    </button>
  );
}
