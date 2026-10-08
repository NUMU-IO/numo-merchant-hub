/**
 * The colour of a merchant's logo, to tint their theme.
 *
 * Averages the logo's opaque, non-near-white pixels on a small canvas — no
 * dependency, good enough to pick "the green one" out of a green logo. The
 * colour becomes the theme's primary (headings, buttons), so it is only
 * offered when it stays readable on a white page.
 */

import {
  fetchDraftV3,
  publishV3,
  saveDraftV3,
} from "@/features/theme-editor-v3/services/themeEditorV3Api";
import type { ThemeSettingsV3 } from "@/features/theme-editor-v3/types";

const SAMPLE = 48;

export async function dominantColor(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, SAMPLE, SAMPLE);
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
  return averageColor(data);
}

/** Pure part, for the test: RGBA bytes → "#rrggbb" or null. */
export function averageColor(data: ArrayLike<number>): string | null {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [pr, pg, pb, pa] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    // Skip transparent and near-white pixels: they are the logo's background.
    if (pa < 128 || (pr > 235 && pg > 235 && pb > 235)) continue;
    r += pr; g += pg; b += pb; n++;
  }
  if (!n) return null;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** WCAG contrast ratio against white is at least 4.5 (normal text). */
export function readableOnWhite(hex: string): boolean {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05) >= 4.5;
}

/** Make `hex` the active theme's primary colour (the SDK maps
 *  `global_settings.primary_color` to `--theme-primary_color`) and publish. */
export async function applyBrandColor(storeId: string, hex: string): Promise<void> {
  let etag: string | null = null;
  const draft = await fetchDraftV3(storeId, (e) => { etag = e; });
  if (!draft || !("schema_version" in draft)) throw new Error("No active V3 theme");
  const current = draft as ThemeSettingsV3;
  const next: ThemeSettingsV3 = {
    ...current,
    global_settings: { ...(current.global_settings || {}), primary_color: hex },
  };
  await saveDraftV3(storeId, next, { expectedEtag: etag ?? undefined, changeSummary: "Logo colour" });
  await publishV3(storeId);
}
