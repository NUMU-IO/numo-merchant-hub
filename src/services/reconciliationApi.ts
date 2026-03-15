/**
 * Reconciliation API service — daily payment reconciliation runs and mismatches.
 */

import { apiClient } from "./api";

// ── Types (mirror backend ReconciliationRunSummary / MismatchSummary) ──

export type ReconciliationStatus = "running" | "completed" | "failed";

export type MismatchType =
  | "amount_mismatch"
  | "missing_transaction"
  | "missing_order"
  | "duplicate_transaction";

export interface ReconciliationRun {
  id: string;
  period_start: string; // ISO datetime
  period_end: string;
  status: ReconciliationStatus;
  total_orders_checked: number;
  total_transactions_checked: number;
  mismatches_found: number;
  expected_amount_cents: number;
  actual_amount_cents: number;
  variance_cents: number; // expected - actual
  completed_at: string | null;
  created_at: string;
}

export interface ReconciliationMismatch {
  id: string;
  mismatch_type: MismatchType | string;
  order_number: string | null;
  gateway_transaction_id: string | null;
  expected_amount_cents: number | null;
  actual_amount_cents: number | null;
  gateway: string | null;
  notes: string | null;
  resolved: boolean;
  created_at: string;
}

// ── API calls ──

/** Returns plain array via SuccessResponse[list[...]] */
export async function listReconciliationRuns(
  storeId: string,
  params?: { skip?: number; limit?: number },
): Promise<ReconciliationRun[]> {
  const qs = new URLSearchParams();
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<ReconciliationRun[]>(
    `/stores/${storeId}/reconciliation/runs${query}`,
  );
}

export async function listRunMismatches(
  storeId: string,
  runId: string,
  resolved?: boolean,
): Promise<ReconciliationMismatch[]> {
  const qs = new URLSearchParams();
  if (resolved !== undefined) qs.set("resolved", String(resolved));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<ReconciliationMismatch[]>(
    `/stores/${storeId}/reconciliation/runs/${runId}/mismatches${query}`,
  );
}
