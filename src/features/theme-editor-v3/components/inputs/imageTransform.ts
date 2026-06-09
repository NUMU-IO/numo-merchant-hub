/**
 * imageTransform — the canonical, NON-DESTRUCTIVE image transform model.
 *
 * A transform is lightweight METADATA stored alongside the image URL inside the
 * theme setting value (see ImageValue in MediaLibraryDialog). The original
 * uploaded asset is never modified; the storefront and this editor reproduce the
 * visual state purely from these numbers via CSS — "move the image behind a
 * fixed viewport". Because the transform lives on the setting INSTANCE (not the
 * asset), the same uploaded image can be framed differently in a hero vs a card.
 *
 * ⚠ SINGLE SOURCE OF TRUTH: `applyImageTransform` MUST stay byte-for-byte
 * equivalent to the theme-side copy in each theme's `_shared.ts`
 * (`v3-themes/<theme>/src/sections/_shared.ts`). The merchant-hub editor and the
 * merchant-app do not share an npm package, so the function is duplicated by
 * necessity — keep them in sync. Phase 2 hoists the theme copy into
 * `@numueg/theme-sdk` (themes import it there); the hub keeps this copy because
 * the hub deliberately does not depend on the SDK runtime.
 */

import type { CSSProperties } from "react";

export interface ImageTransform {
  /** Schema version — lets future focal algorithms detect + migrate old data. */
  v: 1;
  /** Focal point in 0..1 normalized image coords. Default {0.5, 0.5} (center). */
  focal?: { x: number; y: number };
  /** Zoom factor, 1..MAX_ZOOM. Default 1. Scales toward the focal point. */
  zoom?: number;
  /** Rotation in degrees. Default 0. */
  rotation?: number;
  /** Per-placement object-fit override. Defaults to the container's mode. */
  fit?: "cover" | "contain";
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const DEFAULT_TRANSFORM: ImageTransform = {
  v: 1,
  focal: { x: 0.5, y: 0.5 },
  zoom: 1,
  rotation: 0,
};

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/** True when the transform is the visual identity (center, no zoom/rotation) —
 *  used to keep the stored value clean (we drop a no-op transform). */
export function isIdentityTransform(t: ImageTransform | undefined | null): boolean {
  if (!t) return true;
  const fx = t.focal?.x ?? 0.5;
  const fy = t.focal?.y ?? 0.5;
  const zoom = t.zoom ?? 1;
  const rot = ((t.rotation ?? 0) % 360 + 360) % 360;
  return Math.abs(fx - 0.5) < 1e-4 && Math.abs(fy - 0.5) < 1e-4 && Math.abs(zoom - 1) < 1e-4 && rot === 0;
}

/**
 * Compute the inline CSS that reproduces a transform on an <img> filling a
 * fixed-aspect, overflow-hidden container. Identical math runs in the editor
 * preview AND on the storefront → zero drift.
 *
 *  - cover: object-position = focal (chooses the visible crop), and the image
 *    scales/rotates AROUND the focal point (transform-origin = focal).
 *  - contain: object-position is inert for contain, so only scale/rotate apply.
 *
 * All values are %/unitless → responsive at any container size, no JS at render.
 */
export function applyImageTransform(
  t: ImageTransform | undefined | null,
  fit: "cover" | "contain" = "cover",
): CSSProperties {
  if (!t) return {};
  const fx = Math.round(clamp(t.focal?.x ?? 0.5, 0, 1) * 1e4) / 100; // % with 2dp
  const fy = Math.round(clamp(t.focal?.y ?? 0.5, 0, 1) * 1e4) / 100;
  const zoom = clamp(t.zoom ?? 1, MIN_ZOOM, MAX_ZOOM);
  const rot = ((t.rotation ?? 0) % 360 + 360) % 360;
  const effFit = t.fit ?? fit;
  const style: CSSProperties = {
    transform: `scale(${zoom}) rotate(${rot}deg)`,
    transformOrigin: `${fx}% ${fy}%`,
    objectFit: effFit,
  };
  if (effFit === "cover") style.objectPosition = `${fx}% ${fy}%`;
  return style;
}
