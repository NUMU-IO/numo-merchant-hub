import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Globe, Lock, Palette, ScrollText, Settings2, Truck, Upload } from "lucide-react";

const StoreSettings = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [storeOnline, setStoreOnline] = useState(true);
  const [layoutStyle, setLayoutStyle] = useState("grid");
  const [policyTab, setPolicyTab] = useState("return");

  const save = () => toast.success(t("store.saved"));

  const tabs = [
    { value: "profile", label: t("store.profile"), icon: Settings2 },
    { value: "customization", label: t("store.customization"), icon: Palette },
    { value: "domain", label: t("store.domain"), icon: Globe },
    { value: "policies", label: t("store.policies"), icon: ScrollText },
    { value: "status", label: t("store.status"), icon: Lock },
    { value: "shipping", label: t("store.shipping"), icon: Truck },
  ];

  const [zones] = useState([
    { name: "Cairo", nameAr: "القاهرة", rate: 35, freeAbove: 500, days: "1-2" },
    { name: "Alexandria", nameAr: "الإسكندرية", rate: 50, freeAbove: 700, days: "2-3" },
    { name: "Upper Egypt", nameAr: "صعيد مصر", rate: 75, freeAbove: 1000, days: "3-5" },
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("store.title")}</h1>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-2 data-[state=active]:bg-muted"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.profile")}</CardTitle>
              <CardDescription>{language === "ar" ? "معلومات متجرك الأساسية" : "Basic store information"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted text-2xl">🏪</div>
                <Button variant="outline" size="sm" className="gap-2"><Upload className="h-4 w-4" />{t("store.uploadLogo")}</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("store.storeName")}</Label>
                  <Input defaultValue={language === "ar" ? "متجر نومو" : "NUMU Store"} />
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.contactEmail")}</Label>
                  <Input defaultValue="store@numu.com" />
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.contactPhone")}</Label>
                  <Input defaultValue="+201012345678" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t("store.storeDescription")}</Label>
                <Textarea defaultValue={language === "ar" ? "متجر منتجات مصرية أصيلة" : "Authentic Egyptian products store"} rows={3} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>{t("store.facebook")}</Label>
                  <Input placeholder="facebook.com/..." />
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.instagram")}</Label>
                  <Input placeholder="instagram.com/..." />
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.twitter")}</Label>
                  <Input placeholder="x.com/..." />
                </div>
              </div>
              <Button onClick={save}>{t("store.save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customization */}
        <TabsContent value="customization">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.customization")}</CardTitle>
              <CardDescription>{language === "ar" ? "خصص مظهر متجرك" : "Customize your store appearance"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("store.primaryColor")}</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" defaultValue="#1e293b" className="h-10 w-14 rounded-md border border-input cursor-pointer" />
                    <Input defaultValue="#1e293b" className="font-mono" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.accentColor")}</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" defaultValue="#3b82f6" className="h-10 w-14 rounded-md border border-input cursor-pointer" />
                    <Input defaultValue="#3b82f6" className="font-mono" />
                  </div>
                </div>
              </div>
              <div className="grid gap-2 max-w-xs">
                <Label>{t("store.fontFamily")}</Label>
                <Select defaultValue="inter">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter">Inter</SelectItem>
                    <SelectItem value="cairo">Cairo</SelectItem>
                    <SelectItem value="poppins">Poppins</SelectItem>
                    <SelectItem value="tajawal">Tajawal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("store.heroBanner")}</Label>
                <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted">
                  <Button variant="outline" size="sm" className="gap-2"><Upload className="h-4 w-4" />{t("store.uploadBanner")}</Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t("store.layoutStyle")}</Label>
                <div className="flex gap-2">
                  <Button variant={layoutStyle === "grid" ? "default" : "outline"} size="sm" onClick={() => setLayoutStyle("grid")}>
                    {t("store.grid")}
                  </Button>
                  <Button variant={layoutStyle === "list" ? "default" : "outline"} size="sm" onClick={() => setLayoutStyle("list")}>
                    {t("store.list")}
                  </Button>
                </div>
              </div>
              {/* Preview Mock */}
              <div className="rounded-xl border bg-muted/50 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">{t("store.preview")}</p>
                <div className={`gap-3 ${layoutStyle === "grid" ? "grid grid-cols-3" : "space-y-2"}`}>
                  {["👕", "👜", "🧴"].map((emoji) => (
                    <div key={emoji} className={`rounded-lg border bg-card p-3 text-center ${layoutStyle === "list" ? "flex items-center gap-3 text-start" : ""}`}>
                      <span className="text-2xl">{emoji}</span>
                      <div className={layoutStyle === "list" ? "" : "mt-1"}>
                        <p className="text-xs font-medium">{language === "ar" ? "منتج" : "Product"}</p>
                        <p className="text-xs text-muted-foreground">{language === "ar" ? "٣٤٩ ج.م" : "EGP 349"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={save}>{t("store.save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domain */}
        <TabsContent value="domain">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.domain")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>{t("store.subdomain")}</Label>
                <div className="flex items-center gap-2">
                  <Input defaultValue="mystore" className="max-w-[200px]" />
                  <span className="text-sm text-muted-foreground">.numu.com</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t("store.customDomain")}</Label>
                <Input placeholder={t("store.customDomainPlaceholder")} className="max-w-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Label>{t("store.sslStatus")}</Label>
                <Badge variant="secondary" className="bg-primary/10 text-primary">{t("store.sslActive")}</Badge>
              </div>
              <Button onClick={save}>{t("store.save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.policies")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={policyTab} onValueChange={setPolicyTab}>
                <TabsList>
                  <TabsTrigger value="return">{t("store.returnPolicy")}</TabsTrigger>
                  <TabsTrigger value="shipping">{t("store.shippingPolicy")}</TabsTrigger>
                  <TabsTrigger value="privacy">{t("store.privacyPolicy")}</TabsTrigger>
                  <TabsTrigger value="terms">{t("store.termsOfService")}</TabsTrigger>
                </TabsList>
              </Tabs>
              <Textarea
                rows={8}
                placeholder={language === "ar" ? "اكتب السياسة هنا..." : "Write your policy here..."}
                defaultValue={
                  policyTab === "return"
                    ? language === "ar" ? "يمكنك إرجاع المنتجات خلال ١٤ يوماً من تاريخ الاستلام..." : "You can return products within 14 days of receiving them..."
                    : ""
                }
              />
              <Button onClick={save}>{t("store.save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.status")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{t("store.storeStatus")}</p>
                  <p className="text-sm text-muted-foreground">
                    {storeOnline ? t("store.online") : t("store.offline")}
                  </p>
                </div>
                <Switch checked={storeOnline} onCheckedChange={setStoreOnline} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">{t("store.createdAt")}</p>
                  <p className="font-medium mt-1">Jan 15, 2026</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">{t("store.plan")}</p>
                  <Badge className="mt-1">Pro</Badge>
                </div>
              </div>
              <Button onClick={save}>{t("store.save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shipping */}
        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.shipping")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("store.zone")}</TableHead>
                    <TableHead>{t("store.rate")} ({t("common.currency")})</TableHead>
                    <TableHead>{t("store.freeThreshold")} ({t("common.currency")})</TableHead>
                    <TableHead>{t("store.estimatedDays")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((z) => (
                    <TableRow key={z.name}>
                      <TableCell className="font-medium">{language === "ar" ? z.nameAr : z.name}</TableCell>
                      <TableCell><Input type="number" defaultValue={z.rate} className="w-24" /></TableCell>
                      <TableCell><Input type="number" defaultValue={z.freeAbove} className="w-24" /></TableCell>
                      <TableCell>{z.days}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button onClick={save}>{t("store.save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StoreSettings;
