/**
 * Product API service for the NUMU merchant dashboard.
 */

import { apiClient, apiClientFormData } from "./api";
import type { Product, ProductVariant, ProductStatus } from "@/data/mock-products";
import { compressImage } from "@/lib/image-compression";

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
  status: "active" | "unlisted" | "draft" | "archived";
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
  brand?: string | null;
  image_alts?: Record<string, string> | null;
  seo_title?: string | null;
  seo_description?: string | null;
  /** Shipping weight in kg. */
  weight?: string | number | null;
  /** False for digital goods — checkout collects no address, charges no
   *  shipping. */
  requires_shipping?: boolean;
  /** Zero-rated: the line is excluded from the taxable base. */
  tax_exempt?: boolean;
  /** Scheduled sale. `effective_price` is what a customer pays right now;
   *  `price` stays the list price so it can be struck through. */
  effective_price?: string | null;
  sale_price?: string | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
  sale_is_active?: boolean;
  /** Curated similar products, replacing the automatic list. */
  related_product_ids?: string[] | null;
  /** Meta Commerce Catalog product ID — surfaced in ProductEditor's
   *  Marketing pane so merchants can pin their Catalog row IDs. */
  meta_catalog_id?: string | null;
  /** Shopify-style alternate-template key. `"wholesale"` selects the theme's
   *  `product.wholesale` template variant; `null` = the default `product`
   *  template. */
  template_suffix?: string | null;
  /** Canonical option axes ({name, position, values}) — hydrated on
   *  get/create/update since Wave C so the merged editor loads in one fetch. */
  options?: { name: string; position: number; values?: string[] }[];
  /** Canonical variant rows (the sellable units). */
  variants?: ApiVariantSummary[];
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
  category_id?: string;
  /** true → only products with a cost set; false → only those missing one. */
  has_cost?: boolean;
}

/** One option axis for the canonical (server-side) variant model. */
export interface ProductOptionPayload {
  name: string;
  position: number;
  values: string[];
}

/** One variant row for the canonical model. Prices are EGP majors. */
export interface VariantRowPayload {
  option_values: Record<string, string>;
  price: number;
  inventory_quantity: number;
  /** Blank/omitted → the backend auto-generates a stable SKU. */
  sku?: string;
  image_url?: string | null;
}

/** Variant summary the backend returns on product create/update/get. */
export interface ApiVariantSummary {
  id: string;
  position: number;
  option_values: Record<string, string>;
  price: string;
  price_currency: string;
  compare_at_price: string | null;
  sku: string | null;
  barcode: string | null;
  inventory_quantity: number;
  is_in_stock: boolean;
  image_url: string | null;
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
  brand?: string;
  robots_noindex?: boolean;
  canonical_url?: string;
  sitemap_exclude?: boolean;
  seo_title?: string;
  seo_description?: string;
  /** Meta Commerce Catalog product ID — wired through to the storefront's
   *  Meta Pixel events as `content_ids` when set, so dynamic ads can
   *  match conversions to a catalog row. Empty string clears the value. */
  meta_catalog_id?: string;
  /** Shipping weight in kg. Send null to clear it. */
  weight?: string | number | null;
  requires_shipping?: boolean;
  tax_exempt?: boolean;
  /** Scheduled sale. The three sale fields travel together: send a price
   *  to start or change one, send them with a null price to end it.
   *  Omit all three to leave a running sale untouched. */
  sale_price?: string | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
  /** Curated similar products. [] falls back to the automatic list. */
  related_product_ids?: string[];
  /** Shopify-style alternate-template key (e.g. `"wholesale"` →
   *  `product.wholesale`). `null`/omitted = the default `product` template. */
  template_suffix?: string | null;
  /** Canonical variant model (Wave C): axes + rows sent TOP-LEVEL. The
   *  legacy `attributes.variants`/`variant_combinations` pipeline is
   *  retired — writing those keys re-triggers the server-side bridge. */
  options?: ProductOptionPayload[];
  variants?: VariantRowPayload[];
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
  const prepared = await compressImage(file);
  const formData = new FormData();
  formData.append("file", prepared);
  return apiClientFormData<UploadedImageResponse>(
    `/stores/${storeId}/products/${productId}/images`,
    formData,
  );
}

/** Describe one product image. Alt lives in the media_urls sidecar, so it
 *  survives the wholesale `attributes` replace a product update performs. */
