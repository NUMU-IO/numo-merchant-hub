/**
 * Customer import — CSV upload, preview the column mapping the server
 * suggests, then execute with the confirmed mapping. Mirrors orderImportApi.
 */

import { apiClient } from "./api";

export type CustomerTargetField =
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "accepts_marketing"
  | "notes"
  | "tags";

export interface CustomerImportPreview {
  columns: string[];
  sample_rows: Array<Record<string, string>>;
  suggested_mapping: Record<string, CustomerTargetField | null>;
  target_fields: CustomerTargetField[];
}

export interface CustomerImportRowError {
  row: number;
  reason: string;
}

export interface CustomerImportResult {
  total_rows: number;
  created: number;
  skipped: number;
  errors: CustomerImportRowError[];
}

export async function previewCustomerImport(
  storeId: string,
  file: File,
): Promise<CustomerImportPreview> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient<CustomerImportPreview>(
    `/stores/${storeId}/customers/import/preview`,
    { method: "POST", body: formData },
  );
}

export async function executeCustomerImport(
  storeId: string,
  file: File,
  mapping: Record<string, CustomerTargetField | "">,
  saveMapping = true,
): Promise<CustomerImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mapping_json", JSON.stringify(mapping));
  formData.append("save_mapping", saveMapping ? "true" : "false");
  return apiClient<CustomerImportResult>(
    `/stores/${storeId}/customers/import/execute`,
    { method: "POST", body: formData },
  );
}
