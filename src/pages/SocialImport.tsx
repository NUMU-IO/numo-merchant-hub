import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { socialAccounts, socialPosts, type SocialPost, type SocialAccount } from "@/data/mock-social";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Instagram, Facebook, Link2, Link2Off, Heart, MessageCircle, Download, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const SocialImport = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [accounts, setAccounts] = useState<SocialAccount[]>(socialAccounts);
  const [posts, setPosts] = useState<SocialPost[]>(socialPosts);
  const [platformFilter, setPlatformFilter] = useState<"all" | "instagram" | "facebook">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const filtered = platformFilter === "all" ? posts : posts.filter(p => p.platform === platformFilter);
  const importable = filtered.filter(p => !p.imported);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = importable.map(p => p.id);
    setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids));
  };

  const handleConnect = (accountId: string) => {
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, connected: !a.connected } : a));
    const acc = accounts.find(a => a.id === accountId);
    toast.success(acc?.connected
      ? (language === "ar" ? "تم قطع الاتصال" : "Disconnected")
      : (language === "ar" ? "تم الربط بنجاح!" : "Connected successfully!")
    );
  };

  const handleImport = () => {
    if (selected.size === 0) return;
    setPosts(prev => prev.map(p => selected.has(p.id) ? { ...p, imported: true } : p));
    toast.success(language === "ar"
      ? `تم استيراد ${selected.size} منتج بنجاح!`
      : `${selected.size} product(s) imported successfully!`
    );
    setSelected(new Set());
  };

  const PlatformIcon = ({ platform }: { platform: string }) =>
    platform === "instagram" ? <Instagram className="h-4 w-4" /> : <Facebook className="h-4 w-4" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("social.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("social.subtitle")}</p>
      </div>

      {/* Connected Accounts */}
      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.map(acc => (
          <Card key={acc.id} className={acc.connected ? "border-primary/30" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
                  {acc.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={acc.platform} />
                    <span className="font-semibold truncate">{acc.handle}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {acc.followers.toLocaleString()} {language === "ar" ? "متابع" : "followers"} · {acc.posts} {language === "ar" ? "بوست" : "posts"}
                  </p>
                </div>
                <Button
                  variant={acc.connected ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleConnect(acc.id)}
                  className="gap-1.5 shrink-0"
                >
                  {acc.connected ? <Link2Off className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  {acc.connected ? t("social.disconnect") : t("social.connect")}
                </Button>
              </div>
              {acc.connected && (
                <Badge variant="secondary" className="mt-3 bg-primary/10 text-primary">
                  <CheckCircle2 className="h-3 w-3 me-1" />
                  {t("social.connected")}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Posts Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">{t("social.recentPosts")}</CardTitle>
            <div className="flex items-center gap-2">
              <Tabs value={platformFilter} onValueChange={(v) => setPlatformFilter(v as "all" | "instagram" | "facebook")}>
                <TabsList>
                  <TabsTrigger value="all">{t("social.all")}</TabsTrigger>
                  <TabsTrigger value="instagram" className="gap-1.5">
                    <Instagram className="h-3.5 w-3.5" />
                    Instagram
                  </TabsTrigger>
                  <TabsTrigger value="facebook" className="gap-1.5">
                    <Facebook className="h-3.5 w-3.5" />
                    Facebook
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={importable.length > 0 && selected.size === importable.length}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selected.size > 0
                  ? (language === "ar" ? `${selected.size} محدد` : `${selected.size} selected`)
                  : (language === "ar" ? "اختر الكل" : "Select all")
                }
              </span>
            </div>
            {selected.size > 0 && (
              <Button onClick={handleImport} size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                {t("social.importSelected")} ({selected.size})
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(post => (
              <div
                key={post.id}
                className={`group relative rounded-xl border p-3 transition-all hover:shadow-md ${
                  post.imported ? "bg-muted/50 opacity-75" : selected.has(post.id) ? "border-primary ring-1 ring-primary/20" : "border-border"
                }`}
              >
                {!post.imported && (
                  <div className="absolute top-3 start-3 z-10">
                    <Checkbox
                      checked={selected.has(post.id)}
                      onCheckedChange={() => toggleSelect(post.id)}
                    />
                  </div>
                )}

                {/* Image placeholder */}
                <div className="flex h-32 items-center justify-center rounded-lg bg-muted text-4xl mb-3">
                  {post.imageEmoji}
                </div>

                {/* Platform badge */}
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="gap-1 text-xs">
                    <PlatformIcon platform={post.platform} />
                    {post.platform === "instagram" ? "IG" : "FB"}
                  </Badge>
                  {post.imported && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                      <CheckCircle2 className="h-3 w-3 me-1" />
                      {t("social.imported")}
                    </Badge>
                  )}
                </div>

                {/* Caption */}
                <p className="text-sm line-clamp-2 mb-2">
                  {language === "ar" ? post.captionAr : post.caption}
                </p>

                {/* Suggested product info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="font-medium text-foreground">{formatCurrency(post.suggestedPrice)}</span>
                  <span>{post.date}</span>
                </div>

                {/* Engagement */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {post.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {post.comments}</span>
                </div>

                {/* Quick import button */}
                {!post.imported && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, imported: true } : p));
                      toast.success(language === "ar" ? "تم الاستيراد!" : "Imported!");
                    }}
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
    </div>
  );
};

export default SocialImport;