export async function setProductImageAlt(
  storeId: string,
  productId: string,
  imageUrl: string,
  alt: string,
): Promise<void> {
  await apiClient(`/stores/${storeId}/products/${productId}/images/alt`, {
    method: "PATCH",
    body: JSON.stringify({ image_url: imageUrl, alt: alt.trim() || null }),
  });
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
  hexValues?: string[];
  imageValues?: string[];
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
    hexValues: Array.isArray(v.hexValues) ? v.hexValues : undefined,
    imageValues: Array.isArray(v.imageValues) ? v.imageValues : undefined,
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
    // Never fall back to the English value. The editor writes whatever it
    // renders straight back on save, so `|| api.name` meant opening any
    // product with no Arabic and saving an unrelated edit persisted English
    // AS Arabic — the storefront then serves it as the ar-EG copy. The editor
    // shows the English as a placeholder hint instead.
    nameAr: attrs.nameAr || "",
    description: api.description || "",
    descriptionAr: attrs.descriptionAr || "",
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
  /** @deprecated legacy attributes.variants decoration — no longer sent to
   *  the API (the canonical model travels via `options`/`serverVariants`).
   *  Kept in the type so old call sites compile until they're migrated. */
  variants: ProductVariant[];
  /** Canonical option axes; sent top-level when the merchant enabled the
   *  options toggle (or explicitly cleared it: empty arrays remove all
   *  variants server-side). Omit (undefined) to leave variants untouched. */
  options?: ProductOptionPayload[];
  /** Canonical variant rows matching `options`. */
  serverVariants?: VariantRowPayload[];
  images?: string[];
  brand?: string;
  robotsNoindex?: boolean;
  canonicalUrl?: string;
  sitemapExclude?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
  /** Meta Commerce Catalog product ID — see ProductEditor's Marketing pane. */
  metaCatalogId?: string;
  /** Alternate-template key. `null` = default template; a string like
   *  `"wholesale"` selects `product.wholesale`. */
  templateSuffix?: string | null;
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
    brand: form.brand || undefined,
    robots_noindex: form.robotsNoindex,
    canonical_url: form.canonicalUrl || undefined,
    sitemap_exclude: form.sitemapExclude,
    seo_title: form.seoTitle || undefined,
    seo_description: form.seoDescription || undefined,
    meta_catalog_id: form.metaCatalogId || undefined,
    template_suffix: form.templateSuffix ?? null,
    // Wave C: the legacy `attributes.variants` decoration is retired — the
    // canonical model travels top-level, and writing the legacy keys would
    // re-trigger the server-side attributes bridge.
    ...(form.options !== undefined ? { options: form.options } : {}),
    ...(form.serverVariants !== undefined ? { variants: form.serverVariants } : {}),
    attributes: {
      nameAr: form.nameAr,
      descriptionAr: form.descriptionAr,
      categoryName: form.category,
      categoryNameAr: form.categoryAr,
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

type ImportCell = string | number | boolean | Date | null | undefined;

const IMPORT_HEADERS: Record<string, string[]> = {
  handle: ["handle", "product handle", "product_handle"],
  name: ["name", "اسم المنتج"],
  name_ar: ["name_ar"],
  description: ["description", "الوصف"],
  description_ar: ["description_ar"],
  image: ["image", "image url", "رابط الصورة"],
  option1_name: ["option 1 name", "option1 name", "option1_name"],
  option1_value: ["option 1 value", "option1 value", "option1_value"],
  option2_name: ["option 2 name", "option2 name", "option2_name"],
  option2_value: ["option 2 value", "option2 value", "option2_value"],
  price: ["price", "variant price", "سعر الـ variant"],
  compare_at_price: ["compare_at_price"],
  quantity: ["quantity", "stock", "المخزون"],
  sku: ["sku"],
  status: ["status", "الحالة"],
};

const cleanHeader = (value: ImportCell) => String(value ?? "").trim().toLowerCase().replace(/\s*\*$/, "");
const cleanNumber = (value: ImportCell) => Number(String(value ?? "").replace(/[^\d.-]/g, ""));

export async function importProductsFromFile(storeId: string, file: File): Promise<ImportResult> {
  let rows: ImportCell[][];
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    rows = await readSheet(file) as ImportCell[][];
  } else {
    rows = (await file.text()).split(/\r?\n/).filter((line) => line.trim()).map(parseCSVRow);
  }
  return importProductRows(storeId, rows);
}

export async function importProductRows(storeId: string, rows: ImportCell[][]): Promise<ImportResult> {
  if (rows.length < 2) return { created: 0, failed: 0, errors: [{ row: 0, name: "", error: "File is empty or has no data rows" }] };
  const headers = rows[0].map(cleanHeader);
  const column = (key: keyof typeof IMPORT_HEADERS) => headers.findIndex((header) => IMPORT_HEADERS[key].includes(header));
  const indexes = Object.fromEntries(Object.keys(IMPORT_HEADERS).map((key) => [key, column(key)])) as Record<keyof typeof IMPORT_HEADERS, number>;
  if (indexes.name < 0 || indexes.price < 0) return { created: 0, failed: 0, errors: [{ row: 0, name: "", error: "File must contain product name and variant price columns" }] };

  const result: ImportResult = { created: 0, failed: 0, errors: [] };
  const value = (row: ImportCell[], key: keyof typeof IMPORT_HEADERS) => indexes[key] < 0 ? "" : String(row[indexes[key]] ?? "").trim();
  const groups = new Map<string, { row: number; rows: ImportCell[][] }>();
  rows.slice(1).forEach((row, offset) => {
    if (!row.some((cell) => String(cell ?? "").trim())) return;
    const name = value(row, "name");
    const hasOptions = Boolean(value(row, "option1_name") && value(row, "option1_value"));
    const key = hasOptions ? (value(row, "handle") || name).toLowerCase() : `row:${offset}`;
    const group = groups.get(key) ?? { row: offset + 2, rows: [] };
    group.rows.push(row); groups.set(key, group);
  });

  for (const group of groups.values()) {
    const first = group.rows[0];
    const name = value(first, "name") || group.rows.map((row) => value(row, "name")).find(Boolean) || "";
    const parsed = group.rows.map((row) => ({ row, price: cleanNumber(value(row, "price")), quantity: Math.max(0, Math.trunc(cleanNumber(value(row, "quantity")) || 0)) }));
    if (!name || parsed.some((item) => !Number.isFinite(item.price) || item.price <= 0)) {
      result.failed += group.rows.length;
      result.errors.push({ row: group.row, name, error: !name ? "Missing product name" : "Invalid variant price" });
      continue;
    }
    const axes = [1, 2].flatMap((axis, position) => {
      const nameKey = `option${axis}_name` as "option1_name" | "option2_name";
      const valueKey = `option${axis}_value` as "option1_value" | "option2_value";
      const axisName = group.rows.map((row) => value(row, nameKey)).find(Boolean);
      if (!axisName) return [];
      return [{ name: axisName, position, values: [...new Set(group.rows.map((row) => value(row, valueKey)).filter(Boolean))] }];
    });
    const variants = axes.length ? parsed.map(({ row, price, quantity }) => ({
      option_values: Object.fromEntries(axes.map((axis, index) => [axis.name, value(row, index === 0 ? "option1_value" : "option2_value")])),
      price, inventory_quantity: quantity, sku: value(row, "sku") || undefined,
      image_url: value(row, "image") || undefined,
    })) : undefined;
    const firstNonEmpty = (key: keyof typeof IMPORT_HEADERS) => group.rows.map((row) => value(row, key)).find(Boolean);
    const status = value(first, "status").toLowerCase();
    try {
      await createProduct(storeId, {
        name,
        slug: value(first, "handle") || undefined,
        price: Math.min(...parsed.map((item) => item.price)).toFixed(2),
        description: firstNonEmpty("description") || undefined,
        quantity: parsed.reduce((total, item) => total + item.quantity, 0),
        images: firstNonEmpty("image") ? [firstNonEmpty("image")!] : undefined,
        sku: variants ? undefined : value(first, "sku") || undefined,
        status: ["active", "published", "نشط"].includes(status) ? "active" : status === "archived" ? "archived" : undefined,
        attributes: { nameAr: value(first, "name_ar"), descriptionAr: value(first, "description_ar") },
        options: axes,
        variants,
      });
      result.created++;
    } catch (error) {
      result.failed += group.rows.length;
      result.errors.push({ row: group.row, name, error: error instanceof Error ? error.message : "Unknown error" });
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
  if (form.brand !== undefined) data.brand = form.brand || undefined;
  if (form.robotsNoindex !== undefined) data.robots_noindex = form.robotsNoindex;
  if (form.canonicalUrl !== undefined) data.canonical_url = form.canonicalUrl || undefined;
  if (form.sitemapExclude !== undefined) data.sitemap_exclude = form.sitemapExclude;
  if (form.seoTitle !== undefined) data.seo_title = form.seoTitle || undefined;
  if (form.seoDescription !== undefined) data.seo_description = form.seoDescription || undefined;
  if (form.metaCatalogId !== undefined) data.meta_catalog_id = form.metaCatalogId || undefined;
  // template_suffix: null clears it (back to the default template); a string
  // selects `<type>.<suffix>`. Sent whenever provided (incl. explicit null).
  if (form.templateSuffix !== undefined) data.template_suffix = form.templateSuffix;

  // Wave C: canonical variant model travels top-level; the legacy
  // `attributes.variants` write is retired (it re-triggers the server
  // bridge). Send options/variants ONLY when the merchant touched the
  // variants section — omitting them leaves server rows untouched, so a
  // description-only save can never clobber stock edited elsewhere.
  if (form.options !== undefined) data.options = form.options;
  if (form.serverVariants !== undefined) data.variants = form.serverVariants;

  // Always send full attributes to avoid partial overwrites
  const attributes: Record<string, unknown> = {};
  if (form.nameAr !== undefined) attributes.nameAr = form.nameAr;
  if (form.descriptionAr !== undefined)
    attributes.descriptionAr = form.descriptionAr;
  if (form.category !== undefined) attributes.categoryName = form.category;
  if (form.categoryAr !== undefined)
    attributes.categoryNameAr = form.categoryAr;
  if (Object.keys(attributes).length > 0) data.attributes = attributes;

  return data;
}
