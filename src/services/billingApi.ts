import { apiClient, apiClientFormData } from "./api";

/** Plan catalog entry — prices are live from the backend (piasters). */
export interface BillingPlan {
  plan: string;
  display_name: string;
  monthly_price_cents: number;
  annual_price_cents: number;
}

export interface BillingCurrentState {
  plan: string;
  billing_cycle: string | null;
  lifecycle_state: string;
  next_renewal_at: string | null;
  renewal_due: boolean;
}

export interface BillingPlansResponse {
  plans: BillingPlan[];
  current: BillingCurrentState | null;
  /** Platform InstaPay IPA configured — the manual payment flow is offered. */
  instapay_available: boolean;
  /** Plan chosen on the landing page at signup (starter/pro/payg) — preselect it. */
  plan_intent: string | null;
}

export type InstapayIntentStatus =
  | "awaiting_proof"
  | "under_review"
  | "succeeded"
  | "failed"
  | "expired";

export interface InstapayIntent {
  id: string;
  plan: string;
  billing_cycle: string;
  purpose: "new_subscription" | "renewal";
  amount_cents: number;
  currency: string;
  status: InstapayIntentStatus;
  reference_code: string;
  destination: string | null;
  destination_label: string | null;
  qr_payload: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
  created_at: string | null;
}

export interface InstapayProofResponse {
  proof_id: string;
  intent_id: string;
  status: string;
  intent_status: InstapayIntentStatus;
  reasons: string[];
  activated: boolean;
  plan: string;
  billing_cycle: string;
  next_renewal_at: string | null;
}

export const getBillingPlans = () =>
  apiClient<BillingPlansResponse>("/billing/plans");

export const listInstapayIntents = () =>
  apiClient<InstapayIntent[]>("/billing/instapay-intents");

export const createInstapayIntent = (plan: string, billingCycle: string) =>
  apiClient<InstapayIntent>("/billing/instapay-intents", {
    method: "POST",
    body: JSON.stringify({ plan, billing_cycle: billingCycle }),
  });

export const getInstapayIntent = (intentId: string) =>
  apiClient<InstapayIntent>(`/billing/instapay-intents/${intentId}`);

export const submitInstapayProof = (
  intentId: string,
  transactionRef: string,
  file: File,
) => {
  const form = new FormData();
  form.append("transaction_ref", transactionRef.trim());
  form.append("file", file);
  return apiClientFormData<InstapayProofResponse>(
    `/billing/instapay-intents/${intentId}/proof`,
    form,
  );
};
