/**
 * Shared building blocks for the Tracking & Pixels page.
 *
 * Both platform panels (Meta / TikTok) compose the same primitives so the
 * two configuration surfaces read as one product:
 *
 *   - StatusPill        — souq-pill mapping of the 4 tracking statuses
 *   - SignalPath        — live schematic: storefront → browser/server rails →
 *                         platform. Rails light up with the selected mode.
 *   - StatTrio          — last event / delivery rate / event volume
 *   - ModeCardGrid      — the 3 activation-mode cards
 *   - EventsLog         — unified expandable delivery log (both platforms)
 *   - EventsWeSend      — "sent automatically" reference chips
 *   - HelpLink          — external deep link row (Events Manager etc.)
 *   - FloatingSaveBar   — dirty-state save pill (.settings-save-bar)
 *   - DisconnectDialog  — confirm-before-disconnect (replaces window.confirm)
 *
 * Copy is inline bilingual (en/ar) — same convention as the TikTok panel
 * and MetaTrackingAdvancedSettings.
 */

import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Radio,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Section card ──────────────────────────────────────────────────────────

/** souq-section wrapper with the standard title/description head. */
export function SettingSection({
  title,
  desc,
  aside,
  children,
  className,
}: {
  title: string;
  desc?: string;
  /** Optional element rendered at the end of the head row (pill, button…). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("souq-section", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold tracking-tight leading-tight">{title}</h3>
          {desc && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
          )}
        </div>
        {aside}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

// ─── Status pill ───────────────────────────────────────────────────────────

export type TrackingStatusKind =
  | "connected"
  | "configured_no_events"
  | "failing"
  | "disabled";

const STATUS_PILLS: Record<
  TrackingStatusKind,
  { en: string; ar: string; cls: string; pulse?: boolean }
> = {
  connected: {
    en: "Live",
    ar: "شغّال",
    cls: "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400",
    pulse: true,
  },
  configured_no_events: {
    en: "Awaiting traffic",
    ar: "في انتظار الزيارات",
    cls: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
  },
  failing: {
    en: "Failing",
    ar: "بيفشل",
    cls: "bg-destructive/14 text-destructive",
  },
  disabled: {
    en: "Off",
    ar: "متوقف",
    cls: "bg-muted text-muted-foreground",
  },
};

export function StatusPill({
  status,
  isAr,
  className,
}: {
  status: TrackingStatusKind;
  isAr: boolean;
  className?: string;
}) {
  const spec = STATUS_PILLS[status];
  return (
    <span className={cn("souq-pill whitespace-nowrap", spec.cls, className)}>
      <span className={cn("dot", spec.pulse && "animate-pulse")} />
      {isAr ? spec.ar : spec.en}
    </span>
  );
}

// ─── Relative time ─────────────────────────────────────────────────────────

/** "5m ago" / "منذ ٥ دقائق" — null when the timestamp is absent/invalid. */
export function relTime(iso: string | null | undefined, isAr: boolean): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return isAr ? "الآن" : "just now";
  const rtf = new Intl.RelativeTimeFormat(isAr ? "ar-EG" : "en", {
    numeric: "always",
    style: "narrow",
  });
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/** Minutes remaining until `expiresAt`, ticking every 30s. Null when passed/absent. */
export function useCountdownMinutes(expiresAt: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end) || end <= now) return null;
  return Math.ceil((end - now) / 60_000);
}

// ─── Signal path (the page's signature element) ────────────────────────────

interface SignalPathProps {
  /** Browser-rail (Pixel) enabled by the currently selected mode. */
  pixelOn: boolean;
  /** Server-rail (CAPI / Events API) enabled by the currently selected mode. */
  serverOn: boolean;
  /** Server rail label — "CAPI" for Meta, "Events API" for TikTok. */
  serverLabel: string;
  /** Platform node — glyph tile is supplied by the caller. */
  platformNode: ReactNode;
  platformName: string;
  isAr: boolean;
}

/**
 * Live schematic of where events flow: the storefront node on one side,
 * the ad platform on the other, and the two delivery rails between them.
 * The rails reflect the *selected* activation mode instantly — picking
 * "Both" lights both rails — so the diagram doubles as mode feedback.
 * Flow dots are pure CSS (`.sigpath-dot`), disabled under reduced motion.
 */
