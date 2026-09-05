/**
 * Manual-carrier paperwork: courier profiles, waybills, CSV round-trip.
 *
 * These back the couriers a merchant manages themselves — البريد المصري,
 * Cathedis, Sprint, and the rider on a motorbike. None of them has an
 * API, so NUMU supplies the waybill, the tracking number and the status
 * history, and the handover happens on paper and in spreadsheets.
 */

import { apiClient } from "./api";

// ── Types ──

export interface CourierProfile {
  id: string;
  name_en: string;
  name_ar: string;
  /** Empty means everywhere — the merchant hasn't restricted it. */
  governorate_codes: string[];
  contact_phone: string | null;
  contact_name: string | null;
  /** Local time after which parcels go out next day, e.g. "16:00". */
  cutoff_time: string | null;
  tracking_url_template: string | null;
  notes: string | null;
  is_active: boolean;
  /** Set when the merchant started from a known courier. */
  seed_key: string | null;
}

export interface CourierSeed {
  key: string;
  name_en: string;
  name_ar: string;
  contact_phone: string | null;
  /**
   * False means coverage is a starting point, not a confirmed fact.
   * The UI must say so rather than presenting it as this courier's
   * actual service area.
   */
  data_verified: boolean;
  covers_all_governorates: boolean;
  note_en: string;
  note_ar: string;
}

export interface StatusImportRow {
  line: number;
  tracking_number: string | null;
  raw_status: string;
  status: string | null;
  note: string;
  cod_amount: number | null;
  /** Present when this row cannot be applied, with the reason. */
  error: string | null;
}

export interface StatusImportPreview {
  /** What the file was actually encoded as — shown to the merchant. */
  encoding: string;
  total: number;
  applicable: number;
  rejected: number;
  rows: StatusImportRow[];
}

export interface StatusImportResult {
  applied: { tracking_number: string; status: string }[];
  skipped: { tracking_number: string; reason: string }[];
}

export type WaybillFormat = "roll" | "sheet";

// ── Courier profiles ──

export async function listCouriers(storeId: string): Promise<CourierProfile[]> {
  return apiClient<CourierProfile[]>(`/stores/${storeId}/shipments/couriers`);
}

export async function listCourierSeeds(storeId: string): Promise<CourierSeed[]> {
  return apiClient<CourierSeed[]>(`/stores/${storeId}/shipments/couriers/seeds`);
}

export async function createCourier(
  storeId: string,
  payload: Partial<CourierProfile> & { seed_key?: string },
): Promise<CourierProfile> {
  return apiClient(`/stores/${storeId}/shipments/couriers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCourier(
  storeId: string,
  profileId: string,
  payload: Partial<CourierProfile>,
): Promise<CourierProfile> {
  return apiClient(`/stores/${storeId}/shipments/couriers/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCourier(
  storeId: string,
  profileId: string,
): Promise<void> {
  await apiClient(`/stores/${storeId}/shipments/couriers/${profileId}`, {
    method: "DELETE",
  });
}

// ── Waybills ──

/**
 * Fetch a print job as a blob.
 *
 * These endpoints return a PDF, not JSON, so they bypass `apiClient` and
 * its envelope handling. The blob is handed straight to the browser.
 */
async function fetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  const base = import.meta.env.VITE_API_URL ?? "";
  const token = localStorage.getItem("numu:token");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    // Surface the server's structured error rather than a bare status.
    let detail = `${response.status}`;
    try {
      const body = await response.json();
      detail = body?.error?.message_ar || body?.error?.message || detail;
    } catch {
      /* not JSON — keep the status */
    }
    throw new Error(detail);
  }
  return response.blob();
}

export async function fetchWaybills(
  storeId: string,
  shipmentIds: string[],
  format: WaybillFormat = "roll",
): Promise<Blob> {
  return fetchBlob(`/stores/${storeId}/shipments/waybills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipment_ids: shipmentIds, format }),
  });
}

export async function fetchWaybill(
  storeId: string,
  shipmentId: string,
): Promise<Blob> {
  return fetchBlob(`/stores/${storeId}/shipments/${shipmentId}/waybill`);
}

export async function fetchManifest(
  storeId: string,
  status = "created",
): Promise<Blob> {
  return fetchBlob(`/stores/${storeId}/shipments/manifest?status=${status}`);
}

/**
 * Hand a blob to the browser as a download.
 *
 * The object URL is revoked after the click — leaving them alive holds
 * the whole PDF in memory for the life of the tab, and a merchant
 * printing a day's labels does this repeatedly.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  // Give the new tab time to claim the URL before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── CSV status import ──

export async function previewStatusImport(
  storeId: string,
  file: File,
): Promise<StatusImportPreview> {
  const form = new FormData();
  form.append("file", file);
  return apiClient(`/stores/${storeId}/shipments/status-import`, {
    method: "POST",
    body: form,
  });
}

export async function applyStatusImport(
  storeId: string,
  rows: StatusImportRow[],
): Promise<StatusImportResult> {
  return apiClient(`/stores/${storeId}/shipments/status-import/apply`, {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

// ── Helpers ──

export function courierName(profile: CourierProfile, isAr: boolean): string {
  return isAr ? profile.name_ar : profile.name_en;
}

export function seedName(seed: CourierSeed, isAr: boolean): string {
  return isAr ? seed.name_ar : seed.name_en;
}

/** How a courier's coverage should read on a card. */
export function coverageLabel(
  profile: CourierProfile,
  isAr: boolean,
  totalGovernorates = 27,
): string {
  const count = profile.governorate_codes.length;
  if (count === 0 || count >= totalGovernorates) {
    return isAr ? "كل المحافظات" : "All governorates";
  }
  return isAr ? `${count} محافظة` : `${count} governorates`;
}
