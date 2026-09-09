/**
 * Assistant — the NUMU Agent's own page.
 *
 * The slide-over is for a quick question while you work; this is the room you
 * come to when the assistant *is* the task. It opens on a launcher — mark,
 * greeting, one prompt box, capability chips, then two columns: what to ask,
 * and what you already asked. Sending a turn swaps it for the thread.
 *
 * Everything on the launcher is backed by a real endpoint: the suggestion rows
 * come from /agent/digest, the threads from /agent/conversations. Nothing here
 * is decorative.
 */
import {
  ArrowLeft,
  BadgePercent,
  BarChart3,
  BookOpen,
  Boxes,
  Clock,
  MessageSquarePlus,
  Package,
  PackageX,
  Palette,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChatThread } from "@/features/agent/ChatThread";
import { Composer } from "@/features/agent/Composer";
import { MascotSprite } from "@/features/agent/MascotSprite";
import { blockText } from "@/features/agent/digestText";
import {
  getDigest,
  listConversations,
  type ConversationSummary,
  type DigestBlock,
} from "@/features/agent/api";
import { useAgentStore } from "@/features/agent/store";

/** Dismissed once, stays dismissed — the notice is information, not a nag. */
const NOTICE_KEY = "numu-agent-notice-dismissed";

/**
 * Capability chips: the tools the agent actually has, in the merchant's words.
 * Each fires its starter question straight away, the way the digest chips in
 * the slide-over already do. The colour is per capability so the row reads as
 * a set of things rather than eight identical pills.
 */
const CHIPS = [
  { key: "orders", icon: ShoppingCart, tone: "--cap-blue" },
  { key: "products", icon: Package, tone: "--cap-orange" },
  { key: "stock", icon: Boxes, tone: "--cap-gold" },
  { key: "carts", icon: ShoppingBag, tone: "--cap-red" },
  { key: "analytics", icon: BarChart3, tone: "--cap-violet" },
  { key: "discounts", icon: BadgePercent, tone: "--cap-green" },
  { key: "theme", icon: Palette, tone: "--cap-magenta" },
  { key: "growth", icon: TrendingUp, tone: "--cap-cyan" },
] as const;

/** Shown in the left column when the store is quiet and has no digest signals. */
const STARTERS = ["orders", "stock", "growth"] as const;

const TONE_OF = Object.fromEntries(CHIPS.map((c) => [c.key, c.tone])) as Record<
  string,
  string
>;

/** A digest block borrows the accent of the capability it is about. */
const DIGEST_STYLE = {
  orders: { icon: TrendingUp, tone: "--cap-blue" },
  abandoned_carts: { icon: ShoppingCart, tone: "--cap-red" },
  low_stock: { icon: PackageX, tone: "--cap-gold" },
} as const;

