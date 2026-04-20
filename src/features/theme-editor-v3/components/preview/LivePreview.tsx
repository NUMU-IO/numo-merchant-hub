/**
 * LivePreview — Iframe-based live preview with postMessage bridge.
 *
 * Architecture:
 *  - Renders the storefront in an iframe
 *  - Sends V3 draft data to the iframe on every change via postMessage
 *  - Supports device mode switching (desktop/tablet/mobile)
 *  - Handles section highlighting when a section is selected in the editor
 *  - Receives click events from the iframe to select sections
 *
 * PostMessage Protocol:
 *  - Dashboard → Storefront:
 *    { type: "numu:theme:update", payload: ThemeSettingsV3 }
 *    { type: "numu:theme:highlight", payload: { sectionId: string | null } }
 *    { type: "numu:theme:navigate", payload: { page: string } }
 *    { type: "numu:theme:locale", payload: { locale: "ar" | "en" } }
 *
 *  - Storefront → Dashboard:
 *    { type: "numu:editor:select", payload: { sectionId: string, blockId?: string } }
 *    { type: "numu:editor:ready" }
 *    { type: "numu:editor:navigate", payload: { page: string } }
 */

import { useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";
import type { DeviceMode } from "../../types";

// ─── Device dimensions ──────────────────────────────────────────────────────

const DEVICE_SIZES: Record<DeviceMode, { width: string; maxWidth: string }> = {
  desktop: { width: "100%", maxWidth: "100%" },
  tablet: { width: "768px", maxWidth: "768px" },
  mobile: { width: "375px", maxWidth: "375px" },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function LivePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingUpdateRef = useRef<object | null>(null);

  const draft = useCustomizerStore((s) => s.draft);
  const storeId = useCustomizerStore((s) => s.storeId);
  const deviceMode = useCustomizerStore((s) => s.deviceMode);
  const locale = useCustomizerStore((s) => s.locale);
  const selection = useCustomizerStore((s) => s.selection);
  const activePage = useCustomizerStore((s) => s.activePage);
  const setSelection = useCustomizerStore((s) => s.setSelection);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);
  const setActivePage = useCustomizerStore((s) => s.setActivePage);

  // Build the storefront preview URL
  const previewUrl = useMemo(() => {
    if (!storeId) return "about:blank";
    const base = process.env.NEXT_PUBLIC_STOREFRONT_URL || process.env.REACT_APP_STOREFRONT_URL || "";
    // Add query params to signal preview mode
    const url = new URL(base || "http://localhost:3001");
    url.searchParams.set("store_id", storeId);
    url.searchParams.set("preview", "true");
    url.searchParams.set("editor", "v3");
    return url.toString();
  }, [storeId]);

  const deviceSize = DEVICE_SIZES[deviceMode];

  // ── Send message to iframe ──
  const sendMessage = useCallback((type: string, payload: unknown) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({ type, payload }, "*");
    } catch (err) {
      console.warn("[LivePreview] Failed to send message:", err);
    }
  }, []);

  // ── Send draft updates to iframe ──
  useEffect(() => {
    if (!draft) return;
    if (readyRef.current) {
      sendMessage("numu:theme:update", draft);
    } else {
      // Queue the update until the iframe is ready
      pendingUpdateRef.current = draft;
    }
  }, [draft, sendMessage]);

  // ── Send highlight on selection change ──
  useEffect(() => {
    if (readyRef.current) {
      sendMessage("numu:theme:highlight", {
        sectionId: selection.sectionId,
        blockId: selection.blockId,
      });
    }
  }, [selection.sectionId, selection.blockId, sendMessage]);

  // ── Send locale changes ──
  useEffect(() => {
    if (readyRef.current) {
      sendMessage("numu:theme:locale", { locale });
    }
  }, [locale, sendMessage]);

  // ── Send page navigation ──
  useEffect(() => {
    if (readyRef.current) {
      sendMessage("numu:theme:navigate", { page: activePage });
    }
  }, [activePage, sendMessage]);

  // ── Listen for messages from iframe ──
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const { type, payload } = event.data ?? {};
      if (!type || typeof type !== "string" || !type.startsWith("numu:editor:")) return;

      switch (type) {
        case "numu:editor:ready":
          readyRef.current = true;
          // Send any pending update
          if (pendingUpdateRef.current) {
            sendMessage("numu:theme:update", pendingUpdateRef.current);
            pendingUpdateRef.current = null;
          }
          // Send initial state
          sendMessage("numu:theme:locale", { locale });
          sendMessage("numu:theme:navigate", { page: activePage });
          break;

        case "numu:editor:select":
          if (payload?.sectionId) {
            setSelection({
              type: payload.blockId ? "block" : "section",
              sectionId: payload.sectionId,
              blockId: payload.blockId ?? null,
              groupId: payload.groupId ?? null,
            });
            setActivePanel(payload.blockId ? "block-editor" : "section-editor");
          }
          break;

        case "numu:editor:navigate":
          if (payload?.page) {
            setActivePage(payload.page);
          }
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendMessage, locale, activePage, setSelection, setActivePanel, setActivePage]);

  // ── Reset ready state on URL change ──
  useEffect(() => {
    readyRef.current = false;
  }, [previewUrl]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30 p-4">
      <div
        className={cn(
          "relative h-full overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-300",
          deviceMode !== "desktop" && "mx-auto",
        )}
        style={{
          width: deviceSize.width,
          maxWidth: deviceSize.maxWidth,
        }}
      >
        {/* Loading overlay */}
        {!readyRef.current && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                {locale === "ar" ? "جاري تحميل المعاينة..." : "Loading preview..."}
              </p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="h-full w-full border-0"
          title="Theme Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
