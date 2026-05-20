/**
 * ThemeCustomizerV3 — The main page component for the V3 theme customizer.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │                         TopBar                                  │
 *  ├──────────────┬──────────────────────────────┬───────────────────┤
 *  │  Left Panel  │       Live Preview           │  Version History  │
 *  │  (320px)     │       (flex-1)               │  (optional, 280px)│
 *  └──────────────┴──────────────────────────────┴───────────────────┘
 *
 * Left Panel routes between SectionListPanel / SectionEditorPanel /
 * BlockEditorPanel / GroupEditorPanel based on store.activePanel.
 *
 * Soft Migration:
 *  - Mounted alongside the existing V2 ThemeEditor.tsx — no breaking changes.
 *  - Reads `currentStore` from the dashboard StoreContext (no :storeId
 *    route param needed; matches the V2 editor's pattern).
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getStoreUrl } from "@/lib/storefront";
import { useCustomizerStore } from "../store/customizerStore";
import { TopBar } from "../components/toolbar/TopBar";
import { LivePreview } from "../components/preview/LivePreview";
import {
  SectionListPanel,
  SectionEditorPanel,
  BlockEditorPanel,
  GroupEditorPanel,
  AddSectionDialog,
  VersionHistoryPanel,
  GlobalSettingsPanel,
  AppEmbedsPanel,
  WordingPanel,
  EditorModeSwitcher,
} from "../components/panels";

// ─── Left Panel Router ──────────────────────────────────────────────────────

/**
 * Two-tier routing:
 *  1. Top-level mode (Sections / Theme settings / App embeds) routes to the
 *     matching root panel.
 *  2. Inside Sections mode, sub-state (`activePanel`) routes to the section,
 *     block, or group editor.
 */
