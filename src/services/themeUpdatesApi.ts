/**
 * Theme update channel API (Phase 5.1).
 *
 * Surfaces newer published versions of the merchant's installed theme and
 * classifies adopting them as `manual` (a breaking schema change → review
 * first) or `automatic` (safe). Applying re-points the store to the latest
 * version through the marketplace install+activate path, which snapshots the
 * current theme BEFORE switching — so a notification never changes a live
 * store silently. Backend: NUMU-api `/stores/{id}/theme-updates`.
 */

import { apiClient } from "./api";

export interface ThemeUpdateChange {
  /** setting_removed | setting_type_changed | range_tightened | section_removed | block_removed | *_added */
  kind: string;
  /** Human path, e.g. "section:hero.setting:headline". */
  target: string;
  /** True when the change could invalidate stored customization. */
  breaking: boolean;
  detail: string;
}

export interface ThemeUpdateNotification {
  id: string;
  store_id: string;
  theme_id: string;
  from_version: string;
  to_version: string;
  classification: "manual" | "automatic";
  changes: ThemeUpdateChange[];
  release_notes: string;
  status: "pending" | "applied" | "skipped";
  created_at: string;
}

/** List update notifications (default: pending only). */
export async function listThemeUpdates(
  storeId: string,
  status: string = "pending",
): Promise<ThemeUpdateNotification[]> {
  return apiClient<ThemeUpdateNotification[]>(
    `/stores/${storeId}/theme-updates/?status=${encodeURIComponent(status)}`,
  );
}

/** Scan for newer published versions; returns the pending notifications. */
export async function checkThemeUpdates(
  storeId: string,
): Promise<ThemeUpdateNotification[]> {
  const res = await apiClient<{ notifications: ThemeUpdateNotification[] }>(
    `/stores/${storeId}/theme-updates/check`,
    { method: "POST" },
  );
  return res.notifications ?? [];
}

/** Dismiss a pending update (merchant chooses not to adopt it). */
export async function skipThemeUpdate(
  storeId: string,
  notificationId: string,
): Promise<ThemeUpdateNotification> {
  return apiClient<ThemeUpdateNotification>(
    `/stores/${storeId}/theme-updates/${notificationId}/skip`,
    { method: "POST" },
  );
}

/** Apply the update: install latest + activate (snapshot-first on the backend). */
export async function applyThemeUpdate(
  storeId: string,
  notificationId: string,
): Promise<ThemeUpdateNotification> {
  return apiClient<ThemeUpdateNotification>(
    `/stores/${storeId}/theme-updates/${notificationId}/apply`,
    { method: "POST" },
  );
}
