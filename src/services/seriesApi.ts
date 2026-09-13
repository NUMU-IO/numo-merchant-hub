import { apiClient } from "./api";

export interface SeriesBook {
  product_id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
  volume_label: string | null;
  position: number;
}

export interface ProductSeries {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  products: SeriesBook[];
}

const root = (storeId: string) => `/stores/${storeId}/series`;

export const listSeries = (storeId: string) =>
  apiClient<ProductSeries[]>(root(storeId));

export const createSeries = (storeId: string, name: string) =>
  apiClient<ProductSeries>(root(storeId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const addSeriesBook = (
  storeId: string,
  seriesId: string,
  productId: string,
  position: number,
) => apiClient<ProductSeries>(`${root(storeId)}/${seriesId}/products`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ product_id: productId, position }),
});

export const reorderSeries = (storeId: string, seriesId: string, productIds: string[]) =>
  apiClient<ProductSeries>(`${root(storeId)}/${seriesId}/order`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_ids: productIds }),
  });

export const removeSeriesBook = (storeId: string, seriesId: string, productId: string) =>
  apiClient<void>(`${root(storeId)}/${seriesId}/products/${productId}`, { method: "DELETE" });
