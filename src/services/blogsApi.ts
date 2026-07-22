/**
 * Blog / Articles CMS API.
 *
 * Merchant-authored blogs (News, Guides, …) each holding articles, managed at
 * Online Store → Blog and rendered on the storefront at
 * `/blogs/<blogHandle>/<articleHandle>`. Backend: NUMU-api
 * `/stores/{id}/blogs`. Bilingual title/excerpt/body, SEO overrides, tags,
 * cover image, and a draft → scheduled → published → archived lifecycle.
 *
 * Notes:
 * - A blog's `handle` is immutable after creation (it anchors the URL).
 * - An article's `handle` CAN be renamed — the storefront auto-redirects
 *   from `previous_handles`.
 * - `scheduled` articles require an ISO `scheduled_at`; the backend flips
 *   them to `published` at that time.
 */

import { apiClient } from "./api";

export type ArticleStatus = "draft" | "scheduled" | "published" | "archived";

/** SEO overrides: bilingual meta title + description. */
export interface ArticleSeo {
  title?: Record<string, string>;
  description?: Record<string, string>;
}

export interface Blog {
  id: string;
  store_id: string;
  handle: string;
  /** Bilingual title {en, ar}. */
  title: Record<string, string>;
  /** Bilingual description {en, ar}. */
  description: Record<string, string>;
  is_published: boolean;
  article_count: number;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  blog_handle: string;
  handle: string;
  /** Bilingual title {en, ar}. */
  title: Record<string, string>;
  /** Bilingual short excerpt {en, ar}. */
  excerpt: Record<string, string>;
  /** Bilingual rich-text body {en, ar}. */
  body: Record<string, string>;
  image_url: string | null;
  author: string | null;
  tags: string[];
  seo: ArticleSeo;
  status: ArticleStatus;
  published_at: string | null;
  scheduled_at: string | null;
  /** Old handles kept for storefront auto-redirects after a rename. */
  previous_handles: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateBlogInput {
  handle: string;
  title?: Record<string, string>;
  description?: Record<string, string>;
  is_published?: boolean;
}

export interface UpdateBlogInput {
  title?: Record<string, string>;
  description?: Record<string, string>;
  is_published?: boolean;
}

export interface CreateArticleInput {
  /** Omitted → auto-derived from the English title. */
  handle?: string;
  title?: Record<string, string>;
  excerpt?: Record<string, string>;
  body?: Record<string, string>;
  image_url?: string | null;
  author?: string | null;
  tags?: string[];
  seo?: ArticleSeo;
  status?: Exclude<ArticleStatus, "archived">;
  /** ISO datetime — required when status is "scheduled". */
  scheduled_at?: string;
}

export interface UpdateArticleInput {
  /** Renaming is allowed — the old handle auto-redirects on the storefront. */
  handle?: string;
  title?: Record<string, string>;
  excerpt?: Record<string, string>;
  body?: Record<string, string>;
  image_url?: string | null;
  author?: string | null;
  tags?: string[];
  seo?: ArticleSeo;
  status?: ArticleStatus;
  scheduled_at?: string | null;
}

export interface ListArticlesParams {
  status?: ArticleStatus;
  skip?: number;
  limit?: number;
}

// ─── Blogs ──────────────────────────────────────────────────────────────────

/** List all blogs for a store (published + hidden). */
export async function listBlogs(storeId: string): Promise<Blog[]> {
  return apiClient<Blog[]>(`/stores/${storeId}/blogs/`);
}

/** Get a single blog by handle. */
export async function getBlog(storeId: string, handle: string): Promise<Blog> {
  return apiClient<Blog>(`/stores/${storeId}/blogs/${handle}`);
}

/** Create a new blog. 409 on duplicate handle. */
export async function createBlog(
  storeId: string,
  data: CreateBlogInput,
): Promise<Blog> {
  return apiClient<Blog>(`/stores/${storeId}/blogs/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update a blog by handle (handle itself is immutable). */
export async function updateBlog(
  storeId: string,
  handle: string,
  data: UpdateBlogInput,
): Promise<Blog> {
  return apiClient<Blog>(`/stores/${storeId}/blogs/${handle}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Delete a blog by handle — deletes all of its articles too. */
export async function deleteBlog(storeId: string, handle: string): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/blogs/${handle}`, {
    method: "DELETE",
  });
}

// ─── Articles ───────────────────────────────────────────────────────────────

/** List a blog's articles, optionally filtered by status. */
export async function listArticles(
  storeId: string,
  blogHandle: string,
  params: ListArticlesParams = {},
): Promise<Article[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.skip !== undefined) qs.set("skip", String(params.skip));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<Article[]>(
    `/stores/${storeId}/blogs/${blogHandle}/articles${suffix}`,
  );
}

/** Get a single article by handle. */
export async function getArticle(
  storeId: string,
  blogHandle: string,
  articleHandle: string,
): Promise<Article> {
  return apiClient<Article>(
    `/stores/${storeId}/blogs/${blogHandle}/articles/${articleHandle}`,
  );
}

/** Create an article. 409 on duplicate handle. */
export async function createArticle(
  storeId: string,
  blogHandle: string,
  data: CreateArticleInput,
): Promise<Article> {
  return apiClient<Article>(`/stores/${storeId}/blogs/${blogHandle}/articles`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update an article — any subset, incl. {status, scheduled_at} lifecycle
 *  transitions and {handle} renames. */
export async function updateArticle(
  storeId: string,
  blogHandle: string,
  articleHandle: string,
  data: UpdateArticleInput,
): Promise<Article> {
  return apiClient<Article>(
    `/stores/${storeId}/blogs/${blogHandle}/articles/${articleHandle}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

/** Delete an article by handle. */
export async function deleteArticle(
  storeId: string,
  blogHandle: string,
  articleHandle: string,
): Promise<void> {
  await apiClient<void>(
    `/stores/${storeId}/blogs/${blogHandle}/articles/${articleHandle}`,
    { method: "DELETE" },
  );
}
