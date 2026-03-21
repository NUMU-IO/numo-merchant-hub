/**
 * Invoice API service for the merchant dashboard.
 */

import { apiClient } from "./api";

// Types matching backend schemas
export interface InvoiceLineItem {
  description: string;
  description_ar: string | null;
  item_type: string;
  item_code: string;
  unit_type: string;
  quantity: string;
  unit_price: string;
  discount: string;
  sales_total: string;
  net_total: string;
  total: string;
  internal_code: string | null;
  taxes: { tax_type: string; amount: string; rate: string }[];
}

export interface SellerInfo {
  tax_id: string;
  name: string;
  name_ar: string | null;
  branch_id: string;
  country: string;
  governorate: string | null;
  city: string | null;
  street: string | null;
  building_number: string | null;
  activity_code: string;
}

export interface BuyerInfo {
  buyer_type: string;
  tax_id: string | null;
  national_id: string | null;
  name: string;
  name_ar: string | null;
  country: string;
  governorate: string | null;
  city: string | null;
  street: string | null;
  building_number: string | null;
  phone: string | null;
  email: string | null;
}

export type InvoiceStatus = "draft" | "pending" | "submitted" | "accepted" | "rejected" | "cancelled";
export type InvoiceType = "I" | "C" | "D";

export interface Invoice {
  id: string;
  store_id: string;
  order_id: string | null;
  customer_id: string | null;
  invoice_number: string;
  internal_id: string | null;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  date_issued: string;
  seller: SellerInfo;
  buyer: BuyerInfo;
  currency: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  total_discount: number;
  total_taxes: number;
  extra_discount: number;
  total: number;
  subtotal_formatted: string | null;
  total_formatted: string | null;
  eta_uuid: string | null;
  eta_long_id: string | null;
  eta_status_code: string | null;
  eta_status_message: string | null;
  eta_portal_url: string | null;
  qr_code_data: string | null;
  qr_code_image: string | null;
  pdf_url: string | null;
  notes: string | null;
  notes_ar: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceListItem {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  date_issued: string;
  buyer_name: string;
  currency: string;
  total: number;
  total_formatted: string | null;
  eta_uuid: string | null;
  created_at: string;
}

export interface PaginatedInvoices {
  items: InvoiceListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateInvoiceLineItem {
  description: string;
  description_ar?: string;
  item_code: string;
  item_type?: string;
  unit_type?: string;
  quantity: string;
  unit_price: string;
  discount?: string;
  vat_rate?: string;
  internal_code?: string;
}

export interface CreateInvoiceData {
  order_id?: string;
  customer_id?: string;
  invoice_type?: InvoiceType;
  seller: {
    tax_id: string;
    name: string;
    name_ar?: string;
    branch_id?: string;
    governorate?: string;
    city?: string;
    street?: string;
    building_number?: string;
    activity_code?: string;
  };
  buyer: {
    buyer_type?: string;
    tax_id?: string;
    national_id?: string;
    name: string;
    name_ar?: string;
    governorate?: string;
    city?: string;
    street?: string;
    building_number?: string;
    phone?: string;
    email?: string;
  };
  line_items: CreateInvoiceLineItem[];
  extra_discount?: number;
  notes?: string;
  notes_ar?: string;
}

export interface ListInvoicesParams {
  page?: number;
  limit?: number;
  status?: string;
  invoice_type?: string;
}

export async function listInvoices(
  storeId: string,
  params?: ListInvoicesParams,
): Promise<PaginatedInvoices> {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
  }
  const query = qs.toString();
  return apiClient<PaginatedInvoices>(
    `/stores/${storeId}/invoices/${query ? `?${query}` : ""}`,
  );
}

export async function getInvoice(
  storeId: string,
  invoiceId: string,
): Promise<Invoice> {
  return apiClient<Invoice>(`/stores/${storeId}/invoices/${invoiceId}`);
}

export async function createInvoice(
  storeId: string,
  data: CreateInvoiceData,
): Promise<Invoice> {
  return apiClient<Invoice>(`/stores/${storeId}/invoices/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteInvoice(
  storeId: string,
  invoiceId: string,
): Promise<void> {
  await apiClient(`/stores/${storeId}/invoices/${invoiceId}`, {
    method: "DELETE",
  });
}

export async function submitInvoice(
  storeId: string,
  invoiceId: string,
): Promise<{ success: boolean; invoice_id: string; status: string; eta_uuid?: string; error_message?: string }> {
  return apiClient(`/stores/${storeId}/invoices/${invoiceId}/submit`, {
    method: "POST",
  });
}

export async function downloadInvoicePdf(
  storeId: string,
  invoiceId: string,
): Promise<void> {
  const response = await fetch(`/api/v1/stores/${storeId}/invoices/${invoiceId}/pdf`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to download PDF");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${invoiceId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
