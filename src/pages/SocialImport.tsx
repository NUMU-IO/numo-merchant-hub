import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Instagram,
  Facebook,
  Link2,
  Link2Off,
  Heart,
  MessageCircle,
  Download,
  CheckCircle2,
  LinkIcon,
  Loader2,
  ImageIcon,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  listConnections,
  getAuthUrl,
  completeConnection,
  disconnectAccount,
  fetchPosts,
  importPosts,
  importFromUrl,
  type SocialConnectionResponse,
  type SocialPostResponse,
} from "@/services/socialApi";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const SocialImport = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? "";

  // --- State: connections ---
  const [connections, setConnections] = useState<SocialConnectionResponse[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

  // --- State: posts (from connected accounts) ---
  const [posts, setPosts] = useState<SocialPostResponse[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  // --- State: selection & import ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<"all" | "instagram" | "facebook">("all");

  // --- State: URL import ---
  const [urlInput, setUrlInput] = useState("");
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlResults, setUrlResults] = useState<
    { url: string; name?: string; images?: number; error?: string }[]
  >([]);

  // --- State: connecting account ---
  const [connecting, setConnecting] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  // ---------------------------------------------------------------------------
  // Load connections on mount
  // ---------------------------------------------------------------------------
  const loadConnections = useCallback(async () => {
    if (!storeId) return;
    setLoadingConnections(true);
    try {
      const data = await listConnections(storeId);
      setConnections(data);
      // Auto-select first connection and load posts
      if (data.length > 0 && !activeConnectionId) {
        setActiveConnectionId(data[0].id);
      }
    } catch (err) {
      showError(err, language);
    } finally {
      setLoadingConnections(false);
    }
  }, [storeId, language]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // ---------------------------------------------------------------------------
  // Load posts when active connection changes
  // ---------------------------------------------------------------------------
  const loadPosts = useCallback(async () => {
    if (!storeId || !activeConnectionId) return;
    setLoadingPosts(true);
    setPosts([]);
    try {
      const data = await fetchPosts(storeId, activeConnectionId);
      setPosts(data.posts);
    } catch (err) {
      showError(err, language);
    } finally {
      setLoadingPosts(false);
    }
  }, [storeId, activeConnectionId, language]);

  useEffect(() => {
    if (activeConnectionId) loadPosts();
  }, [activeConnectionId, loadPosts]);

  // ---------------------------------------------------------------------------
  // Check URL for OAuth callback code
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state && storeId) {
      const platform = state.startsWith("instagram") ? "instagram" : "facebook";
      (async () => {
        try {
          await completeConnection(storeId, platform as "instagram" | "facebook", code);
          toast.success(language === "ar" ? "تم الربط بنجاح!" : "Connected successfully!");
          await loadConnections();
        } catch (err) {
          showError(err, language);
        }
        // Clean URL
        window.history.replaceState({}, "", "/social");
      })();
    }
  }, [storeId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleConnect = async (platform: "instagram" | "facebook") => {
    if (!storeId) return;
    setConnecting(platform);
    try {
      const { auth_url } = await getAuthUrl(storeId, platform);
      window.location.href = auth_url;
    } catch (err) {
      showError(err, language);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!storeId) return;
    try {
      await disconnectAccount(storeId, connectionId);
      toast.success(language === "ar" ? "تم قطع الاتصال" : "Disconnected");
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      if (activeConnectionId === connectionId) {
        setActiveConnectionId(null);
        setPosts([]);
      }
    } catch (err) {
      showError(err, language);
    }
  };

  const filtered = platformFilter === "all" ? posts : posts.filter((p) => {
    const conn = connections.find((c) => c.id === activeConnectionId);
    return conn?.platform === platformFilter;
  });
  const importable = filtered.filter((p) => !p.imported);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = importable.map((p) => p.platform_post_id);
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  };

  const handleImport = async () => {
    if (!storeId || !activeConnectionId || selected.size === 0) return;
    setImporting(true);
    try {
      const result = await importPosts(storeId, activeConnectionId, Array.from(selected));
      toast.success(
        language === "ar"
          ? `تم استيراد ${result.imported} منتج بنجاح!`
          : `${result.imported} product(s) imported successfully!`,
      );
      if (result.errors.length > 0) {
        toast.warning(
          language === "ar" ? `${result.errors.length} أخطاء` : `${result.errors.length} error(s)`,
          { description: result.errors[0] },
        );
      }
      setSelected(new Set());
      // Refresh posts to update imported status
      await loadPosts();
    } catch (err) {
      showError(err, language);
    } finally {
      setImporting(false);
    }
  };

  const handleQuickImport = async (postId: string) => {
    if (!storeId || !activeConnectionId) return;
    try {
      await importPosts(storeId, activeConnectionId, [postId]);
      toast.success(language === "ar" ? "تم الاستيراد!" : "Imported!");
      await loadPosts();
    } catch (err) {
      showError(err, language);
    }
  };

  // ---------------------------------------------------------------------------
  // URL Import
  // ---------------------------------------------------------------------------
  const handleUrlImport = async () => {
    if (!storeId) return;
    const urls = urlInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));
    if (urls.length === 0) {
      toast.warning(language === "ar" ? "الصق روابط أولاً" : "Paste URLs first");
      return;
    }
    if (urls.length > 20) {
      toast.warning(language === "ar" ? "الحد الأقصى 20 رابط" : "Maximum 20 URLs per request");
      return;
    }

    setUrlImporting(true);
    setUrlResults([]);
    try {
      const result = await importFromUrl(storeId, urls);
      setUrlResults(
        result.results.map((r) => ({
          url: r.url,
          name: r.product_name ?? undefined,
          images: r.images_count,
          error: r.error ?? undefined,
        })),
      );
      const successCount = result.imported;
      if (successCount > 0) {
        toast.success(
          language === "ar"
            ? `تم استيراد ${successCount} منتج كمسودة!`
            : `${successCount} product(s) imported as drafts!`,
        );
      }
      const errorCount = result.results.filter((r) => r.error).length;
      if (errorCount > 0) {
        toast.warning(
          language === "ar"
            ? `${errorCount} روابط فشلت`
            : `${errorCount} URL(s) failed`,
        );
      }
    } catch (err) {
      showError(err, language);
    } finally {
      setUrlImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const PlatformIcon = ({ platform }: { platform: string }) =>
    platform === "instagram" ? (
      <Instagram className="h-4 w-4" />
    ) : (
      <Facebook className="h-4 w-4" />
    );

  const isConnected = (platform: string) =>
    connections.some((c) => c.platform === platform);

  const getConnection = (platform: string) =>
    connections.find((c) => c.platform === platform);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("social.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("social.subtitle")}</p>
      </div>

      {/* Main Tabs: URL Import (quick) vs Connected Accounts (full) */}
      <Tabs defaultValue="url-import">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="url-import" className="gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" />
            {language === "ar" ? "استيراد بالرابط" : "Paste URLs"}
          </TabsTrigger>
          <TabsTrigger value="connected" className="gap-1.5">
            <Instagram className="h-3.5 w-3.5" />
            {language === "ar" ? "حسابات متصلة" : "Connected Accounts"}
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* TAB 1: URL Import — paste links, no OAuth */}
        {/* ================================================================= */}
        <TabsContent value="url-import" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {language === "ar"
                  ? "استيراد منتجات من روابط انستجرام أو فيسبوك"
                  : "Import products from Instagram or Facebook URLs"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {language === "ar"
                  ? "الصق روابط المنشورات (رابط في كل سطر) — بحد أقصى 20 رابط"
                  : "Paste post URLs (one per line) — max 20 URLs"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={
                  language === "ar"
                    ? "https://www.instagram.com/p/ABC123/\nhttps://www.instagram.com/p/DEF456/"
                    : "https://www.instagram.com/p/ABC123/\nhttps://www.instagram.com/p/DEF456/"
                }
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                rows={5}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleUrlImport}
                disabled={urlImporting || !urlInput.trim()}
                className="gap-1.5"
              >
                {urlImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {urlImporting
                  ? language === "ar"
                    ? "جاري الاستيراد..."
                    : "Importing..."
                  : language === "ar"
                    ? "استيراد كمنتجات مسودة"
                    : "Import as Draft Products"}
              </Button>

              {/* Results */}
              {urlResults.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-sm font-medium">
                    {language === "ar" ? "النتائج" : "Results"}
                  </h4>
                  {urlResults.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                        r.error
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/5 text-primary"
                      }`}
                    >
                      {r.error ? (
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs opacity-60">{r.url}</p>
                        {r.error ? (
                          <p className="mt-0.5">{r.error}</p>
                        ) : (
                          <p className="mt-0.5 font-medium">
                            {r.name}
                            {r.images ? (
                              <span className="ms-2 text-xs opacity-60">
                                <ImageIcon className="h-3 w-3 inline me-0.5" />
                                {r.images} {language === "ar" ? "صور" : "images"}
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: Connected Accounts — OAuth flow */}
        {/* ================================================================= */}
        <TabsContent value="connected" className="space-y-6 mt-4">
          {/* Account Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {(["instagram", "facebook"] as const).map((platform) => {
              const conn = getConnection(platform);
              const connected = !!conn;
              return (
                <Card key={platform} className={connected ? "border-primary/30" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                        <PlatformIcon platform={platform} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={platform} />
                          <span className="font-semibold truncate">
                            {connected
                              ? conn.handle
                              : platform === "instagram"
                                ? "Instagram"
                                : "Facebook"}
                          </span>
                        </div>
                        {connected && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {conn.followers.toLocaleString()}{" "}
                            {language === "ar" ? "متابع" : "followers"} ·{" "}
                            {conn.posts_count} {language === "ar" ? "بوست" : "posts"}
                          </p>
                        )}
                      </div>
                      {connected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(conn.id)}
                          className="gap-1.5 shrink-0"
                        >
                          <Link2Off className="h-3.5 w-3.5" />
                          {t("social.disconnect")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnect(platform)}
                          disabled={connecting === platform}
                          className="gap-1.5 shrink-0"
                        >
                          {connecting === platform ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Link2 className="h-3.5 w-3.5" />
                          )}
                          {t("social.connect")}
                        </Button>
                      )}
                    </div>
                    {connected && (
                      <Badge variant="secondary" className="mt-3 bg-primary/10 text-primary">
                        <CheckCircle2 className="h-3 w-3 me-1" />
                        {t("social.connected")}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* No connections yet */}
          {!loadingConnections && connections.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Instagram className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">
                  {language === "ar"
                    ? "لا يوجد حسابات متصلة"
                    : "No connected accounts"}
                </p>
                <p className="text-sm mt-1">
                  {language === "ar"
                    ? "اربط حسابك على انستجرام أو فيسبوك لاستيراد منتجاتك"
                    : "Connect your Instagram or Facebook to import your products"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Posts Grid */}
          {connections.length > 0 && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{t("social.recentPosts")}</CardTitle>
                      {loadingPosts && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    {connections.length > 1 && (
                      <Tabs
                        value={platformFilter}
                        onValueChange={(v) => setPlatformFilter(v as typeof platformFilter)}
                      >
                        <TabsList>
                          <TabsTrigger value="all">{t("social.all")}</TabsTrigger>
                          <TabsTrigger value="instagram" className="gap-1.5">
                            <Instagram className="h-3.5 w-3.5" />
                            IG
                          </TabsTrigger>
                          <TabsTrigger value="facebook" className="gap-1.5">
                            <Facebook className="h-3.5 w-3.5" />
                            FB
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Bulk Actions */}
                  {importable.length > 0 && (
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={importable.length > 0 && selected.size === importable.length}
                          onCheckedChange={selectAll}
                        />
                        <span className="text-sm text-muted-foreground">
                          {selected.size > 0
                            ? language === "ar"
                              ? `${selected.size} محدد`
                              : `${selected.size} selected`
                            : language === "ar"
                              ? "اختر الكل"
                              : "Select all"}
                        </span>
                      </div>
                      {selected.size > 0 && (
                        <Button onClick={handleImport} size="sm" disabled={importing} className="gap-1.5">
                          {importing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          {t("social.importSelected")} ({selected.size})
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Empty state */}
                  {!loadingPosts && posts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p>{language === "ar" ? "لا يوجد منشورات" : "No posts found"}</p>
                    </div>
                  )}

                  {/* Posts Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((post) => (
                      <div
                        key={post.platform_post_id}
                        className={`group relative rounded-xl border p-3 transition-all hover:shadow-md ${
                          post.imported
                            ? "bg-muted/50 opacity-75"
                            : selected.has(post.platform_post_id)
                              ? "border-primary ring-1 ring-primary/20"
                              : "border-border"
                        }`}
                      >
                        {!post.imported && (
                          <div className="absolute top-3 start-3 z-10">
                            <Checkbox
                              checked={selected.has(post.platform_post_id)}
                              onCheckedChange={() => toggleSelect(post.platform_post_id)}
                            />
                          </div>
                        )}

                        {/* Image */}
                        {post.image_url ? (
                          <div className="h-32 rounded-lg bg-muted mb-3 overflow-hidden">
                            <img
                              src={post.image_url}
                              alt={post.suggested_name || "Post"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg bg-muted mb-3">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}

                        {/* Badges */}
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="gap-1 text-xs">
                            <PlatformIcon
                              platform={
                                connections.find((c) => c.id === activeConnectionId)?.platform ||
                                "instagram"
                              }
                            />
                            {connections.find((c) => c.id === activeConnectionId)?.platform === "facebook"
                              ? "FB"
                              : "IG"}
                          </Badge>
                          {post.imported && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                              <CheckCircle2 className="h-3 w-3 me-1" />
                              {t("social.imported")}
                            </Badge>
                          )}
                        </div>

                        {/* Caption */}
                        <p className="text-sm line-clamp-2 mb-2">{post.caption}</p>

                        {/* Suggested info */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                          {post.suggested_price ? (
                            <span className="font-medium text-foreground">
                              {formatCurrency(post.suggested_price)}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                          <span>
                            {post.posted_at
                              ? new Date(post.posted_at).toLocaleDateString()
                              : ""}
                          </span>
                        </div>

                        {/* Engagement */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" /> {post.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" /> {post.comments}
                          </span>
                        </div>

                        {/* Quick import */}
                        {!post.imported && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleQuickImport(post.platform_post_id)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t("social.quickImport")}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialImport;
