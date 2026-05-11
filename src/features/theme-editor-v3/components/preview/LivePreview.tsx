/**
 * LivePreview — Iframe-based live preview with postMessage bridge.
 *
 * Architecture:
 *  - Renders the storefront in an iframe (separate origin in prod).
 *  - Sends V3 draft data to the iframe on every change via postMessage.
 *  - Supports device mode switching (desktop / tablet / mobile).
 *  - Handles section highlighting when a section is selected in the editor.
 *  - Receives click events from the iframe to select sections.
 *
 * PostMessage Protocol:
 *  - Dashboard → Storefront:
 *    { type: "numu:theme:update",    payload: ThemeSettingsV3 }
 *    { type: "numu:theme:highlight", payload: { sectionId, blockId } }
 *    { type: "numu:theme:navigate",  payload: { page: string } }
 *    { type: "numu:theme:locale",    payload: { locale: "ar" | "en" } }
 *
 *  - Storefront → Dashboard:
 *    { type: "numu:editor:select",   payload: { sectionId, blockId?, groupId? } }
 *    { type: "numu:editor:ready" }
 *    { type: "numu:editor:navigate", payload: { page: string } }
 *
 * Security:
 *  - postMessage targets and accepts ONLY messages whose origin matches the
 *    storefront URL's origin. Any other origin is silently ignored. This
 *    prevents an attacker who can open a window with a reference to the
 *    editor from injecting fake selection / navigation events.
 *  - Sandbox does NOT include `allow-same-origin` together with `allow-scripts`
 *    (the well-known sandbox-escape combo). The storefront is on a separate
 *    origin in prod (numueg.app vs the dashboard's hostname), so we do not
 *    need DOM access from the parent — postMessage is the entire interface.
 */

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";
import { useDashboardStore } from "@/contexts/StoreContext";
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
  const pendingUpdateRef = useRef<object | null>(null);
  const [ready, setReady] = useState(false);
  // Bundle-error from the iframe (theme threw during render). Surfaced
  // as a toast-style banner over the preview so the merchant sees what
  // broke instead of a frozen iframe.
  const [bundleError, setBundleError] = useState<string | null>(null);

  const { currentStore } = useDashboardStore();

  const draft = useCustomizerStore((s) => s.draft);
  const storeId = useCustomizerStore((s) => s.storeId);
  const deviceMode = useCustomizerStore((s) => s.deviceMode);
  const locale = useCustomizerStore((s) => s.locale);
  const selection = useCustomizerStore((s) => s.selection);
  const activePage = useCustomizerStore((s) => s.activePage);
  const setSelection = useCustomizerStore((s) => s.setSelection);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);
  const setActivePage = useCustomizerStore((s) => s.setActivePage);

  // Build the storefront preview URL.
  //
  // numu-storefront resolves the store via either:
  //   (a) the request hostname  → `<subdomain>.<platform-domain>`     (prod)
  //   (b) the first path segment → `<base>/<subdomain>` via [domain]   (dev)
  //
  // VITE_STOREFRONT_URL controls dev/staging routing and accepts three
  // forms:
  //   - `http://localhost:3001`             → path-segment form
  //                                           → http://localhost:3001/<sub>/
  //   - `http://{subdomain}.numueg.local:3001` → template substitution
  //                                              (set up /etc/hosts)
  //   - missing → assume production-style host routing using
  //     VITE_STOREFRONT_DOMAIN (default "numueg.app").
  const previewUrl = useMemo(() => {
    if (!storeId) return "about:blank";

    const configured = import.meta.env.VITE_STOREFRONT_URL as
      | string
      | undefined;
    const subdomain = currentStore?.subdomain;

    let base: string;
    if (configured && configured.includes("{subdomain}") && subdomain) {
      // Template form — substitute the placeholder.
      base = configured.replace(/\{subdomain\}/g, subdomain);
    } else if (configured && subdomain) {
      // Path-segment form — append /<subdomain>/.
      base = `${configured.replace(/\/+$/, "")}/${subdomain}/`;
    } else if (subdomain) {
      // Production host pattern: https://<sub>.numueg.app
      const platformDomain =
        (import.meta.env.VITE_STOREFRONT_DOMAIN as string | undefined) ||
        "numueg.app";
      base = `https://${subdomain}.${platformDomain}`;
    } else if (configured) {
      base = configured;
    } else {
      base = "http://localhost:3001";
    }

    let url: URL;
    try {
      url = new URL(base);
    } catch {
      return "about:blank";
    }
    url.searchParams.set("store_id", storeId);
    url.searchParams.set("preview", "true");
    url.searchParams.set("editor", "v3");
    return url.toString();
  }, [storeId, currentStore?.subdomain]);

  // The expected origin of postMessage events from the iframe. Computed
  // once per previewUrl; comparing against this is the entire trust gate
  // for inbound editor messages.
  const previewOrigin = useMemo(() => {
    if (previewUrl === "about:blank") return null;
    try {
      return new URL(previewUrl).origin;
    } catch {
      return null;
    }
  }, [previewUrl]);

  const deviceSize = DEVICE_SIZES[deviceMode];

  // ── Send message to iframe (origin-targeted) ──
  const sendMessage = useCallback(
    (type: string, payload: unknown) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow || !previewOrigin) return;
      try {
        iframe.contentWindow.postMessage({ type, payload }, previewOrigin);
      } catch (err) {
        console.warn("[LivePreview] Failed to send message:", err);
      }
    },
    [previewOrigin],
  );

  // ── Send draft updates to iframe ──
  useEffect(() => {
    if (!draft) return;
    if (ready) {
      sendMessage("numu:theme:update", draft);
    } else {
      pendingUpdateRef.current = draft;
    }
  }, [draft, ready, sendMessage]);

  // ── Send highlight on selection change ──
  useEffect(() => {
    if (ready) {
      sendMessage("numu:theme:highlight", {
        sectionId: selection.sectionId,
        blockId: selection.blockId,
      });
    }
  }, [selection.sectionId, selection.blockId, ready, sendMessage]);

  // ── Send locale changes ──
  useEffect(() => {
    if (ready) sendMessage("numu:theme:locale", { locale });
  }, [locale, ready, sendMessage]);

  // ── Send page navigation ──
  useEffect(() => {
    if (ready) sendMessage("numu:theme:navigate", { page: activePage });
  }, [activePage, ready, sendMessage]);

  // ── Listen for messages from iframe ──
  useEffect(() => {
    if (!previewOrigin) return;

    function handleMessage(event: MessageEvent) {
      // Origin gate — silently drop anything that's not from the iframe's
      // exact origin. This is the entire trust boundary.
      if (event.origin !== previewOrigin) return;

      const data = event.data as
        | { type?: unknown; payload?: unknown }
        | null
        | undefined;
      const type = data?.type;
      if (!type || typeof type !== "string" || !type.startsWith("numu:editor:")) {
        return;
      }
      const payload = (data?.payload ?? {}) as Record<string, unknown>;

      switch (type) {
        case "numu:editor:ready":
          setReady(true);
          if (pendingUpdateRef.current) {
            sendMessage("numu:theme:update", pendingUpdateRef.current);
            pendingUpdateRef.current = null;
          }
          sendMessage("numu:theme:locale", { locale });
          sendMessage("numu:theme:navigate", { page: activePage });
          break;

        case "numu:editor:select": {
          const sectionId =
            typeof payload.sectionId === "string" ? payload.sectionId : null;
          const blockId =
            typeof payload.blockId === "string" ? payload.blockId : null;
          const groupId =
            typeof payload.groupId === "string" ? payload.groupId : null;
          if (!sectionId) break;
          setSelection({
            type: blockId ? "block" : "section",
            sectionId,
            blockId,
            groupId,
          });
          setActivePanel(blockId ? "block-editor" : "section-editor");
          break;
        }

        case "numu:editor:navigate": {
          const page = typeof payload.page === "string" ? payload.page : null;
          if (page) setActivePage(page);
          break;
        }

        case "numu:editor:bundle-error": {
          const message =
            typeof payload.message === "string"
              ? payload.message
              : "Theme bundle threw an error";
          setBundleError(message);
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    previewOrigin,
    sendMessage,
    locale,
    activePage,
    setSelection,
    setActivePanel,
    setActivePage,
  ]);

  // ── Reset ready state + clear any prior bundle error on URL change ──
  useEffect(() => {
    setReady(false);
    setBundleError(null);
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
        {/* Loading overlay — controlled by `ready` state, re-renders on flip */}
        {!ready && !bundleError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                {locale === "ar"
                  ? "جاري تحميل المعاينة..."
                  : "Loading preview..."}
              </p>
            </div>
          </div>
        )}

        {/* Bundle error banner — surfaced over the iframe when the theme
            posts `numu:editor:bundle-error`. The iframe itself shows the
            ByotThemeBoundary fallback; this is the parent-side hint so
            merchants spot the failure even if they're not watching the
            iframe console. */}
        {bundleError && (
          <div className="absolute inset-x-0 top-0 z-20 m-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            <p className="font-semibold text-destructive">
              {locale === "ar"
                ? "ارتفع خطأ من الثيم"
                : "Theme bundle threw an error"}
            </p>
            <p className="mt-1 text-xs text-destructive/80 break-all">
              {bundleError}
            </p>
            <button
              type="button"
              className="mt-2 text-xs underline hover:no-underline"
              onClick={() => setBundleError(null)}
            >
              {locale === "ar" ? "إغلاق" : "Dismiss"}
            </button>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="h-full w-full border-0"
          title="Theme Preview"
          // Sandbox notes:
          //   Production: NO `allow-same-origin` — combining it with
          //   `allow-scripts` is the HTML-spec sandbox-escape combo, and
          //   the storefront is on a separate origin so postMessage is
          //   the only interface needed.
          //
          //   Dev (import.meta.env.DEV): we DO add `allow-same-origin`
          //   so Next.js's dev cross-origin block lets the iframe load
          //   its own /_next/static/* assets. Without it, the sandbox
          //   forces Origin: null on every request and Next 16 rejects
          //   them — the storefront renders unstyled and PreviewBridge
          //   never boots, so the parent stays stuck on "Loading
          //   preview". Both apps run on localhost so the escape risk
          //   is moot.
          sandbox={
            import.meta.env.DEV
              ? "allow-scripts allow-forms allow-popups allow-same-origin"
              : "allow-scripts allow-forms allow-popups"
          }
        />
      </div>
    </div>
  );
}
