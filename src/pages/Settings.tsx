import { useState, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Settings2, Globe, CreditCard, Shield, Zap, Monitor,
  Moon, Sun, Loader2, ExternalLink, Key, Webhook,
  Plus, Trash2, Copy, Eye, EyeOff, CheckCircle2,
  Smartphone, QrCode, ShieldCheck, X,
} from "lucide-react";

// --- 2FA Setup Dialog ---
function TwoFactorSetupDialog({
  open, onOpenChange, onEnabled, isAr,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; onEnabled: () => void; isAr: boolean;
}) {
  const [step, setStep] = useState<"intro" | "qr" | "verify" | "done">("intro");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error(isAr ? "أدخل الرمز المكون من 6 أرقام" : "Enter a 6-digit code");
      return;
    }
    setVerifying(true);
    await new Promise(r => setTimeout(r, 1200));
    setVerifying(false);
    setStep("done");
    toast.success(isAr ? "تم تفعيل المصادقة الثنائية" : "2FA enabled successfully");
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setStep("intro"); setCode(""); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {isAr ? "تفعيل المصادقة الثنائية" : "Enable Two-Factor Authentication"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "intro" && (isAr ? "أضف طبقة حماية إضافية لحسابك" : "Add an extra layer of security to your account")}
            {step === "qr" && (isAr ? "امسح رمز QR باستخدام تطبيق المصادقة" : "Scan the QR code with your authenticator app")}
            {step === "verify" && (isAr ? "أدخل الرمز من تطبيق المصادقة" : "Enter the code from your authenticator app")}
            {step === "done" && (isAr ? "تم تفعيل المصادقة الثنائية بنجاح" : "Two-factor authentication is now enabled")}
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-medium">{isAr ? "الخطوة 1" : "Step 1"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "حمّل تطبيق المصادقة مثل Google Authenticator أو Authy" : "Download an authenticator app like Google Authenticator or Authy"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <QrCode className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-medium">{isAr ? "الخطوة 2" : "Step 2"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "امسح رمز QR لربط حسابك" : "Scan a QR code to link your account"}
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "qr" && (
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="h-40 w-40 rounded-xl bg-muted/60 border-2 border-dashed border-border flex items-center justify-center">
                <QrCode className="h-16 w-16 text-muted-foreground/40" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground text-center">
                {isAr ? "أو أدخل المفتاح يدوياً:" : "Or enter the key manually:"}
              </p>
              <div className="flex items-center gap-2 justify-center">
                <code className="text-xs font-mono bg-muted/60 rounded-lg px-3 py-1.5 tracking-wider">
                  NUMU-XXXX-XXXX-XXXX
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.success(isAr ? "تم النسخ" : "Copied!")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">{isAr ? "رمز التحقق" : "Verification Code"}</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-10 text-center text-lg font-mono tracking-[0.5em] max-w-48 mx-auto"
                maxLength={6}
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                {isAr ? "أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة" : "Enter the 6-digit code from your authenticator app"}
              </p>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium">{isAr ? "تم التفعيل بنجاح!" : "Successfully Enabled!"}</p>
            <p className="text-xs text-muted-foreground text-center max-w-[280px]">
              {isAr ? "حسابك الآن محمي بالمصادقة الثنائية" : "Your account is now protected with two-factor authentication"}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "intro" && (
            <Button onClick={() => setStep("qr")} size="sm" className="gap-1.5 rounded-lg">
              {isAr ? "متابعة" : "Continue"}
            </Button>
          )}
          {step === "qr" && (
            <Button onClick={() => setStep("verify")} size="sm" className="gap-1.5 rounded-lg">
              {isAr ? "التالي" : "Next"}
            </Button>
          )}
          {step === "verify" && (
            <Button onClick={handleVerify} disabled={verifying || code.length !== 6} size="sm" className="gap-1.5 rounded-lg">
              {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isAr ? "تحقق وتفعيل" : "Verify & Enable"}
            </Button>
          )}
          {step === "done" && (
            <Button onClick={handleClose} size="sm" className="rounded-lg">
              {isAr ? "تم" : "Done"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Webhook Types ---
interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

const WEBHOOK_EVENTS = [
  { value: "order.created", label: "Order Created", labelAr: "طلب جديد" },
  { value: "order.updated", label: "Order Updated", labelAr: "تحديث طلب" },
  { value: "order.cancelled", label: "Order Cancelled", labelAr: "إلغاء طلب" },
  { value: "payment.received", label: "Payment Received", labelAr: "دفعة مستلمة" },
  { value: "payment.failed", label: "Payment Failed", labelAr: "فشل الدفع" },
  { value: "product.created", label: "Product Created", labelAr: "منتج جديد" },
  { value: "product.updated", label: "Product Updated", labelAr: "تحديث منتج" },
  { value: "customer.created", label: "Customer Created", labelAr: "عميل جديد" },
];

// --- Add Webhook Dialog ---
function AddWebhookDialog({
  open, onOpenChange, onAdd, isAr,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; onAdd: (w: WebhookEntry) => void; isAr: boolean;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleEvent = (ev: string) => {
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  const handleSave = async () => {
    if (!url.startsWith("http")) {
      toast.error(isAr ? "أدخل رابط صالح" : "Enter a valid URL");
      return;
    }
    if (events.length === 0) {
      toast.error(isAr ? "اختر حدث واحد على الأقل" : "Select at least one event");
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    onAdd({
      id: crypto.randomUUID(),
      url,
      events,
      active: true,
      createdAt: new Date().toISOString(),
    });
    toast.success(isAr ? "تمت إضافة Webhook" : "Webhook added");
    setUrl("");
    setEvents([]);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4 text-blue-600" />
            {isAr ? "إضافة Webhook" : "Add Webhook"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isAr ? "إرسال أحداث لتطبيقات خارجية تلقائياً" : "Automatically send events to external applications"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label className="text-xs font-medium">Endpoint URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="h-9 text-sm font-mono"
              dir="ltr"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-medium">{isAr ? "الأحداث" : "Events"}</Label>
            <div className="grid gap-1.5 max-h-48 overflow-y-auto rounded-lg border p-3">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev.value} className="flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={events.includes(ev.value)}
                    onCheckedChange={() => toggleEvent(ev.value)}
                  />
                  <span className="text-[13px]">{isAr ? ev.labelAr : ev.label}</span>
                  <code className="text-[10px] text-muted-foreground font-mono ml-auto">{ev.value}</code>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-lg">
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 rounded-lg">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isAr ? "إضافة" : "Add Webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Settings Page ---
export default function Settings() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";

  const [activeSection, setActiveSection] = useState("general");

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([
    {
      id: "wh-1",
      url: "https://api.example.com/numu-events",
      events: ["order.created", "payment.received"],
      active: true,
      createdAt: "2026-02-15T10:00:00Z",
    },
  ]);
  const [showAddWebhook, setShowAddWebhook] = useState(false);

  // API key visibility
  const [showLiveKey, setShowLiveKey] = useState(false);
  const [showTestKey, setShowTestKey] = useState(false);

  const handle2FAToggle = useCallback(async () => {
    if (twoFAEnabled) {
      setDisabling2FA(true);
      await new Promise(r => setTimeout(r, 800));
      setTwoFAEnabled(false);
      setDisabling2FA(false);
      toast.success(isAr ? "تم إلغاء المصادقة الثنائية" : "2FA disabled");
    } else {
      setShow2FADialog(true);
    }
  }, [twoFAEnabled, isAr]);

  const handleDeleteWebhook = useCallback((id: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== id));
    toast.success(isAr ? "تم حذف Webhook" : "Webhook deleted");
  }, [isAr]);

  const handleToggleWebhook = useCallback((id: string) => {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w));
  }, []);

  const sections = [
    { id: "general", label: isAr ? "عام" : "General", icon: Settings2 },
    { id: "billing", label: isAr ? "الفواتير" : "Billing", icon: CreditCard },
    { id: "api", label: isAr ? "API" : "API & Webhooks", icon: Key },
    { id: "security", label: isAr ? "الأمان" : "Security", icon: Shield },
    { id: "display", label: isAr ? "العرض" : "Display", icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{isAr ? "الإعدادات" : "Settings"}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">{isAr ? "إدارة إعدادات حسابك ومتجرك" : "Manage your account and store settings"}</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Nav */}
        <nav className="hidden md:flex flex-col gap-0.5 w-48 shrink-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors text-start ${
                activeSection === s.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
          {/* GENERAL */}
          {activeSection === "general" && (
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm">{isAr ? "الإعدادات العامة" : "General Settings"}</CardTitle>
                <CardDescription className="text-xs">{isAr ? "الإعدادات الأساسية لحسابك" : "Basic account settings"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-medium">{isAr ? "اللغة الافتراضية" : "Default Language"}</Label>
                  <Select defaultValue={language}>
                    <SelectTrigger className="h-9 text-sm w-full sm:w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-medium">{isAr ? "المنطقة الزمنية" : "Timezone"}</Label>
                  <Select defaultValue="Africa/Cairo">
                    <SelectTrigger className="h-9 text-sm w-full sm:w-64"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="h-9 text-sm w-full sm:w-48"><SelectValue /></SelectTrigger>
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
          )}

          {/* BILLING */}
          {activeSection === "billing" && (
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
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">{isAr ? "نشط" : "Active"}</Badge>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {user?.trial_ends_at
                        ? `${isAr ? "الفترة التجريبية تنتهي في" : "Trial ends"} ${new Date(user.trial_ends_at).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}`
                        : (isAr ? "لا توجد فترة تجريبية" : "No trial period")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs">
                    <Zap className="h-3 w-3" />{isAr ? "ترقية" : "Upgrade"}
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{isAr ? "سجل الفواتير" : "Billing History"}</p>
                  <p className="text-[12px] text-muted-foreground/60">{isAr ? "لا توجد فواتير بعد" : "No invoices yet"}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* API & WEBHOOKS */}
          {activeSection === "api" && (
            <>
              {/* API Keys */}
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
                  {/* Live Key */}
                  <div className="rounded-xl border p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-medium">{isAr ? "مفتاح الإنتاج" : "Production Key"}</p>
                      <Badge variant="outline" className="text-[10px]">{isAr ? "مباشر" : "Live"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={showLiveKey ? "numu_live_sk_a1b2c3d4e5f6g7h8" : "numu_live_••••••••••••••••"}
                        disabled
                        className="h-8 text-xs font-mono bg-muted/40"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowLiveKey(v => !v)}>
                        {showLiveKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg shrink-0 gap-1" onClick={() => toast.success(isAr ? "تم النسخ" : "Copied!")}>
                        <Copy className="h-3 w-3" />{isAr ? "نسخ" : "Copy"}
                      </Button>
                    </div>
                  </div>
                  {/* Test Key */}
                  <div className="rounded-xl border p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-medium">{isAr ? "مفتاح الاختبار" : "Test Key"}</p>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">{isAr ? "اختبار" : "Test"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={showTestKey ? "numu_test_sk_z9y8x7w6v5u4t3s2" : "numu_test_••••••••••••••••"}
                        disabled
                        className="h-8 text-xs font-mono bg-muted/40"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowTestKey(v => !v)}>
                        {showTestKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg shrink-0 gap-1" onClick={() => toast.success(isAr ? "تم النسخ" : "Copied!")}>
                        <Copy className="h-3 w-3" />{isAr ? "نسخ" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Webhooks */}
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                        <Webhook className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">Webhooks</CardTitle>
                        <CardDescription className="text-xs">{isAr ? "إرسال أحداث لتطبيقات خارجية" : "Send events to external apps"}</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs" onClick={() => setShowAddWebhook(true)}>
                      <Plus className="h-3 w-3" />{isAr ? "إضافة" : "Add"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {webhooks.length === 0 ? (
                    <div className="text-center py-8">
                      <Webhook className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-[12px] text-muted-foreground">{isAr ? "لم يتم إعداد أي webhook بعد" : "No webhooks configured yet"}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {webhooks.map((wh) => (
                        <div key={wh.id} className="rounded-xl border p-4 bg-muted/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <code className="text-xs font-mono text-foreground truncate max-w-[300px]">{wh.url}</code>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Switch checked={wh.active} onCheckedChange={() => handleToggleWebhook(wh.id)} />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteWebhook(wh.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {wh.events.map(ev => (
                              <Badge key={ev} variant="secondary" className="text-[10px] font-mono">
                                {ev}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {isAr ? "أُنشئ في" : "Created"} {new Date(wh.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <AddWebhookDialog
                open={showAddWebhook}
                onOpenChange={setShowAddWebhook}
                onAdd={(w) => setWebhooks(prev => [...prev, w])}
                isAr={isAr}
              />
            </>
          )}

          {/* SECURITY */}
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
                {/* 2FA - Interactive */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "المصادقة الثنائية" : "Two-Factor Authentication"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "طبقة حماية إضافية" : "Add an extra layer of security"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {twoFAEnabled ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {isAr ? "مفعّل" : "Enabled"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">
                        {isAr ? "غير مفعل" : "Not enabled"}
                      </Badge>
                    )}
                    <Button
                      variant={twoFAEnabled ? "outline" : "default"}
                      size="sm"
                      className="h-7 text-[11px] rounded-lg gap-1"
                      onClick={handle2FAToggle}
                      disabled={disabling2FA}
                    >
                      {disabling2FA && <Loader2 className="h-3 w-3 animate-spin" />}
                      {twoFAEnabled ? (isAr ? "إلغاء" : "Disable") : (isAr ? "تفعيل" : "Enable")}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "جلسات نشطة" : "Active Sessions"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "إدارة الأجهزة المتصلة" : "Manage connected devices"}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg">{isAr ? "عرض الجلسات" : "View Sessions"}</Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "سجل النشاط" : "Activity Log"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "آخر الأنشطة على حسابك" : "Recent account activity"}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg">{isAr ? "عرض السجل" : "View Log"}</Button>
                </div>
              </CardContent>

              <TwoFactorSetupDialog open={show2FADialog} onOpenChange={(v) => { setShow2FADialog(v); if (!v) {} }} isAr={isAr} />
            </Card>
          )}

          {/* DISPLAY */}
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
                    <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
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
