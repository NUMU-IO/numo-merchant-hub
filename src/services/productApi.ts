/**
 * Product API service for the NUMU merchant dashboard.
 */

import { apiClient, apiClientFormData } from "./api";
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
  status?: string;
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
  seo_title?: string;
  seo_description?: string;
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
  return apiClientFormData<UploadedImageResponse>(
    `/stores/${storeId}/products/${productId}/images`,
    formData,
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

/** Strip currency prefix/suffix to get raw number. "EGP 12.00" → 12, "12.00 EGP" → 12 */
function parsePrice(val: string | null | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned) || 0;
}

export function apiToProduct(api: ApiProductResponse): Product {
  const attrs = (api.attributes || {}) as ProductAttributes;
  return {
    id: api.id,
    name: api.name,
    nameAr: attrs.nameAr || api.name,
    description: api.description || "",
    descriptionAr: attrs.descriptionAr || api.description || "",
    price: parsePrice(api.price),
    compareAtPrice: api.compare_at_price
      ? parsePrice(api.compare_at_price)
      : undefined,
    costPrice: api.cost_price ? parsePrice(api.cost_price) : undefined,
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
  costPrice?: number;
  stock: number;
  status: ProductStatus;
  category: string;
  categoryAr: string;
  categoryId?: string;
  sku?: string;
  variants: ProductVariant[];
  images?: string[];
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
}

export function productToApiCreate(form: ProductFormData): CreateProductData {
  return {
    name: form.name,
    slug: form.slug || undefined,
    sku: form.sku || undefined,
    description: form.description,
    status: form.status === "published" ? "active" : form.status,
    price: form.price.toFixed(2),
    compare_at_price: form.compareAtPrice
      ? form.compareAtPrice.toFixed(2)
      : undefined,
    cost_price: form.costPrice
      ? form.costPrice.toFixed(2)
      : undefined,
    quantity: form.stock,
    category_id: form.categoryId || undefined,
    tags: [],
    images: form.images,
    seo_title: form.seoTitle || undefined,
    seo_description: form.seoDescription || undefined,
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

// ---------------------------------------------------------------------------
// Bulk import: parse CSV text → create products one by one
// ---------------------------------------------------------------------------

export interface ImportResult {
  created: number;
  failed: number;
  errors: { row: number; name: string; error: string }[];
}

export async function importProductsFromCSV(
  storeId: string,
  csvText: string,
): Promise<ImportResult> {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    return { created: 0, failed: 0, errors: [{ row: 0, name: "", error: "CSV file is empty or has no data rows" }] };
  }

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const nameArIdx = headers.indexOf("name_ar");
  const descIdx = headers.indexOf("description");
  const descArIdx = headers.indexOf("description_ar");
  const priceIdx = headers.indexOf("price");
  const comparePriceIdx = headers.indexOf("compare_at_price");
  const stockIdx = headers.indexOf("quantity");
  const statusIdx = headers.indexOf("status");

  if (nameIdx === -1 || priceIdx === -1) {
    return { created: 0, failed: 0, errors: [{ row: 0, name: "", error: "CSV must have 'name' and 'price' columns" }] };
  }

  const result: ImportResult = { created: 0, failed: 0, errors: [] };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const name = cols[nameIdx]?.trim();
    const price = cols[priceIdx]?.trim();

    if (!name || !price) {
      result.failed++;
      result.errors.push({ row: i + 1, name: name || "", error: "Missing name or price" });
      continue;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      result.failed++;
      result.errors.push({ row: i + 1, name, error: "Invalid price" });
      continue;
    }

    const data: CreateProductData = {
      name,
      price: priceNum.toFixed(2),
      description: descIdx >= 0 ? cols[descIdx]?.trim() || undefined : undefined,
      compare_at_price: comparePriceIdx >= 0 && cols[comparePriceIdx]?.trim()
        ? parseFloat(cols[comparePriceIdx]).toFixed(2)
        : undefined,
      quantity: stockIdx >= 0 && cols[stockIdx]?.trim()
        ? parseInt(cols[stockIdx], 10)
        : 0,
      attributes: {
        nameAr: nameArIdx >= 0 ? cols[nameArIdx]?.trim() || "" : "",
        descriptionAr: descArIdx >= 0 ? cols[descArIdx]?.trim() || "" : "",
      },
    };

    if (statusIdx >= 0 && cols[statusIdx]?.trim()) {
      const s = cols[statusIdx].trim().toLowerCase();
      if (s === "published" || s === "active") data.status = "active";
      else if (s === "archived") data.status = "archived";
    }

    try {
      await createProduct(storeId, data);
      result.created++;
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : "Unknown error";
      result.errors.push({ row: i + 1, name, error: msg });
    }
  }

  return result;
}

/** Simple CSV row parser handling quoted fields */
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Bulk operations: apply action to multiple products
// ---------------------------------------------------------------------------

export type BulkAction = "publish" | "archive" | "delete";

export interface BulkResult {
  succeeded: number;
  failed: number;
}

export async function bulkProductAction(
  storeId: string,
  action: BulkAction,
  productIds: string[],
): Promise<BulkResult> {
  const result: BulkResult = { succeeded: 0, failed: 0 };
  for (const id of productIds) {
    try {
      if (action === "delete") {
        await deleteProduct(storeId, id);
      } else {
        const status = action === "publish" ? "active" : "archived";
        await updateProduct(storeId, id, { status });
      }
      result.succeeded++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

export function generateCSVTemplate(): string {
  return "name,name_ar,description,description_ar,price,compare_at_price,quantity,status\n";
}

export function exportProductsToCSV(products: Product[]): string {
  const headers = "name,name_ar,description,description_ar,price,compare_at_price,quantity,status,sku";
  const rows = products.map(p => {
    const escape = (s: string) => s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    return [
      escape(p.name), escape(p.nameAr), escape(p.description), escape(p.descriptionAr),
      p.price, p.compareAtPrice || "", p.stock, p.status, p.sku,
    ].join(",");
  });
  return [headers, ...rows].join("\n");
}

// ---------------------------------------------------------------------------
// Duplicate a product
// ---------------------------------------------------------------------------

export async function duplicateProduct(
  storeId: string,
  productId: string,
): Promise<ApiProductResponse> {
  const original = await getProduct(storeId, productId);

  const data: CreateProductData = {
    name: `${original.name} (Copy)`,
    description: original.description || undefined,
    price: original.price,
    compare_at_price: original.compare_at_price || undefined,
    cost_price: original.cost_price || undefined,
    quantity: original.quantity,
    category_id: original.category_id || undefined,
    tags: original.tags,
    attributes: {
      ...(original.attributes || {}),
      nameAr: ((original.attributes as Record<string, unknown>)?.nameAr || "") + " (نسخة)",
    },
  };

  return createProduct(storeId, data);
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
  if (form.costPrice !== undefined) {
    data.cost_price = form.costPrice
      ? form.costPrice.toFixed(2)
      : undefined;
  }
  if (form.stock !== undefined) data.quantity = form.stock;
  if (form.status !== undefined) data.status = toApiStatus(form.status);
  if (form.images !== undefined) data.images = form.images;
  if (form.categoryId !== undefined) data.category_id = form.categoryId || undefined;
  if (form.slug !== undefined) data.slug = form.slug || undefined;
  if (form.seoTitle !== undefined) data.seo_title = form.seoTitle || undefined;
  if (form.seoDescription !== undefined) data.seo_description = form.seoDescription || undefined;

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