export function SignalPath({
  pixelOn,
  serverOn,
  serverLabel,
  platformNode,
  platformName,
  isAr,
}: SignalPathProps) {
  const rail = (on: boolean, label: string, delayed?: boolean) => (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-[11px] font-bold tracking-wide",
            on ? "text-foreground" : "text-ink-faint",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider",
            on ? "text-sage" : "text-ink-faint",
          )}
        >
          {on ? (isAr ? "مفعّل" : "On") : isAr ? "مقفول" : "Off"}
        </span>
      </div>
      <span className="sigpath-line mt-1.5" data-on={on}>
        {on && (
          <i className="sigpath-dot" style={delayed ? { animationDelay: "-1.2s" } : undefined} />
        )}
      </span>
    </div>
  );

  return (
    <div
      className="flex items-center gap-3.5"
      role="img"
      aria-label={
        isAr
          ? `مسار الأحداث من متجرك إلى ${platformName}`
          : `Event path from your store to ${platformName}`
      }
    >
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <div className="ichip bg-surface-2 text-navy dark:text-foreground">
          <Store className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <span className="text-[10.5px] font-bold text-muted-foreground">
          {isAr ? "متجرك" : "Your store"}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3 pb-4">
        {rail(pixelOn, isAr ? "Pixel · من المتصفح" : "Pixel · browser")}
        {rail(serverOn, isAr ? `${serverLabel} · من السيرفر` : `${serverLabel} · server`, true)}
      </div>

      <div className="flex flex-col items-center gap-1.5 shrink-0">
        {platformNode}
        <span className="text-[10.5px] font-bold text-muted-foreground">{platformName}</span>
      </div>
    </div>
  );
}

// ─── Health stat trio ──────────────────────────────────────────────────────

interface StatTrioProps {
  lastEventAt: string | null;
  /** Fraction of recent events that failed, in [0,1]. Null = unknown. */
  failureRate: number | null;
  eventCount: number | null;
  isAr: boolean;
}

export function StatTrio({ lastEventAt, failureRate, eventCount, isAr }: StatTrioProps) {
  const nf = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US");
  const last = relTime(lastEventAt, isAr);
  const hasVolume = eventCount !== null && eventCount > 0;
  const delivered =
    hasVolume && failureRate !== null ? Math.round((1 - failureRate) * 100) : null;

  const cell = (label: string, value: string, tone?: "good" | "bad") => (
    <div className="min-w-0">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[15px] font-extrabold tabular-nums truncate",
          tone === "good" && "text-sage",
          tone === "bad" && "text-terracotta",
        )}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface-2/60 px-4 py-3">
      {cell(isAr ? "آخر حدث" : "Last event", last ?? "—")}
      {cell(
        isAr ? "نسبة الوصول" : "Delivered",
        delivered === null ? "—" : `${nf.format(delivered)}${isAr ? "٪" : "%"}`,
        delivered === null ? undefined : delivered >= 90 ? "good" : "bad",
      )}
      {cell(
        isAr ? "أحداث حديثة" : "Recent events",
        eventCount === null ? "—" : nf.format(eventCount),
      )}
    </div>
  );
}

// ─── Activation-mode cards ─────────────────────────────────────────────────

export interface ModeCardSpec {
  mode: "pixel_only" | "capi_only" | "both";
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  requirement?: string;
  recommended?: boolean;
}