export default function Assistant() {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const locale = language === "ar" ? "ar" : "en";
  const { user } = useAuth();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;

  const { isStreaming, messages, sendMessage, openConversation, newChat } =
    useAgentStore();

  const [digest, setDigest] = useState<DigestBlock[]>([]);
  const [recent, setRecent] = useState<ConversationSummary[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(
    () => localStorage.getItem(NOTICE_KEY) !== "1",
  );

  // Load the launcher's two columns once the store is known. Read directly
  // rather than through the shared store's history view, so opening this page
  // never moves the slide-over off its chat tab.
  useEffect(() => {
    if (!storeId) return;
    let alive = true;
    getDigest(storeId)
      .then((d) => alive && setDigest(d.quiet ? [] : d.blocks))
      .catch(() => undefined);
    listConversations(storeId)
      .then((c) => alive && setRecent(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [storeId]);

  const send = (text: string, attachments: { type: "image"; url: string }[] = []) => {
    if (!storeId || isStreaming) return;
    void sendMessage(storeId, text, locale, attachments);
  };

  const dismissNotice = () => {
    localStorage.setItem(NOTICE_KEY, "1");
    setNoticeOpen(false);
  };

  const firstName = user?.first_name?.trim();
  // The thread's name is the question that opened it — the same string the
  // API titles the conversation with.
  const threadTitle = messages.find((m) => m.role === "user")?.text;

  // ── Thread ─────────────────────────────────────────────────────────────
  if (messages.length > 0) {
    // Header, scrolling turns, sticky composer — the three bands of a chat
    // room. The whole thing fills the scroll area so the composer holds the
    // bottom edge instead of floating under the last reply.
    return (
      <div className="-mx-4 -my-4 flex h-[calc(100vh-7rem)] flex-col md:-mx-6 md:-my-6 lg:-mx-8 lg:-my-6">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
          <h1 className="min-w-0 truncate text-lg font-semibold">
            {threadTitle || t("agent.title")}
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="btn-tactile-surface h-[33px] shrink-0 gap-1.5 border-0 text-sm"
            onClick={() => storeId && newChat(storeId)}
          >
            <ArrowLeft className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
            {t("agent.home.newChat")}
          </Button>
        </div>

        <ChatThread
          messages={messages}
          className="mx-auto w-full max-w-[720px] grow p-3"
          userMaxWidth="max-w-[80%]"
        />

        <div className="sticky bottom-0 shrink-0 px-3 pb-3">
          <div className="mx-auto w-full max-w-[720px]">
            <Composer
              storeId={storeId}
              disabled={isStreaming}
              variant="panel"
              placeholder={t("agent.home.followUp")}
              onSend={send}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Launcher ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[720px] pb-16">
      <div>
        <div className="flex flex-col items-center pt-12 text-center sm:pt-20">
          <MascotSprite state="idle" size={48} />
          <h1 className="mb-5 mt-4 text-2xl font-bold sm:text-[28px]">
            {firstName
              ? t("agent.home.hello", { name: firstName })
              : t("agent.home.helloGeneric")}
          </h1>
        </div>

        {noticeOpen && (
          <div className="banner-ai mx-auto mb-4 flex w-full max-w-[640px] items-center gap-2.5 rounded-md p-3 text-sm font-medium">
            <Sparkles className="ms-1 h-5 w-5 shrink-0 text-[hsl(var(--cap-violet))]" />
            <p className="min-w-0 grow leading-relaxed">
              {t("agent.home.notice")}{" "}
              <Link to="/agent-notes" className="text-[hsl(var(--cap-orange))] hover:underline">
                {t("agent.home.noticeLink")}
              </Link>
            </p>
            <button
              type="button"
              aria-label={t("agent.home.dismiss")}
              onClick={dismissNotice}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <Composer
          storeId={storeId}
          disabled={isStreaming}
          variant="hero"
          autoFocus
          placeholder={t("agent.home.placeholder")}
          hint={t("agent.home.hint")}
          onSend={send}
        />

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {CHIPS.map(({ key, icon: Icon, tone }) => (
            <button
              key={key}
              type="button"
              disabled={isStreaming || !storeId}
              onClick={() => send(t(`agent.home.prompts.${key}`))}
              className="btn-tactile-surface inline-flex h-[33px] items-center gap-2 ps-1.5 pe-2 text-sm font-medium disabled:opacity-50"
            >
              <Icon
                className="h-5 w-5 shrink-0 opacity-80"
                style={{ color: `hsl(var(${tone}))` }}
              />
              {t(`agent.home.chips.${key}`)}
            </button>
          ))}
        </div>

        {/* 2:1, the way the source page splits it: suggestions get the room,
            the thread list is a rail. */}
        <div className="mt-16 flex flex-col gap-10 sm:flex-row sm:gap-8">
          <section className="flex min-w-0 flex-[2] flex-col">
            <SectionHead icon={Sparkles} label={t("agent.home.ask")} />
            <ul>
              {recent[0] && (
                <SuggestionRow
                  icon={Clock}
                  tone="--cap-violet"
                  title={t("agent.home.continue")}
                  subtitle={recent[0].title || t("agent.untitled")}
                  onClick={() => storeId && void openConversation(storeId, recent[0].id)}
                />
              )}
              {digest.map((b) => (
                <SuggestionRow
                  key={b.kind}
                  icon={DIGEST_STYLE[b.kind].icon}
                  tone={DIGEST_STYLE[b.kind].tone}
                  title={t(`agent.digest.cta.${b.kind}`)}
                  subtitle={blockText(t, b, locale)}
                  disabled={isStreaming}
                  onClick={() => b.prompt && send(b.prompt)}
                />
              ))}
              {digest.length === 0 &&
                STARTERS.map((key) => (
                  <SuggestionRow
                    key={key}
                    icon={MessageSquarePlus}
                    tone={TONE_OF[key]}
                    title={t(`agent.home.chips.${key}`)}
                    subtitle={t(`agent.home.prompts.${key}`)}
                    disabled={isStreaming}
                    onClick={() => send(t(`agent.home.prompts.${key}`))}
                  />
                ))}
            </ul>
          </section>

          <section className="flex min-w-0 flex-1 flex-col">
            <SectionHead icon={Clock} label={t("agent.home.recent")} />
            {recent.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">{t("agent.home.noRecent")}</p>
            ) : (
              <ul>
                {recent.slice(0, 5).map((c) => (
                  <RailRow
                    key={c.id}
                    icon={MessageSquarePlus}
                    tone="--cap-violet"
                    label={c.title || t("agent.untitled")}
                    onClick={() => storeId && void openConversation(storeId, c.id)}
                  />
                ))}
              </ul>
            )}

            <div className="mt-10">
              <SectionHead icon={BookOpen} label={t("agent.home.knowledge")} />
              <ul>
                <RailRow
                  icon={BookOpen}
                  tone="--cap-orange"
                  label={t("agent.home.teach")}
                  to="/agent-notes"
                />
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** 11px, bold, wide-tracked, tertiary — the source page's column label. */
function SectionHead({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 px-2 text-[0.6875rem] font-semibold uppercase leading-5 tracking-[0.075em] text-muted-foreground">
      <Icon className="h-3 w-3" />
      {label}
    </h2>
  );
}

function SuggestionRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  disabled,
  onClick,
}: {
  icon: typeof Clock;
  /** A `--cap-*` custom property; the row's icon takes this hue. */
  tone: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start hover:bg-black/[0.04] disabled:opacity-50 dark:hover:bg-white/[0.06]"
      >
        <Icon
          className="h-6 w-6 shrink-0 opacity-80"
          style={{ color: `hsl(var(${tone}))` }}
        />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">{title}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Single-line variant for the right rail. */
function RailRow({
  icon: Icon,
  tone,
  label,
  onClick,
  to,
}: {
  icon: typeof Clock;
  tone: string;
  label: string;
  onClick?: () => void;
  to?: string;
}) {
  const inner = (
    <>
      <Icon
        className="h-5 w-5 shrink-0 opacity-80"
        style={{ color: `hsl(var(${tone}))` }}
      />
      <span className="truncate text-sm">{label}</span>
    </>
  );
  const cls =
    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
  return (
    <li>
      {to ? (
        <Link to={to} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}
