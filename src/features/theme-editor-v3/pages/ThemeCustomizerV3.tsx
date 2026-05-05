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
} from "../components/panels";

// ─── Left Panel Router ──────────────────────────────────────────────────────

function LeftPanelRouter() {
  const activePanel = useCustomizerStore((s) => s.activePanel);

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
    // navigate(-1) leaves the app if the user opened the editor via direct
    // link. Fall back to the themes overview.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/online-store/themes");
    }
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
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div
          className={cn(
            "w-80 shrink-0 overflow-hidden border-e bg-background transition-all",
          )}
        >
          <LeftPanelRouter />
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
    </div>
  );
}

export default ThemeCustomizerV3;