export function ModeCardGrid({
  value,
  onChange,
  cards,
  isAr,
}: {
  value: ModeCardSpec["mode"];
  onChange: (mode: ModeCardSpec["mode"]) => void;
  cards: ModeCardSpec[];
  isAr: boolean;
}) {
  return (
    <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const selected = value === card.mode;
        return (
          <button
            key={card.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(card.mode)}
            className={cn(
              "relative flex flex-col gap-2 rounded-2xl border-[1.5px] p-3.5 text-start transition-all",
              selected
                ? "border-navy bg-navy/[0.045] shadow-sm dark:bg-navy/15"
                : "border-border bg-card hover:border-[hsl(var(--border-strong))] hover:bg-muted/40",
            )}
          >
            {card.recommended && (
              <span className="absolute -top-2.5 end-3 rounded-full bg-saffron px-2 py-0.5 text-[10px] font-extrabold text-navy-900 shadow-sm">
                {isAr ? "موصى به" : "Recommended"}
              </span>
            )}
            <div className="flex items-start justify-between gap-2">
              <card.Icon
                className={cn("h-5 w-5", selected ? "text-navy dark:text-primary" : "text-ink-faint")}
                strokeWidth={2.2}
              />
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full border-[1.5px] transition-colors",
                  selected
                    ? "border-navy bg-navy text-white dark:border-primary dark:bg-primary"
                    : "border-[hsl(var(--border-strong))] bg-card",
                )}
                aria-hidden="true"
              >
                {selected && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </div>
            <div>
              <div className="text-[13.5px] font-extrabold leading-tight">{card.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
              {card.requirement && (
                <p className="mt-1.5 text-[11px] font-semibold text-ink-faint">
                  {card.requirement}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Unified events log ────────────────────────────────────────────────────

export interface UnifiedEventRow {
  id: string;
  eventId: string;
  name: string;
  channel: "browser" | "server" | "both";
  httpStatus: number | null;
  /** TikTok business-level code (0 = OK). Undefined for Meta. */
  bizCode?: number | null;
  traceId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  payload: Record<string, unknown> | null;
}

const CHANNEL_PILLS: Record<UnifiedEventRow["channel"], { en: string; ar: string; cls: string }> = {
  browser: {
    en: "Browser",
    ar: "متصفح",
    cls: "bg-blue-500/14 text-blue-700 dark:text-blue-400",
  },
  server: {
    en: "Server",
    ar: "سيرفر",
    cls: "bg-purple-500/14 text-purple-700 dark:text-purple-400",
  },
  both: {
    en: "Both",
    ar: "الاثنين",
    cls: "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400",
  },
};

function deliveryPill(row: UnifiedEventRow, isAr: boolean) {
  if (row.httpStatus === null) {
    return (
      <span className="souq-pill bg-amber-500/14 text-amber-700 dark:text-amber-400">
        <span className="dot" />
        {isAr ? "قيد الإرسال" : "Pending"}
      </span>
    );
  }
  const httpOk = row.httpStatus >= 200 && row.httpStatus < 300;
  const bizOk = row.bizCode === undefined || row.bizCode === null || row.bizCode === 0;
  if (httpOk && bizOk) {
    return (
      <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
        <span className="dot" />
        {isAr ? "وصل" : "Delivered"}
      </span>
    );
  }
  return (
    <span className="souq-pill bg-destructive/14 text-destructive">
      <span className="dot" />
      {isAr ? "فشل" : "Failed"}
      <span className="tabular-nums" dir="ltr">
        {row.httpStatus}
        {!bizOk ? ` · ${row.bizCode}` : ""}
      </span>
    </span>
  );
}

interface EventsLogProps {
  rows: UnifiedEventRow[];
  loading: boolean;
  isAr: boolean;
  /** Trace-column header — "fbtrace" for Meta, "request id" for TikTok. */
  traceHeader: string;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyHint: string;
}

export function EventsLog({
  rows,
  loading,
  isAr,
  traceHeader,
  title,
  subtitle,
  emptyTitle,
  emptyHint,
}: EventsLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="souq-section overflow-hidden">
      <div className="souq-section-head">
        <div>
          <h2>{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="ichip ichip-saffron ichip-lg">
            <Radio className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-bold">{emptyTitle}</p>
          <p className="max-w-[340px] text-xs text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="w-[36px]" />
                <TableHead className="text-[11px] font-semibold">
                  {isAr ? "الوقت" : "Time"}
                </TableHead>
                <TableHead className="text-[11px] font-semibold">
                  {isAr ? "الحدث" : "Event"}
                </TableHead>
                <TableHead className="text-[11px] font-semibold">
                  {isAr ? "القناة" : "Channel"}
                </TableHead>
                <TableHead className="text-[11px] font-semibold">
                  {isAr ? "التسليم" : "Delivery"}
                </TableHead>
                <TableHead className="text-[11px] font-semibold">{traceHeader}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const expanded = expandedId === row.id;
                const chan = CHANNEL_PILLS[row.channel];
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                    >
                      <TableCell className="ps-4">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-ink-faint" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-ink-faint rtl:rotate-180" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString(isAr ? "ar-EG" : undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-[13px] font-bold">{row.name}</TableCell>
                      <TableCell>
                        <span className={cn("souq-pill", chan.cls)}>
                          {isAr ? chan.ar : chan.en}
                        </span>
                      </TableCell>
                      <TableCell>{deliveryPill(row, isAr)}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {row.traceId ?? "—"}
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={5}>
                          <ExpandedEventDetail row={row} isAr={isAr} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ExpandedEventDetail({ row, isAr }: { row: UnifiedEventRow; isAr: boolean }) {
  return (
    <div className="space-y-2.5 py-2 text-xs">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <DetailKv label={isAr ? "المحاولات" : "Attempts"} value={String(row.attempts)} />
        <DetailKv
          label={isAr ? "أُرسل في" : "Sent at"}
          value={row.sentAt ? new Date(row.sentAt).toLocaleString(isAr ? "ar-EG" : undefined) : "—"}
        />
        <DetailKv label="event_id" value={row.eventId} mono />
        {row.lastError && (
          <DetailKv label={isAr ? "آخر خطأ" : "Last error"} value={row.lastError} error />
        )}
      </div>
      {row.payload && (
        <div className="rounded-xl border border-border bg-background p-2.5">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Check className="h-3 w-3 text-sage" />
            {isAr
              ? "البيانات الشخصية مشفّرة قبل الإرسال (الإيميل · التليفون · الاسم)"
              : "Personal data hashed before send (Email · Phone · Name)"}
          </div>
          <pre
            className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground"
            dir="ltr"
          >
            {JSON.stringify(row.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function DetailKv({
  label,
  value,
  mono,
  error,
}: {
  label: string;
  value: string;
  mono?: boolean;
  error?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={cn("break-all text-xs", mono && "font-mono", error && "text-destructive")}>
        {value}
      </div>
    </div>
  );
}

// ─── "Sent automatically" reference ────────────────────────────────────────

export function EventsWeSend({
  events,
  isAr,
  note,
}: {
  events: string[];
  isAr: boolean;
  note?: string;
}) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
        {isAr ? "أحداث بتتبعت تلقائيًا" : "Sent automatically"}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" dir="ltr">
        {events.map((e) => (
          <span
            key={e}
            className="rounded-lg bg-surface-2/80 px-2 py-1 font-mono text-[11px] font-semibold text-foreground/80"
          >
            {e}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
        {note ??
          (isAr
            ? "من غير أي كود — المتجر بيبعتهم لكل زائر أول ما تحفظ الإعدادات."
            : "No code needed — your storefront fires these for every visitor once you save.")}
      </p>
    </div>
  );
}

// ─── External help link ────────────────────────────────────────────────────

export function HelpLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-[12.5px] font-bold text-navy transition-colors hover:bg-muted dark:text-primary"
    >
      <span className="truncate">{children}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-colors group-hover:text-navy dark:group-hover:text-primary" />
    </a>
  );
}

// ─── Floating save bar ─────────────────────────────────────────────────────

export function FloatingSaveBar({
  visible,
  canSave,
  saving,
  onSave,
  onDiscard,
  isAr,
  blockedHint,
}: {
  visible: boolean;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isAr: boolean;
  /** Shown instead of "Unsaved changes" when saving is blocked by validation. */
  blockedHint?: string | null;
}) {
  return (
    <div className="settings-save-bar" data-visible={visible} aria-hidden={!visible}>
      <span className="flex items-center gap-2 text-[13px] font-bold">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            blockedHint ? "bg-destructive" : "bg-saffron animate-pulse",
          )}
        />
        {blockedHint ?? (isAr ? "تغييرات غير محفوظة" : "Unsaved changes")}
      </span>
      <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving} tabIndex={visible ? 0 : -1}>
        {isAr ? "تراجع" : "Discard"}
      </Button>
      <Button size="sm" onClick={onSave} disabled={!canSave || saving} tabIndex={visible ? 0 : -1}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {isAr ? "حفظ" : "Save"}
      </Button>
    </div>
  );
}

// ─── Disconnect confirmation ───────────────────────────────────────────────

export function DisconnectDialog({
  open,
  onOpenChange,
  onConfirm,
  disconnecting,
  isAr,
  platformName,
  description,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  disconnecting: boolean;
  isAr: boolean;
  platformName: string;
  description: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {isAr ? `فصل ${platformName}؟` : `Disconnect ${platformName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disconnecting}>
            {isAr ? "إلغاء" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={disconnecting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {disconnecting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {isAr ? "فصل" : "Disconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
