/**
 * Commercial details — registration, tax id, and where payouts land.
 *
 * Nothing here gates selling. The store works exactly the same with an
 * empty profile; these answers exist so that gateway KYC, compliant
 * invoices and (eventually) a payout run have something to read.
 *
 * The account number is write-only: it is sent once and comes back only
 * as a masked tail. There is no endpoint that returns it, which is why
 * `payoutAccountNumber` is absent from the response type.
 */

import { apiClient } from "@/services/api";

export interface BusinessProfile {
  isRegisteredBusiness: boolean | null;
  taxId: string | null;
  payoutBankName: string | null;
  payoutAccountName: string | null;
  /** e.g. "•••• 4471". Present only once an account number is stored. */
  payoutMasked: string | null;
  hasPayoutAccount: boolean;
  isComplete: boolean;
}

export interface BusinessProfileUpdate {
  is_registered_business?: boolean;
  tax_id?: string;
  payout_bank_name?: string;
  payout_account_name?: string;
  /** Write-only. Omit to leave the stored number untouched. */
  payout_account_number?: string;
}

interface ApiBusinessProfile {
  is_registered_business: boolean | null;
  tax_id: string | null;
  payout_bank_name: string | null;
  payout_account_name: string | null;
  payout_masked: string | null;
  has_payout_account: boolean;
  is_complete: boolean;
}

function map(r: ApiBusinessProfile): BusinessProfile {
  return {
    isRegisteredBusiness: r.is_registered_business,
    taxId: r.tax_id,
    payoutBankName: r.payout_bank_name,
    payoutAccountName: r.payout_account_name,
    payoutMasked: r.payout_masked,
    hasPayoutAccount: r.has_payout_account,
    isComplete: r.is_complete,
  };
}

export async function getBusinessProfile(
  storeId: string,
): Promise<BusinessProfile> {
  const res = await apiClient<ApiBusinessProfile>(
    `/stores/${storeId}/business-profile`,
  );
  return map(res);
}

export async function updateBusinessProfile(
  storeId: string,
  update: BusinessProfileUpdate,
): Promise<BusinessProfile> {
  const res = await apiClient<ApiBusinessProfile>(
    `/stores/${storeId}/business-profile`,
    { method: "PUT", body: JSON.stringify(update) },
  );
  return map(res);
}
