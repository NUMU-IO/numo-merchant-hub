/**
 * ThemeCustomizerV3 — The main page component for the V3 theme customizer.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │                         TopBar                                  │
 *  ├──────────────┬──────────────────────────────┬───────────────────┤
 *  │              │                              │                   │
 *  │  Left Panel  │       Live Preview           │  Version History  │
 *  │  (320px)     │       (flex-1)               │  (optional, 280px)│
 *  │              │                              │                   │
 *  └──────────────┴──────────────────────────────┴───────────────────┘
 *
 * Left Panel navigates between:
 *  - SectionListPanel (default)
 *  - SectionEditorPanel (when a section is selected)
 *  - BlockEditorPanel (when a block is selected)
 *  - GroupEditorPanel (when a section group is selected)
 *
 * Soft Migration:
 *  - This page is mounted alongside the existing ThemeEditor.tsx
 *  - The route uses /online-store/customize-v3 (or feature flag)
 *  - The old ThemeEditor remains fully functional at /online-store/customize
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
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
    case "section-list":
    default:
      return <SectionListPanel />;
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function ThemeCustomizerV3() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();

  const initialize = useCustomizerStore((s) => s.initialize);
  const cleanup = useCustomizerStore((s) => s.cleanup);
  const isLoading = useCustomizerStore((s) => s.isLoading);
  const error = useCustomizerStore((s) => s.error);
  const locale = useCustomizerStore((s) => s.locale);

  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Initialize the customizer on mount
  useEffect(() => {
    if (storeId) {
      initialize(storeId);
    }
    return () => {
      cleanup();
    };
  }, [storeId, initialize, cleanup]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleToggleVersionHistory = useCallback(() => {
    setShowVersionHistory((prev) => !prev);
  }, []);

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
            <p className="mt-1 text-sm text-muted-foreground max-w-md">{error}</p>
          </div>
          <button
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
            "w-80 shrink-0 border-e overflow-hidden bg-background transition-all",
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
            "w-72 shrink-0 border-s overflow-hidden bg-background transition-all duration-300",
            showVersionHistory ? "translate-x-0" : "translate-x-full w-0 border-0",
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
