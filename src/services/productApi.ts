/**
 * Product API service for the NUMU merchant dashboard.
 */

import { apiClient } from "./api";
import type { Product, ProductVariant, ProductStatus } from "@/data/mock-products";

// ---------------------------------------------------------------------------
// Backend response types (match API exactly)
// ---------------------------------------------------------------------------

export interface ApiProductResponse {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  short_description: string | null;
  product_type: string;
  status: "active" | "draft" | "archived";
  price: string;
  price_currency: string;
  compare_at_price: string | null;
  cost_price: string | null;
  quantity: number;
  is_in_stock: boolean;
  is_low_stock: boolean;
  is_on_sale: boolean;
  images: string[];
  category_id: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaginatedProducts {
  items: ApiProductResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface CreateProductData {
  name: string;
  slug?: string;
  sku?: string;
  description?: string;
  short_description?: string;
  product_type?: string;
  price: string;
  price_currency?: string;
  compare_at_price?: string;
  cost_price?: string;
  quantity?: number;
  low_stock_threshold?: number;
  images?: string[];
  category_id?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
}

export interface UpdateProductData extends Partial<CreateProductData> {
  status?: string;
}

export interface UploadedImageResponse {
  url: string;
  key: string;
  size: number;
  content_type: string;
  product_id: string;
  variant_urls: Record<string, string>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function listProducts(
  storeId: string,
  params?: ListProductsParams,
): Promise<PaginatedProducts> {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") query.set(k, String(v));
    }
  }
  const qs = query.toString();
  return apiClient<PaginatedProducts>(
    `/stores/${storeId}/products/${qs ? `?${qs}` : ""}`,
  );
}

export async function getProduct(
  storeId: string,
  productId: string,
): Promise<ApiProductResponse> {
  return apiClient<ApiProductResponse>(
    `/stores/${storeId}/products/${productId}`,
  );
}

export async function createProduct(
  storeId: string,
  data: CreateProductData,
): Promise<ApiProductResponse> {
  return apiClient<ApiProductResponse>(`/stores/${storeId}/products/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  storeId: string,
  productId: string,
  data: UpdateProductData,
): Promise<ApiProductResponse> {
  return apiClient<ApiProductResponse>(
    `/stores/${storeId}/products/${productId}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export async function deleteProduct(
  storeId: string,
  productId: string,
): Promise<void> {
  await apiClient(`/stores/${storeId}/products/${productId}`, {
    method: "DELETE",
  });
}

export async function uploadProductImage(
  storeId: string,
  productId: string,
  file: File,
): Promise<UploadedImageResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient<UploadedImageResponse>(
    `/stores/${storeId}/products/${productId}/images`,
    { method: "POST", body: formData },
  );
}

export async function deleteProductImage(
  storeId: string,
  productId: string,
  imageUrl: string,
): Promise<void> {
  await apiClient(
    `/stores/${storeId}/products/${productId}/images`,
    { method: "DELETE", body: JSON.stringify({ image_url: imageUrl }) },
  );
}

// ---------------------------------------------------------------------------
// Adapter: API response → Dashboard Product type
// ---------------------------------------------------------------------------

function toDisplayStatus(apiStatus: string): ProductStatus {
  if (apiStatus === "active") return "published";
  return apiStatus as ProductStatus;
}

interface ProductAttributes {
  nameAr?: string;
  descriptionAr?: string;
  categoryName?: string;
  categoryNameAr?: string;
  sold?: number;
  variants?: RawVariant[];
  [key: string]: unknown;
}

interface RawVariant {
  name?: string;
  nameAr?: string;
  options?: string[];
  optionsAr?: string[];
}

function extractVariants(attributes: ProductAttributes): ProductVariant[] {
  const raw = attributes?.variants;
  if (!Array.isArray(raw)) return [];
  return raw.map((v: RawVariant, i: number) => ({
    id: `v-${i}`,
    name: v.name || "",
    nameAr: v.nameAr || "",
    options: v.options || [],
    optionsAr: v.optionsAr || [],
  }));
}

export function apiToProduct(api: ApiProductResponse): Product {
  const attrs = (api.attributes || {}) as ProductAttributes;
  return {
    id: api.id,
    name: api.name,
    nameAr: attrs.nameAr || api.name,
    description: api.description || "",
    descriptionAr: attrs.descriptionAr || api.description || "",
    price: parseFloat(api.price) || 0,
    compareAtPrice: api.compare_at_price
      ? parseFloat(api.compare_at_price)
      : undefined,
    stock: api.quantity,
    status: toDisplayStatus(api.status),
    category: attrs.categoryName || "",
    categoryAr: attrs.categoryNameAr || "",
    categoryId: api.category_id || undefined,
    sku: api.sku || "",
    image: api.images[0] || "📦",
    images: api.images.length > 0 ? api.images : ["📦"],
    sold: attrs.sold || 0,
    variants: extractVariants(attrs),
  };
}

// ---------------------------------------------------------------------------
// Adapter: Dashboard form data → API create/update payloads
// ---------------------------------------------------------------------------

function toApiStatus(displayStatus: ProductStatus): string {
  if (displayStatus === "published") return "active";
  return displayStatus;
}

export interface ProductFormData {
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  status: ProductStatus;
  category: string;
  categoryAr: string;
  categoryId?: string;
  sku?: string;
  variants: ProductVariant[];
  images?: string[];
}

export function productToApiCreate(form: ProductFormData): CreateProductData {
  return {
    name: form.name,
    sku: form.sku || undefined,
    description: form.description,
    price: form.price.toFixed(2),
    compare_at_price: form.compareAtPrice
      ? form.compareAtPrice.toFixed(2)
      : undefined,
    quantity: form.stock,
    category_id: form.categoryId || undefined,
    tags: [],
    images: form.images,
    attributes: {
      nameAr: form.nameAr,
      descriptionAr: form.descriptionAr,
      categoryName: form.category,
      categoryNameAr: form.categoryAr,
      variants: form.variants.map((v) => ({
        name: v.name,
        nameAr: v.nameAr,
        options: v.options,
        optionsAr: v.optionsAr,
      })),
    },
  };
}

export function productToApiUpdate(
  form: Partial<ProductFormData>,
): UpdateProductData {
  const data: UpdateProductData = {};

  if (form.name !== undefined) data.name = form.name;
  if (form.sku !== undefined) data.sku = form.sku || undefined;
  if (form.description !== undefined) data.description = form.description;
  if (form.price !== undefined) data.price = form.price.toFixed(2);
  if (form.compareAtPrice !== undefined) {
    data.compare_at_price = form.compareAtPrice
      ? form.compareAtPrice.toFixed(2)
      : undefined;
  }
  if (form.stock !== undefined) data.quantity = form.stock;
  if (form.status !== undefined) data.status = toApiStatus(form.status);
  if (form.images !== undefined) data.images = form.images;
  if (form.categoryId !== undefined) data.category_id = form.categoryId || undefined;

  // Always send full attributes to avoid partial overwrites
  const attributes: Record<string, unknown> = {};
  if (form.nameAr !== undefined) attributes.nameAr = form.nameAr;
  if (form.descriptionAr !== undefined)
    attributes.descriptionAr = form.descriptionAr;
  if (form.category !== undefined) attributes.categoryName = form.category;
  if (form.categoryAr !== undefined)
    attributes.categoryNameAr = form.categoryAr;
  if (form.variants !== undefined) {
    attributes.variants = form.variants.map((v) => ({
      name: v.name,
      nameAr: v.nameAr,
      options: v.options,
      optionsAr: v.optionsAr,
    }));
  }
  if (Object.keys(attributes).length > 0) data.attributes = attributes;

  return data;
}