function LeftPanelRouter() {
  const activeMode = useCustomizerStore((s) => s.activeMode);
  const activePanel = useCustomizerStore((s) => s.activePanel);

  if (activeMode === "theme-settings") return <GlobalSettingsPanel />;
  if (activeMode === "wording") return <WordingPanel />;
  if (activeMode === "app-embeds") return <AppEmbedsPanel />;

  // Sections mode — fall through to the previous sub-panel router.
  switch (activePanel) {
    case "section-editor":
      return <SectionEditorPanel />;
    case "block-editor":
      return <BlockEditorPanel />;
    case "group-editor":
      return <GroupEditorPanel />;
    case "sections":
    default:
      return <SectionListPanel />;
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function ThemeCustomizerV3() {
  const navigate = useNavigate();
  const { currentStore, isLoading: storeLoading } = useDashboardStore();
  const storeId = currentStore?.id ?? null;

  const initialize = useCustomizerStore((s) => s.initialize);
  const reset = useCustomizerStore((s) => s.reset);
  const isLoading = useCustomizerStore((s) => s.isLoading);
  const error = useCustomizerStore((s) => s.error);
  const locale = useCustomizerStore((s) => s.locale);
  const setLocale = useCustomizerStore((s) => s.setLocale);
  const sessionExpired = useCustomizerStore((s) => s.sessionExpired);
  const retryAfterReauth = useCustomizerStore((s) => s.retryAfterReauth);

  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Default editor locale to the store's preferred language on first mount.
  useEffect(() => {
    const lang = currentStore?.default_language;
    if (lang === "ar" || lang === "en") {
      setLocale(lang);
    }
  }, [currentStore?.default_language, setLocale]);

  // Initialize the customizer when the active store is known.
  useEffect(() => {
    if (storeId) {
      initialize(storeId);
    }
    return () => {
      reset();
    };
  }, [storeId, initialize, reset]);

  const handleBack = useCallback(() => {
    // Always exit to the themes overview — the editor's canonical parent.
    // Using navigate(-1) leaked to the dashboard when the merchant landed
    // on the editor via a direct link or new-tab, which felt broken.
    navigate("/online-store/themes");
  }, [navigate]);

  const handleToggleVersionHistory = useCallback(() => {
    setShowVersionHistory((prev) => !prev);
  }, []);

  // ── Waiting on store context ──
  if (storeLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-lg font-semibold">
            {locale === "ar" ? "لا يوجد متجر نشط" : "No active store"}
          </h2>
          <button
            type="button"
            className="mt-4 text-sm text-primary underline hover:no-underline"
            onClick={handleBack}
          >
            {locale === "ar" ? "العودة" : "Go back"}
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {locale === "ar" ? "جاري تحميل المحرر..." : "Loading editor..."}
          </p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <span className="text-2xl">⚠</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {locale === "ar" ? "حدث خطأ" : "Something went wrong"}
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {error}
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-primary underline hover:no-underline"
            onClick={handleBack}
          >
            {locale === "ar" ? "العودة" : "Go back"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-background"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {/* Top Bar */}
      <TopBar
        onBack={handleBack}
        onToggleVersionHistory={handleToggleVersionHistory}
        showVersionHistory={showVersionHistory}
        viewStoreUrl={
          currentStore?.subdomain ? getStoreUrl(currentStore.subdomain) : null
        }
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — mode switcher pinned above the panel router so it's
            always visible regardless of which sub-panel the merchant is
            inside. Matches Shopify's tab strip placement. */}
        <div
          className={cn(
            "flex w-80 shrink-0 flex-col overflow-hidden border-e bg-background transition-all",
          )}
        >
          <EditorModeSwitcher />
          <div className="flex-1 overflow-hidden">
            <LeftPanelRouter />
          </div>
        </div>

        {/* Live Preview */}
        <div className="flex-1 overflow-hidden">
          <LivePreview />
        </div>

        {/* Version History (conditional) */}
        <div
          className={cn(
            "w-72 shrink-0 overflow-hidden border-s bg-background transition-all duration-300",
            showVersionHistory
              ? "translate-x-0"
              : "w-0 translate-x-full border-0",
          )}
        >
          {showVersionHistory && <VersionHistoryPanel />}
        </div>
      </div>

      {/* Add Section Dialog (modal overlay) */}
      <AddSectionDialog />

      {/* Session-expired overlay. Surfaced by the V3 service layer when
          a 401 escapes the silent refresh. We block the whole editor
          rather than letting the merchant edit a dead session (the
          subsequent autosave/publish would fail), and offer two paths:
          retry (after re-auth in another tab) or full sign-out. The
          draft itself is already on the server thanks to the 3s
          autosave debounce, so no work is lost. */}
      {sessionExpired && (
        <SessionExpiredOverlay
          locale={locale}
          onRetry={() => {
            void retryAfterReauth();
          }}
          onSignIn={() => {
            // Open /login in a new tab so the existing editor tab can
            // continue once the merchant signs in. The retry flow
            // picks up the new cookie automatically because httpOnly
            // session cookies are shared across the dashboard origin.
            window.open("/login", "_blank", "noopener");
          }}
        />
      )}
    </div>
  );
}

// ─── Session Expired Overlay ────────────────────────────────────────────────

function SessionExpiredOverlay({
  locale,
  onRetry,
  onSignIn,
}: {
  locale: "ar" | "en";
  onRetry: () => void;
  onSignIn: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="mx-4 max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            ⚠
          </div>
          <div className="flex-1">
            <h2 id="session-expired-title" className="text-base font-semibold">
              {locale === "ar" ? "انتهت جلستك" : "Session expired"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {locale === "ar"
                ? "تم حفظ التغييرات على الخادم تلقائياً. سجّل الدخول من جديد للمتابعة."
                : "Your changes are safe on the server — autosave already pushed them. Sign in again to continue customizing."}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-md border bg-background px-3.5 py-2 text-sm font-medium hover:bg-accent"
          >
            {locale === "ar" ? "تسجيل الدخول" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {locale === "ar" ? "حاول مجدداً" : "Try again"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ThemeCustomizerV3;
