/**
 * Marketing Audiences API — Meta Custom Audience sync.
 *
 * Wraps the backend's
 *   GET  /stores/{id}/marketing/audiences
 *   POST /stores/{id}/marketing/audiences/{segment_key}/sync
 *
 * The 3 prebuilt segments (high_ltv / cart_abandoners / lapsed) cover
 * the most common Lookalike sources merchants ask for. Saved
 * CustomerSegments from feature 003 will land here when that table
 * ships.
 */

import { apiClient } from "./api";

export type AudienceSegmentKey =
  | "high_ltv"
  | "cart_abandoners"
  | "lapsed";

export interface AudienceStatus {
  segment_key: AudienceSegmentKey;
  label_en: string;
  label_ar: string;
  description_en: string;
  description_ar: string;
  /** null when the segment has never been synced to Meta. */
  meta_audience_id: string | null;
  last_synced_at: string | null;
  member_count: number | null;
}

export interface ListAudiencesResponse {
  audiences: AudienceStatus[];
  /** false → render the "Connect Meta" empty state. */
  meta_connected: boolean;
}

export interface SyncAudienceResponse {
  segment_key: AudienceSegmentKey;
  meta_audience_id: string;
  member_count: number;
  synced_at: string;
}

const ROOT = (storeId: string) => `/stores/${storeId}/marketing/audiences`;

export function listAudiences(storeId: string): Promise<ListAudiencesResponse> {
  return apiClient<ListAudiencesResponse>(ROOT(storeId));
}

export function syncAudience(
  storeId: string,
  segmentKey: AudienceSegmentKey,
): Promise<SyncAudienceResponse> {
  return apiClient<SyncAudienceResponse>(
    `${ROOT(storeId)}/${segmentKey}/sync`,
    { method: "POST" },
  );
}
