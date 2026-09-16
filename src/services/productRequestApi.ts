import { apiClient } from "./api";

/** One shopper asking the store to find something it does not list. */
export interface ProductRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  details: string;
  images: string[];
  status: ProductRequestStatus;
  note: string | null;
  source_url: string | null;
  locale: string | null;
  handled_at: string | null;
  created_at: string;
}

export type ProductRequestStatus = "new" | "contacted" | "sourced" | "closed";

export const PRODUCT_REQUEST_STATUSES: ProductRequestStatus[] = [
  "new",
  "contacted",
  "sourced",
  "closed",
];

export interface ProductRequestList {
  items: ProductRequest[];
  total: number;
  /** Still sitting at "new" — what the page badges. */
  new_count: number;
}

const root = (storeId: string) => `/stores/${storeId}/product-requests`;

export const listProductRequests = (
  storeId: string,
  params: { status?: string; limit?: number; offset?: number } = {},
) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return apiClient<ProductRequestList>(
    `${root(storeId)}${query ? `?${query}` : ""}`,
  );
};

export const updateProductRequest = (
  storeId: string,
  requestId: string,
  patch: { status?: ProductRequestStatus; note?: string },
) =>
  apiClient<ProductRequest>(`${root(storeId)}/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

export const deleteProductRequest = (storeId: string, requestId: string) =>
  apiClient<void>(`${root(storeId)}/${requestId}`, { method: "DELETE" });
