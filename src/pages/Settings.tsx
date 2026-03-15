import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Settings2, Globe, CreditCard, Shield, Zap, Monitor,
  Moon, Sun, Loader2, ExternalLink, Key, Database, Webhook,
} from "lucide-react";

export default function Settings() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";

  const [activeSection, setActiveSection] = useState("general");

  const sections = [
    { id: "general", label: isAr ? "عام" : "General", icon: Settings2 },
    { id: "billing", label: isAr ? "الفواتير" : "Billing", icon: CreditCard },
    { id: "api", label: isAr ? "API" : "API & Webhooks", icon: Key },
    { id: "security", label: isAr ? "الأمان" : "Security", icon: Shield },
    { id: "display", label: isAr ? "العرض" : "Display", icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {isAr ? "الإعدادات" : "Settings"}
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {isAr ? "إدارة إعدادات حسابك ومتجرك" : "Manage your account and store settings"}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Nav */}
        <nav className="hidden md:flex flex-col gap-0.5 w-48 shrink-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors text-start ${
                activeSection === s.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        {/* Mobile Nav */}
        <div className="flex md:hidden gap-0.5 rounded-lg bg-muted/60 p-0.5 w-full overflow-x-auto">
          {sections.map(s => (
            <Button
              key={s.id}
              variant={activeSection === s.id ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs px-2.5 rounded-md gap-1 shrink-0"
              onClick={() => setActiveSection(s.id)}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl space-y-5">
          {activeSection === "general" && (
            <>
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm">{isAr ? "الإعدادات العامة" : "General Settings"}</CardTitle>
                  <CardDescription className="text-xs">{isAr ? "الإعدادات الأساسية لحسابك" : "Basic account settings"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium">{isAr ? "اللغة الافتراضية" : "Default Language"}</Label>
                    <Select defaultValue={language}>
                      <SelectTrigger className="h-9 text-sm w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium">{isAr ? "المنطقة الزمنية" : "Timezone"}</Label>
                    <Select defaultValue="Africa/Cairo">
                      <SelectTrigger className="h-9 text-sm w-full sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Africa/Cairo">(UTC+02:00) Cairo</SelectItem>
                        <SelectItem value="Asia/Riyadh">(UTC+03:00) Riyadh</SelectItem>
                        <SelectItem value="Asia/Dubai">(UTC+04:00) Dubai</SelectItem>
                        <SelectItem value="Europe/London">(UTC+00:00) London</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium">{isAr ? "العملة الافتراضية" : "Default Currency"}</Label>
                    <Select defaultValue={currentStore?.default_currency || "EGP"}>
                      <SelectTrigger className="h-9 text-sm w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EGP">EGP - {isAr ? "جنيه مصري" : "Egyptian Pound"}</SelectItem>
                        <SelectItem value="SAR">SAR - {isAr ? "ريال سعودي" : "Saudi Riyal"}</SelectItem>
                        <SelectItem value="AED">AED - {isAr ? "درهم إماراتي" : "UAE Dirham"}</SelectItem>
                        <SelectItem value="USD">USD - {isAr ? "دولار أمريكي" : "US Dollar"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === "billing" && (
            <>
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                      <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{isAr ? "الخطة الحالية" : "Current Plan"}</CardTitle>
                      <CardDescription className="text-xs">{isAr ? "إدارة اشتراكك" : "Manage your subscription"}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{isAr ? "خطة المبتدئ" : "Starter Plan"}</p>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {isAr ? "نشط" : "Active"}
                        </Badge>
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-1">
                        {user?.trial_ends_at
                          ? `${isAr ? "الفترة التجريبية تنتهي في" : "Trial ends"} ${new Date(user.trial_ends_at).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}`
                          : (isAr ? "لا توجد فترة تجريبية" : "No trial period")}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs">
                      <Zap className="h-3 w-3" />
                      {isAr ? "ترقية" : "Upgrade"}
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{isAr ? "سجل الفواتير" : "Billing History"}</p>
                    <p className="text-[12px] text-muted-foreground/60">{isAr ? "لا توجد فواتير بعد" : "No invoices yet"}</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === "api" && (
            <>
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                      <Key className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{isAr ? "مفاتيح API" : "API Keys"}</CardTitle>
                      <CardDescription className="text-xs">{isAr ? "إدارة مفاتيح الوصول" : "Manage your access keys"}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-medium">{isAr ? "مفتاح الإنتاج" : "Production Key"}</p>
                      <Badge variant="outline" className="text-[10px]">{isAr ? "مباشر" : "Live"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value="numu_live_••••••••••••••••" disabled className="h-8 text-xs font-mono bg-muted/40" />
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg shrink-0">
                        {isAr ? "نسخ" : "Copy"}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-medium">{isAr ? "مفتاح الاختبار" : "Test Key"}</p>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">{isAr ? "اختبار" : "Test"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value="numu_test_••••••••••••••••" disabled className="h-8 text-xs font-mono bg-muted/40" />
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg shrink-0">
                        {isAr ? "نسخ" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                      <Webhook className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Webhooks</CardTitle>
                      <CardDescription className="text-xs">{isAr ? "إرسال أحداث لتطبيقات خارجية" : "Send events to external applications"}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[12px] text-muted-foreground">{isAr ? "لم يتم إعداد أي webhook بعد" : "No webhooks configured yet"}</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5 rounded-lg text-xs">
                    {isAr ? "إضافة Webhook" : "Add Webhook"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === "security" && (
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
                    <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{isAr ? "الأمان" : "Security"}</CardTitle>
                    <CardDescription className="text-xs">{isAr ? "حماية حسابك" : "Protect your account"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "المصادقة الثنائية" : "Two-Factor Authentication"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "طبقة حماية إضافية" : "Add an extra layer of security"}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">
                    {isAr ? "غير مفعل" : "Not enabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "جلسات نشطة" : "Active Sessions"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "إدارة الأجهزة المتصلة" : "Manage connected devices"}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg">
                    {isAr ? "عرض الجلسات" : "View Sessions"}
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "سجل النشاط" : "Activity Log"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "آخر الأنشطة على حسابك" : "Recent account activity"}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg">
                    {isAr ? "عرض السجل" : "View Log"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "display" && (
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                    <Monitor className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{isAr ? "إعدادات العرض" : "Display Settings"}</CardTitle>
                    <CardDescription className="text-xs">{isAr ? "تخصيص مظهر لوحة التحكم" : "Customize your dashboard appearance"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "الوضع الداكن" : "Dark Mode"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "تبديل المظهر الداكن والفاتح" : "Toggle between dark and light theme"}</p>
                  </div>
                  <Switch
                    checked={document.documentElement.classList.contains("dark")}
                    onCheckedChange={(v) => {
                      document.documentElement.classList.toggle("dark", v);
                      localStorage.setItem("theme", v ? "dark" : "light");
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "حجم الخط" : "Font Size"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "حجم الخط في لوحة التحكم" : "Dashboard text size"}</p>
                  </div>
                  <Select defaultValue="default">
                    <SelectTrigger className="h-8 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">{isAr ? "صغير" : "Small"}</SelectItem>
                      <SelectItem value="default">{isAr ? "عادي" : "Default"}</SelectItem>
                      <SelectItem value="large">{isAr ? "كبير" : "Large"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "الرسوم المتحركة" : "Animations"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "تفعيل الحركات في الواجهة" : "Enable interface animations"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}