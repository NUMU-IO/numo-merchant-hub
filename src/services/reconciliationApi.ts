/**
 * Payment Reconciliation API service.
 * Endpoints: /stores/{storeId}/reconciliation/*
 */

import { apiClient } from "./api";

export interface ReconciliationRun {
  id: string;
  /** Rail this run covered (paymob / instapay / cod / …). A store with
      several gateways gets several runs per day. */
  gateway?: string;
  period_start: string;
  period_end: string;
  status: string;
  total_orders_checked: number;
  total_transactions_checked: number;
  mismatches_found: number;
  expected_amount_cents: number;
  actual_amount_cents: number;
  variance_cents: number;
  completed_at: string | null;
  created_at: string;
}

export interface ReconciliationMismatch {
  id: string;
  mismatch_type: string;
  order_number: string | null;
  gateway_transaction_id: string | null;
  expected_amount_cents: number | null;
  actual_amount_cents: number | null;
  gateway: string | null;
  notes: string | null;
  resolved: boolean;
  created_at: string;
}

/** List reconciliation runs for a store. */
export async function listReconciliationRuns(
  storeId: string,
  skip = 0,
  limit = 30
): Promise<ReconciliationRun[]> {
  return apiClient<ReconciliationRun[]>(
    `/stores/${storeId}/reconciliation/runs?skip=${skip}&limit=${limit}`
  );
}

/** List mismatches for a specific run. */
export async function listRunMismatches(
  storeId: string,
  runId: string,
  resolved?: boolean
): Promise<ReconciliationMismatch[]> {
  const params = new URLSearchParams();
  if (resolved !== undefined) params.set("resolved", String(resolved));
  const qs = params.toString();
  return apiClient<ReconciliationMismatch[]>(
    `/stores/${storeId}/reconciliation/runs/${runId}/mismatches${qs ? `?${qs}` : ""}`
  );
}

export interface TriggerReconciliationResponse {
  run_id: string;
  status: string;
  message: string;
}

/** Trigger a reconciliation run for a given date (defaults to yesterday). */
export async function triggerReconciliation(
  storeId: string,
  targetDate?: string
): Promise<TriggerReconciliationResponse> {
  return apiClient<TriggerReconciliationResponse>(
    `/stores/${storeId}/reconciliation/runs/trigger`,
    {
      method: "POST",
      body: JSON.stringify(targetDate ? { target_date: targetDate } : {}),
    }
  );
}
