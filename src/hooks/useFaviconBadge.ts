/**
 * Unread count on the browser tab: a red numbered badge painted onto the
 * favicon + a "(n) " prefix on the document title — the Zid/Gmail pattern,
 * so the merchant sees new orders from any other tab.
 *
 * Companion to `useAppBadge` (installed-PWA icon). Restores the original
 * favicon and title when the count drops to zero. The title prefix is
 * re-applied after any page sets its own title (MutationObserver on
 * <title>), so route changes never strip the count.
 */

import { useEffect, useRef } from "react";

const BADGE_COLOR = "#ef4444";
const SIZE = 64;

function iconLinks(): HTMLLinkElement[] {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]'),
  );
}

function paintBadge(base: HTMLImageElement, count: number): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(base, 0, 0, SIZE, SIZE);

  const label = count > 99 ? "99+" : String(count);
  const r = label.length > 2 ? 18 : 16;
  const cx = SIZE - r - 1;
  const cy = r + 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = BADGE_COLOR;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${label.length > 2 ? 18 : 22}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 1);
  return canvas.toDataURL("image/png");
}

const TITLE_PREFIX = /^\(\d+\+?\)\s*/;

export function useFaviconBadge(count: number | null | undefined) {
  const originalHrefs = useRef<Map<HTMLLinkElement, string> | null>(null);
  const applying = useRef(false);
  const n = Math.max(0, count ?? 0);

  // ── Title prefix ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const titleEl = document.querySelector("title");

    const apply = () => {
      if (applying.current) return;
      const bare = document.title.replace(TITLE_PREFIX, "");
      const next = n > 0 ? `(${n > 99 ? "99+" : n}) ${bare}` : bare;
      if (next !== document.title) {
        applying.current = true;
        document.title = next;
        applying.current = false;
      }
    };
    apply();
    if (!titleEl) return;
    const observer = new MutationObserver(apply);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(TITLE_PREFIX, "");
    };
  }, [n]);

  // ── Favicon ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const links = iconLinks();
    if (links.length === 0) return;
    if (!originalHrefs.current) {
      originalHrefs.current = new Map(links.map((l) => [l, l.href]));
    }
    const originals = originalHrefs.current;

    const restore = () => {
      originals.forEach((href, link) => {
        if (link.href !== href) link.href = href;
      });
    };

    if (n === 0) {
      restore();
      return;
    }

    let cancelled = false;
    const img = new Image();
    // The PNG favicon is same-origin, so the canvas stays untainted.
    const png = links.find((l) => l.type === "image/png") ?? links[0];
    img.src = originals.get(png) ?? png.href;
    img.onload = () => {
      if (cancelled) return;
      try {
        const url = paintBadge(img, n);
        if (url) links.forEach((l) => (l.href = url));
      } catch {
        /* tainted canvas or unsupported — leave the plain favicon */
      }
    };
    return () => {
      cancelled = true;
    };
  }, [n]);
}
