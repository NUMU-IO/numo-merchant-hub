/**
 * Order import — CSV upload, preview the column mapping the server suggests,
 * then execute with the confirmed mapping.
 */

import { apiClient } from "./api";

export type TargetField =
  | "external_order_id"
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "shipping_address"
  | "shipping_city"
  | "total"
  | "payment_status"
  | "status"
  | "notes"
  | "order_date";

export interface OrderImportPreview {
  columns: string[];
  sample_rows: Array<Record<string, string>>;
  suggested_mapping: Record<string, TargetField | null>;
  target_fields: TargetField[];
}

export interface OrderImportRowError {
  row: number;
  reason: string;
}

export interface OrderImportResult {
  total_rows: number;
  created: number;
  skipped: number;
  errors: OrderImportRowError[];
}

export async function previewOrderImport(
  storeId: string,
  file: File,
): Promise<OrderImportPreview> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient<OrderImportPreview>(
    `/stores/${storeId}/orders/import/preview`,
    { method: "POST", body: formData },
  );
}

export async function executeOrderImport(
  storeId: string,
  file: File,
  mapping: Record<string, TargetField | "">,
  saveMapping = true,
): Promise<OrderImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mapping_json", JSON.stringify(mapping));
  formData.append("save_mapping", saveMapping ? "true" : "false");
  return apiClient<OrderImportResult>(
    `/stores/${storeId}/orders/import/execute`,
    { method: "POST", body: formData },
  );
}
