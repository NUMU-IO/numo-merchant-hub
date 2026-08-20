import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  listBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
  listArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  type Blog,
  type Article,
  type ArticleStatus,
  type CreateArticleInput,
  type UpdateArticleInput,
} from "@/services/blogsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  Newspaper, FileText, Plus, MoreHorizontal, Pencil, Trash2,
  Eye, EyeOff, Globe, Loader2, ExternalLink, Archive,
  ArchiveRestore, CalendarClock, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";
import { getPublicStoreHost, getPublicStoreUrl } from "@/lib/storefront";

function makeSlug(title: string) {
  return title.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/** ISO datetime → value for an <input type="datetime-local"> (local time). */
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseTags(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Local editing shape for a blog (flattened from the API's bilingual maps). */
interface BlogDraft {
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  isPublished: boolean;
  /** Set when editing (blog handles are immutable after creation). */
  originalHandle?: string;
}

function blogToDraft(b?: Blog): BlogDraft {
  return {
    originalHandle: b?.handle,
    titleEn: b?.title?.en ?? "",
    titleAr: b?.title?.ar ?? "",
    descEn: b?.description?.en ?? "",
    descAr: b?.description?.ar ?? "",
    isPublished: b?.is_published ?? true,
  };
}

/** Local editing shape for an article (flattened from the API's bilingual maps). */
interface ArticleDraft {
  handle: string;
  titleEn: string;
  titleAr: string;
  excerptEn: string;
  excerptAr: string;
  bodyEn: string;
  bodyAr: string;
  imageUrl: string;
  author: string;
  /** Comma-separated in the UI, string[] on the wire. */
  tagsText: string;
  seoTitleEn: string;
  seoTitleAr: string;
  seoDescEn: string;
  seoDescAr: string;
  /** Current lifecycle status (display only — buttons drive transitions). */
  status: ArticleStatus;
  /** datetime-local value; converted to ISO Z on "Schedule". */
  scheduleLocal: string;
  /** Original handle when editing (so we PATCH the right key). */
  originalHandle?: string;
}

function articleToDraft(a?: Article): ArticleDraft {
  return {
    originalHandle: a?.handle,
    handle: a?.handle ?? "",
    titleEn: a?.title?.en ?? "",
    titleAr: a?.title?.ar ?? "",
    excerptEn: a?.excerpt?.en ?? "",
    excerptAr: a?.excerpt?.ar ?? "",
    bodyEn: a?.body?.en ?? "",
    bodyAr: a?.body?.ar ?? "",
    imageUrl: a?.image_url ?? "",
    author: a?.author ?? "",
    tagsText: (a?.tags ?? []).join(", "),
    seoTitleEn: a?.seo?.title?.en ?? "",
    seoTitleAr: a?.seo?.title?.ar ?? "",
    seoDescEn: a?.seo?.description?.en ?? "",
    seoDescAr: a?.seo?.description?.ar ?? "",
    status: a?.status ?? "draft",
    scheduleLocal: toLocalInput(a?.scheduled_at),
  };
}

/** Which lifecycle action a save was triggered with. */
type SaveIntent = "draft" | "publish" | "schedule" | "archive";

const INTENT_STATUS: Record<SaveIntent, ArticleStatus> = {
  draft: "draft",
  publish: "published",
  schedule: "scheduled",
  archive: "archived",
};

const INTENT_TOAST: Record<SaveIntent, string> = {
  draft: "blog.toastDraft",
  publish: "blog.toastPublished",
  schedule: "blog.toastScheduled",
  archive: "blog.toastArchived",
};

const STATUS_FILTERS = ["all", "draft", "scheduled", "published", "archived"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function OnlineStoreBlog() {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id ?? "";
  const locale = isRTL ? "ar-EG" : "en-US";

  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [blogEditing, setBlogEditing] = useState<BlogDraft | null>(null);
  const [articleEditing, setArticleEditing] = useState<ArticleDraft | null>(null);
  const [deleteBlogTarget, setDeleteBlogTarget] = useState<Blog | null>(null);
  const [deleteArticleTarget, setDeleteArticleTarget] = useState<Article | null>(null);

  const { data: blogs = [], isLoading: blogsLoading } = useQuery({
    queryKey: ["blogs", storeId],
    queryFn: () => listBlogs(storeId),
    enabled: !!storeId,
  });

  const selectedBlog: Blog | null =
    (selectedHandle ? blogs.find((b) => b.handle === selectedHandle) : undefined) ??
    blogs[0] ??
    null;

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["blog-articles", storeId, selectedBlog?.handle ?? "", statusFilter],
    queryFn: () =>
      listArticles(
        storeId,
        selectedBlog!.handle,
        statusFilter === "all" ? {} : { status: statusFilter },
      ),
    enabled: !!storeId && !!selectedBlog,
  });

  const invalidateBlogs = () =>
    queryClient.invalidateQueries({ queryKey: ["blogs", storeId] });
  const invalidateArticles = () =>
    queryClient.invalidateQueries({ queryKey: ["blog-articles", storeId] });

  // ─── Blog mutations ────────────────────────────────────────────────────
  const saveBlogMutation = useMutation({
    mutationFn: async (d: BlogDraft) => {
      const payload = {
        title: { en: d.titleEn, ar: d.titleAr },
        description: { en: d.descEn, ar: d.descAr },
        is_published: d.isPublished,
      };
      if (d.originalHandle) {
        return updateBlog(storeId, d.originalHandle, payload);
      }
      const handle = makeSlug(d.titleEn) || `blog-${Date.now()}`;
      return createBlog(storeId, { handle, ...payload });
    },
    onSuccess: (blog, d) => {
      invalidateBlogs();
      toast.success(t("blog.blogSaved"));
      if (!d.originalHandle && blog?.handle) setSelectedHandle(blog.handle);
      setBlogEditing(null);
    },
    onError: (err) => showError(err, language),
  });

  // One-click "News / الأخبار" starter blog from the empty state.
  const starterMutation = useMutation({
    mutationFn: () =>
      createBlog(storeId, {
        handle: "news",
        title: { en: "News", ar: "الأخبار" },
        description: { en: "", ar: "" },
        is_published: true,
      }),
    onSuccess: (blog) => {
      invalidateBlogs();
      toast.success(t("blog.blogSaved"));
      if (blog?.handle) setSelectedHandle(blog.handle);
    },
    onError: (err) => showError(err, language),
  });

  const toggleBlogPublish = useMutation({
    mutationFn: (b: Blog) =>
      updateBlog(storeId, b.handle, { is_published: !b.is_published }),
    onSuccess: () => invalidateBlogs(),
    onError: (err) => showError(err, language),
  });

  const deleteBlogMutation = useMutation({
    mutationFn: (handle: string) => deleteBlog(storeId, handle),
    onSuccess: (_res, handle) => {
      invalidateBlogs();
      invalidateArticles();
      toast.success(t("blog.blogDeleted"));
      if (selectedHandle === handle) setSelectedHandle(null);
      setDeleteBlogTarget(null);
    },
    onError: (err) => showError(err, language),
  });

  // ─── Article mutations ─────────────────────────────────────────────────
  const saveArticleMutation = useMutation({
    mutationFn: async ({ d, intent }: { d: ArticleDraft; intent: SaveIntent }) => {
      if (!selectedBlog) throw new Error("No blog selected");
      const imageUrl = d.imageUrl.trim();
      const author = d.author.trim();
      const common = {
        title: { en: d.titleEn, ar: d.titleAr },
        excerpt: { en: d.excerptEn, ar: d.excerptAr },
        body: { en: d.bodyEn, ar: d.bodyAr },
        tags: parseTags(d.tagsText),
        seo: {
          title: { en: d.seoTitleEn, ar: d.seoTitleAr },
          description: { en: d.seoDescEn, ar: d.seoDescAr },
        },
        status: INTENT_STATUS[intent],
        ...(intent === "schedule"
          ? { scheduled_at: new Date(d.scheduleLocal).toISOString() }
          : {}),
      };
      if (d.originalHandle) {
        const newHandle = d.handle.trim();
        const patch: UpdateArticleInput = {
          ...common,
          image_url: imageUrl || null,
          author: author || null,
          ...(newHandle && newHandle !== d.originalHandle ? { handle: newHandle } : {}),
        };
        return updateArticle(storeId, selectedBlog.handle, d.originalHandle, patch);
      }
      const create: CreateArticleInput = {
        ...common,
        status: INTENT_STATUS[intent] as CreateArticleInput["status"],
        ...(d.handle.trim() ? { handle: d.handle.trim() } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(author ? { author } : {}),
      };
      return createArticle(storeId, selectedBlog.handle, create);
    },
    onSuccess: (_res, { intent }) => {
      invalidateArticles();
      invalidateBlogs(); // article_count may have changed
      toast.success(t(INTENT_TOAST[intent]));
      setArticleEditing(null);
    },
    onError: (err) => showError(err, language),
  });

  // Row-level lifecycle shortcuts (publish now / archive / restore to draft).
  const quickStatusMutation = useMutation({
    mutationFn: ({ article, status }: { article: Article; status: ArticleStatus }) => {
      if (!selectedBlog) throw new Error("No blog selected");
      return updateArticle(storeId, selectedBlog.handle, article.handle, { status });
    },
    onSuccess: (_res, { status }) => {
      invalidateArticles();
      toast.success(
        t(
          status === "published"
            ? "blog.toastPublished"
            : status === "archived"
              ? "blog.toastArchived"
              : "blog.toastRestored",
        ),
      );
    },
    onError: (err) => showError(err, language),
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (article: Article) => {
      if (!selectedBlog) throw new Error("No blog selected");
      return deleteArticle(storeId, selectedBlog.handle, article.handle);
    },
    onSuccess: () => {
      invalidateArticles();
      invalidateBlogs();
      toast.success(t("blog.toastDeleted"));
      setDeleteArticleTarget(null);
    },
    onError: (err) => showError(err, language),
  });

  const blogTitle = (b: Blog) =>
    (isRTL && b.title?.ar ? b.title.ar : b.title?.en) || b.handle;
  const articleTitle = (a: Article) =>
    (isRTL && a.title?.ar ? a.title.ar : a.title?.en || a.title?.ar) ||
    t("blog.untitled");

  const storeUrl = getPublicStoreUrl(currentStore);
  const saving = saveArticleMutation.isPending;
  const articleValid = !!articleEditing?.titleEn.trim();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
            {t("blog.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("blog.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setBlogEditing(blogToDraft())}>
          <Plus className="h-3.5 w-3.5 me-1.5" />
          {t("blog.newBlog")}
        </Button>
      </div>

      <HelpTip title={t("blog.helpTitle")}>
        <ul className="list-inside list-disc space-y-1">
          <li>{t("blog.help1")}</li>
          <li>{t("blog.help2")}</li>
          <li>{t("blog.help3")}</li>
          <li>{t("blog.help4")}</li>
        </ul>
      </HelpTip>

      {/* Blogs list */}
      {blogsLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : blogs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-muted/10 px-4 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Newspaper className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="mb-1 text-sm font-semibold">{t("blog.emptyTitle")}</p>
          <p className="mb-5 max-w-xs text-xs text-muted-foreground">
            {t("blog.emptyDesc")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() => starterMutation.mutate()}
              disabled={starterMutation.isPending}
            >
              {starterMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Newspaper className="h-3.5 w-3.5 me-1.5" />
              )}
              {t("blog.emptyStarter")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBlogEditing(blogToDraft())}>
              <Plus className="h-3.5 w-3.5 me-1.5" />
              {t("blog.newBlog")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {blogs.map((blog) => (
              <BlogRow
                key={blog.id}
                blog={blog}
                title={blogTitle(blog)}
                selected={selectedBlog?.handle === blog.handle}
                t={t}
                onSelect={() => {
                  setSelectedHandle(blog.handle);
                  setStatusFilter("all");
                }}
                onEdit={() => setBlogEditing(blogToDraft(blog))}
                onToggle={() => toggleBlogPublish.mutate(blog)}
                onDelete={() => setDeleteBlogTarget(blog)}
              />
            ))}
          </div>

          {/* Selected blog's articles */}
          {selectedBlog && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-bold leading-tight tracking-tight">
                  {t("blog.articlesHeading")}
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
                    {blogTitle(selectedBlog)}
                  </span>
                </h2>
                <Button size="sm" variant="outline" onClick={() => setArticleEditing(articleToDraft())}>
                  <Plus className="h-3.5 w-3.5 me-1.5" />
                  {t("blog.newArticle")}
                </Button>
              </div>

              {/* Status filter chips */}
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      statusFilter === f
                        ? "border-foreground bg-foreground text-background"
                        : "bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {f === "all" ? t("blog.filterAll") : t(`blog.status.${f}`)}
                  </button>
                ))}
              </div>

              {articlesLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : articles.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed bg-muted/10 px-4 py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="mb-1 text-sm font-semibold">
                    {statusFilter === "all"
                      ? t("blog.noArticlesTitle")
                      : t("blog.noArticlesFiltered")}
                  </p>
                  <p className="mb-4 max-w-xs text-xs text-muted-foreground">
                    {statusFilter === "all"
                      ? t("blog.noArticlesDesc")
                      : t("blog.noArticlesFilteredDesc")}
                  </p>
                  {statusFilter === "all" && (
                    <Button size="sm" onClick={() => setArticleEditing(articleToDraft())}>
                      <Plus className="h-3.5 w-3.5 me-1.5" />
                      {t("blog.writeFirst")}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                  {articles.map((article) => (
                    <ArticleRow
                      key={article.id}
                      article={article}
                      title={articleTitle(article)}
                      blogHandle={selectedBlog.handle}
                      storeUrl={storeUrl}
                      locale={locale}
                      t={t}
                      onEdit={() => setArticleEditing(articleToDraft(article))}
                      onPublish={() =>
                        quickStatusMutation.mutate({ article, status: "published" })
                      }
                      onArchive={() =>
                        quickStatusMutation.mutate({ article, status: "archived" })
                      }
                      onRestore={() =>
                        quickStatusMutation.mutate({ article, status: "draft" })
                      }
                      onDelete={() => setDeleteArticleTarget(article)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create / edit blog dialog */}
      <Dialog open={blogEditing !== null} onOpenChange={(o) => !o && setBlogEditing(null)}>
        <DialogContent className="sm:max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {blogEditing?.originalHandle ? t("blog.editBlogTitle") : t("blog.newBlogTitle")}
            </DialogTitle>
          </DialogHeader>

          {blogEditing && (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {t("blog.blogTitleEn")}
                    <span className="ms-0.5 text-destructive">*</span>
                  </Label>
                  <Input
                    value={blogEditing.titleEn}
                    onChange={(e) => setBlogEditing({ ...blogEditing, titleEn: e.target.value })}
                    placeholder={t("blog.phBlogTitleEn")}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.blogTitleAr")}</Label>
                  <Input
                    dir="rtl"
                    value={blogEditing.titleAr}
                    onChange={(e) => setBlogEditing({ ...blogEditing, titleAr: e.target.value })}
                    placeholder={t("blog.phBlogTitleAr")}
                  />
                </div>
              </div>

              {/* Handle preview (create) / immutable handle (edit) */}
              {blogEditing.originalHandle ? (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span className="opacity-60">/blogs/</span>
                  <span className="font-medium text-foreground/70">{blogEditing.originalHandle}</span>
                  <span className="ms-1">— {t("blog.handleImmutable")}</span>
                </p>
              ) : (
                blogEditing.titleEn && (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span className="opacity-60">
                      {getPublicStoreHost(currentStore) ?? "yourstore.numueg.app"}/blogs/
                    </span>
                    <span className="font-medium text-foreground/70">
                      {makeSlug(blogEditing.titleEn) || "—"}
                    </span>
                  </p>
                )
              )}

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.blogDescEn")}</Label>
                  <Textarea
                    value={blogEditing.descEn}
                    onChange={(e) => setBlogEditing({ ...blogEditing, descEn: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.blogDescAr")}</Label>
                  <Textarea
                    dir="rtl"
                    value={blogEditing.descAr}
                    onChange={(e) => setBlogEditing({ ...blogEditing, descAr: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Published toggle */}
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{t("blog.publishedLabel")}</p>
                  <p className="text-[11px] text-muted-foreground">{t("blog.publishedDesc")}</p>
                </div>
                <Switch
                  checked={blogEditing.isPublished}
                  onCheckedChange={(v) => setBlogEditing({ ...blogEditing, isPublished: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlogEditing(null)}>
              {t("blog.cancel")}
            </Button>
            <Button
              onClick={() => blogEditing && saveBlogMutation.mutate(blogEditing)}
              disabled={!blogEditing?.titleEn.trim() || saveBlogMutation.isPending}
            >
              {saveBlogMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              )}
              {blogEditing?.originalHandle ? t("blog.saveBlog") : t("blog.createBlog")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / edit article dialog */}
      <Dialog open={articleEditing !== null} onOpenChange={(o) => !o && setArticleEditing(null)}>
        <DialogContent className="sm:max-w-2xl" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {articleEditing?.originalHandle ? t("blog.editArticle") : t("blog.newArticleTitle")}
            </DialogTitle>
          </DialogHeader>

          {articleEditing && (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {t("blog.articleTitleEn")}
                    <span className="ms-0.5 text-destructive">*</span>
                  </Label>
                  <Input
                    value={articleEditing.titleEn}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, titleEn: e.target.value })
                    }
                    placeholder={t("blog.phTitleEn")}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.articleTitleAr")}</Label>
                  <Input
                    dir="rtl"
                    value={articleEditing.titleAr}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, titleAr: e.target.value })
                    }
                    placeholder={t("blog.phTitleAr")}
                  />
                </div>
              </div>

              {/* Handle: auto-derived on create, renameable on edit */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("blog.articleHandle")}</Label>
                <Input
                  dir="ltr"
                  value={articleEditing.handle}
                  onChange={(e) =>
                    setArticleEditing({ ...articleEditing, handle: e.target.value })
                  }
                  placeholder={makeSlug(articleEditing.titleEn) || "my-first-article"}
                />
                {articleEditing.originalHandle &&
                articleEditing.handle.trim() &&
                articleEditing.handle.trim() !== articleEditing.originalHandle ? (
                  <p className="text-[11px] text-muted-foreground">{t("blog.renameHint")}</p>
                ) : (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span className="opacity-60">
                      /blogs/{selectedBlog?.handle ?? "blog"}/
                    </span>
                    <span className="font-medium text-foreground/70">
                      {articleEditing.handle.trim() ||
                        makeSlug(articleEditing.titleEn) ||
                        "…"}
                    </span>
                    {!articleEditing.originalHandle && (
                      <span className="ms-1">— {t("blog.articleHandleHint")}</span>
                    )}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.excerptEn")}</Label>
                  <Textarea
                    value={articleEditing.excerptEn}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, excerptEn: e.target.value })
                    }
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.excerptAr")}</Label>
                  <Textarea
                    dir="rtl"
                    value={articleEditing.excerptAr}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, excerptAr: e.target.value })
                    }
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.bodyEn")}</Label>
                  <Textarea
                    value={articleEditing.bodyEn}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, bodyEn: e.target.value })
                    }
                    rows={8}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.bodyAr")}</Label>
                  <Textarea
                    dir="rtl"
                    value={articleEditing.bodyAr}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, bodyAr: e.target.value })
                    }
                    rows={8}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.imageUrl")}</Label>
                  <Input
                    dir="ltr"
                    value={articleEditing.imageUrl}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, imageUrl: e.target.value })
                    }
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("blog.author")}</Label>
                  <Input
                    value={articleEditing.author}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, author: e.target.value })
                    }
                    placeholder={t("blog.phAuthor")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("blog.tags")}</Label>
                <Input
                  value={articleEditing.tagsText}
                  onChange={(e) =>
                    setArticleEditing({ ...articleEditing, tagsText: e.target.value })
                  }
                  placeholder={t("blog.phTags")}
                />
                <p className="text-[11px] text-muted-foreground">{t("blog.tagsHint")}</p>
              </div>

              {/* SEO */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("blog.seoHeading")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("blog.seoTitleEn")}</Label>
                    <Input
                      value={articleEditing.seoTitleEn}
                      onChange={(e) =>
                        setArticleEditing({ ...articleEditing, seoTitleEn: e.target.value })
                      }
                      placeholder={articleEditing.titleEn}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("blog.seoTitleAr")}</Label>
                    <Input
                      dir="rtl"
                      value={articleEditing.seoTitleAr}
                      onChange={(e) =>
                        setArticleEditing({ ...articleEditing, seoTitleAr: e.target.value })
                      }
                      placeholder={articleEditing.titleAr}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("blog.seoDescEn")}</Label>
                    <Textarea
                      value={articleEditing.seoDescEn}
                      onChange={(e) =>
                        setArticleEditing({ ...articleEditing, seoDescEn: e.target.value })
                      }
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("blog.seoDescAr")}</Label>
                    <Textarea
                      dir="rtl"
                      value={articleEditing.seoDescAr}
                      onChange={(e) =>
                        setArticleEditing({ ...articleEditing, seoDescAr: e.target.value })
                      }
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Publishing */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("blog.publishing")}
                  </p>
                  <StatusBadge status={articleEditing.status} t={t} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("blog.scheduleAt")}</Label>
                  <Input
                    type="datetime-local"
                    dir="ltr"
                    value={articleEditing.scheduleLocal}
                    onChange={(e) =>
                      setArticleEditing({ ...articleEditing, scheduleLocal: e.target.value })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">{t("blog.scheduleHint")}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex items-center gap-1">
              {articleEditing?.originalHandle && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={saving}
                    onClick={() => {
                      const target = articles.find(
                        (a) => a.handle === articleEditing.originalHandle,
                      );
                      if (target) {
                        setArticleEditing(null);
                        setDeleteArticleTarget(target);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 me-1.5" />
                    {t("blog.actions.delete")}
                  </Button>
                  {articleEditing.status !== "archived" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        saveArticleMutation.mutate({ d: articleEditing, intent: "archive" })
                      }
                    >
                      <Archive className="h-3.5 w-3.5 me-1.5" />
                      {t("blog.actions.archive")}
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setArticleEditing(null)}>
                {t("blog.cancel")}
              </Button>
              <Button
                variant="outline"
                disabled={!articleValid || saving}
                onClick={() =>
                  articleEditing &&
                  saveArticleMutation.mutate({ d: articleEditing, intent: "draft" })
                }
              >
                {t("blog.actions.saveDraft")}
              </Button>
              <Button
                variant="outline"
                disabled={!articleValid || !articleEditing?.scheduleLocal || saving}
                onClick={() =>
                  articleEditing &&
                  saveArticleMutation.mutate({ d: articleEditing, intent: "schedule" })
                }
              >
                <CalendarClock className="h-3.5 w-3.5 me-1.5" />
                {t("blog.actions.schedule")}
              </Button>
              <Button
                disabled={!articleValid || saving}
                onClick={() =>
                  articleEditing &&
                  saveArticleMutation.mutate({ d: articleEditing, intent: "publish" })
                }
              >
                {saving && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
                {t("blog.actions.publishNow")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete blog confirmation */}
      <Dialog open={!!deleteBlogTarget} onOpenChange={(o) => !o && setDeleteBlogTarget(null)}>
        <DialogContent className="sm:max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("blog.deleteBlog")}</DialogTitle>
            <DialogDescription>
              {t("blog.deleteBlogConfirm", {
                name: deleteBlogTarget ? blogTitle(deleteBlogTarget) : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBlogTarget(null)}>
              {t("blog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteBlogTarget && deleteBlogMutation.mutate(deleteBlogTarget.handle)}
              disabled={deleteBlogMutation.isPending}
            >
              {t("blog.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete article confirmation */}
      <Dialog
        open={!!deleteArticleTarget}
        onOpenChange={(o) => !o && setDeleteArticleTarget(null)}
      >
        <DialogContent className="sm:max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("blog.deleteArticle")}</DialogTitle>
            <DialogDescription>
              {t("blog.deleteArticleConfirm", {
                name: deleteArticleTarget ? articleTitle(deleteArticleTarget) : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteArticleTarget(null)}>
              {t("blog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteArticleTarget && deleteArticleMutation.mutate(deleteArticleTarget)
              }
              disabled={deleteArticleMutation.isPending}
            >
              {t("blog.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────
const STATUS_BADGE_CLASSES: Record<ArticleStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  archived: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

function StatusBadge({
  status, t,
}: {
  status: ArticleStatus; t: (key: string) => string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        STATUS_BADGE_CLASSES[status],
      )}
    >
      {t(`blog.status.${status}`)}
    </span>
  );
}

// ─── Blog row ────────────────────────────────────────────────────────────────
function BlogRow({
  blog, title, selected, t, onSelect, onEdit, onToggle, onDelete,
}: {
  blog: Blog; title: string; selected: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onSelect: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20",
        selected && "bg-muted/30",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            selected ? "bg-foreground text-background" : "bg-muted",
          )}
        >
          <Newspaper
            className={cn("h-3.5 w-3.5", !selected && "text-muted-foreground")}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium leading-tight">{title}</span>
            {blog.is_published ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                <Globe className="h-2.5 w-2.5" />
                {t("blog.visible")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60">
                <EyeOff className="h-2.5 w-2.5" />
                {t("blog.hidden")}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <Globe className="h-2.5 w-2.5" />
              /blogs/{blog.handle}
            </span>
            <span>·</span>
            <span>{t("blog.articleCount", { count: blog.article_count })}</span>
          </p>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 me-2" />
            {t("blog.blogSettings")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggle}>
            {blog.is_published
              ? <><EyeOff className="h-3.5 w-3.5 me-2" />{t("blog.hide")}</>
              : <><Eye className="h-3.5 w-3.5 me-2" />{t("blog.show")}</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 me-2" />
            {t("blog.deleteBlog")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Article row ─────────────────────────────────────────────────────────────
function ArticleRow({
  article, title, blogHandle, storeUrl, locale, t,
  onEdit, onPublish, onArchive, onRestore, onDelete,
}: {
  article: Article; title: string; blogHandle: string;
  storeUrl: string | null; locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onEdit: () => void; onPublish: () => void; onArchive: () => void;
  onRestore: () => void; onDelete: () => void;
}) {
  const dateLine =
    article.status === "published" && article.published_at
      ? t("blog.publishedOn", {
          date: new Date(article.published_at).toLocaleDateString(locale, {
            day: "numeric", month: "short", year: "numeric",
          }),
        })
      : article.status === "scheduled" && article.scheduled_at
        ? t("blog.scheduledFor", {
            date: new Date(article.scheduled_at).toLocaleString(locale, {
              day: "numeric", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            }),
          })
        : t("blog.updatedOn", {
            date: new Date(article.updated_at).toLocaleDateString(locale, {
              day: "numeric", month: "short", year: "numeric",
            }),
          });

  const viewUrl =
    storeUrl && article.status === "published"
      ? `${storeUrl.replace(/\/+$/, "")}/blogs/${blogHandle}/${article.handle}`
      : null;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium leading-tight">{title}</span>
            <StatusBadge status={article.status} t={t} />
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <Globe className="h-2.5 w-2.5" />
              /{article.handle}
            </span>
            <span>·</span>
            <span>{dateLine}</span>
          </p>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 me-2" />
            {t("blog.edit")}
          </DropdownMenuItem>
          {viewUrl && (
            <DropdownMenuItem
              onClick={() => window.open(viewUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-3.5 w-3.5 me-2" />
              {t("blog.actions.viewOnStore")}
            </DropdownMenuItem>
          )}
          {article.status !== "published" && (
            <DropdownMenuItem onClick={onPublish}>
              <Send className="h-3.5 w-3.5 me-2" />
              {t("blog.actions.publishNow")}
            </DropdownMenuItem>
          )}
          {article.status === "archived" ? (
            <DropdownMenuItem onClick={onRestore}>
              <ArchiveRestore className="h-3.5 w-3.5 me-2" />
              {t("blog.actions.restore")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-3.5 w-3.5 me-2" />
              {t("blog.actions.archive")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 me-2" />
            {t("blog.actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
