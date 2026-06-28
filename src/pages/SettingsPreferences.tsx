import { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
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
import { showError } from "@/lib/show-error";
import { QRCodeSVG } from "qrcode.react";
import {
  Settings2, Globe, CreditCard, Shield, Zap, Monitor, User,
  Moon, Sun, Loader2, ExternalLink, Key, Webhook,
  Plus, Trash2, Copy, Eye, EyeOff, CheckCircle2,
  Smartphone, QrCode, ShieldCheck, X, AlertTriangle,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { enable2FA, verify2FA, disable2FA, get2FAStatus, type Enable2FAData, type TwoFactorStatus } from "@/services/mfaApi";
import { changePassword } from "@/services/authApi";

// --- 2FA Setup Dialog ---
function TwoFactorSetupDialog({
  open, onOpenChange, onEnabled, isAr,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; onEnabled: () => void; isAr: boolean;
}) {
  const [step, setStep] = useState<"intro" | "qr" | "verify" | "done">("intro");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<Enable2FAData | null>(null);
  const [error, setError] = useState("");

  const handleStartSetup = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await enable2FA();
      setSetupData(data);
      setStep("qr");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isAr ? "فشل بدء الإعداد" : "Failed to start setup"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error(isAr ? "أدخل الرمز المكون من 6 أرقام" : "Enter a 6-digit code");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const result = await verify2FA(code);
      if (result.verified) {
        setStep("done");
        onEnabled();
        toast.success(isAr ? "تم تفعيل المصادقة الثنائية" : "2FA enabled successfully");
      } else {
        setError(isAr ? "الرمز غير صحيح" : "Invalid code. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isAr ? "فشل التحقق" : "Verification failed"));
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setStep("intro"); setCode(""); setSetupData(null); setError(""); }, 300);
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      toast.success(isAr ? "تم النسخ" : "Copied!");
    }
  };

  const copyBackupCodes = () => {
    if (setupData?.backup_codes) {
      navigator.clipboard.writeText(setupData.backup_codes.join("\n"));
      toast.success(isAr ? "تم نسخ رموز النسخ الاحتياطي" : "Backup codes copied!");
    }
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

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

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

        {step === "qr" && setupData && (
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="rounded-xl bg-white p-3 border shadow-sm">
                <QRCodeSVG value={setupData.provisioning_uri} size={160} level="M" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground text-center">
                {isAr ? "أو أدخل المفتاح يدوياً:" : "Or enter the key manually:"}
              </p>
              <div className="flex items-center gap-2 justify-center">
                <code className="text-xs font-mono bg-muted/60 rounded-lg px-3 py-1.5 tracking-wider select-all">
                  {setupData.secret}
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copySecret}>
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
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground text-center">
                {isAr ? "أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة" : "Enter the 6-digit code from your authenticator app"}
              </p>
            </div>
          </div>
        )}

        {step === "done" && setupData && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium">{isAr ? "تم التفعيل بنجاح!" : "Successfully Enabled!"}</p>
            </div>
            {/* Backup codes */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {isAr ? "رموز النسخ الاحتياطي" : "Backup Codes"}
                </p>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={copyBackupCodes}>
                  <Copy className="h-2.5 w-2.5" />{isAr ? "نسخ" : "Copy"}
                </Button>
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-500">
                {isAr ? "احفظ هذه الرموز في مكان آمن. لن تظهر مرة أخرى!" : "Save these codes somewhere safe. They won't be shown again!"}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {setupData.backup_codes.map((bc) => (
                  <code key={bc} className="text-[11px] font-mono bg-white dark:bg-background rounded px-2 py-1 text-center border">
                    {bc}
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "intro" && (
            <Button onClick={handleStartSetup} disabled={loading} size="sm" className="gap-1.5 rounded-lg">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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

// --- Main Settings Preferences Page ---
const VALID_SECTIONS = ["general", "billing", "api", "security", "display"] as const;
type PrefSection = (typeof VALID_SECTIONS)[number];

export default function SettingsPreferences() {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";

  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = (searchParams.get("section") ?? "general") as PrefSection;
  const [activeSection, setActiveSectionState] = useState<PrefSection>(
    VALID_SECTIONS.includes(initialSection) ? initialSection : "general",
  );

  const setActiveSection = useCallback(
    (section: string) => {
      const next = (VALID_SECTIONS.includes(section as PrefSection)
        ? section
        : "general") as PrefSection;
      setActiveSectionState(next);
      const params = new URLSearchParams(searchParams);
      params.set("section", next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Keep state in sync when the URL changes externally (e.g. sidebar click).
  useEffect(() => {
    const qsSection = searchParams.get("section");
    if (qsSection && VALID_SECTIONS.includes(qsSection as PrefSection) && qsSection !== activeSection) {
      setActiveSectionState(qsSection as PrefSection);
    }
  }, [searchParams, activeSection]);

  // 2FA state
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFactorStatus | null>(null);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  const twoFAEnabled = twoFAStatus?.is_enabled ?? false;

  useEffect(() => {
    get2FAStatus().then(setTwoFAStatus).catch(() => {});
  }, []);

  // Sessions / Activity state
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [revokePassword, setRevokePassword] = useState("");
  const [revokeNewPassword, setRevokeNewPassword] = useState("");
  const [revokingAll, setRevokingAll] = useState(false);

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

  const handle2FAToggle = useCallback(() => {
    if (twoFAEnabled) {
      setShowDisableDialog(true);
    } else {
      setShow2FADialog(true);
    }
  }, [twoFAEnabled]);

  const handleDisable2FA = useCallback(async () => {
    if (!disablePassword) {
      toast.error(isAr ? "أدخل كلمة المرور" : "Enter your password");
      return;
    }
    setDisabling2FA(true);
    try {
      await disable2FA(disablePassword);
      setTwoFAStatus(prev => prev ? { ...prev, is_enabled: false, method: null } : prev);
      toast.success(isAr ? "تم إلغاء المصادقة الثنائية" : "2FA disabled");
      setShowDisableDialog(false);
      setDisablePassword("");
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setDisabling2FA(false);
    }
  }, [disablePassword, isAr]);

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
        <SettingsBreadcrumb current={isAr ? "التفضيلات" : "Preferences"} />
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "التفضيلات" : "Preferences"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{isAr ? "إدارة إعدادات حسابك ومتجرك" : "Manage your account and store settings"}</p>
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
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => setShowSessionsDialog(true)}>
                    {isAr ? "عرض الجلسات" : "View Sessions"}
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px]">{isAr ? "سجل النشاط" : "Activity Log"}</Label>
                    <p className="text-[11px] text-muted-foreground">{isAr ? "آخر الأنشطة على حسابك" : "Recent account activity"}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => setShowActivityDialog(true)}>
                    {isAr ? "عرض السجل" : "View Log"}
                  </Button>
                </div>
              </CardContent>

              <TwoFactorSetupDialog
                open={show2FADialog}
                onOpenChange={setShow2FADialog}
                onEnabled={() => setTwoFAStatus(prev => prev ? { ...prev, is_enabled: true, method: "totp" } : prev)}
                isAr={isAr}
              />

              {/* Disable 2FA Dialog */}
              <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-destructive" />
                      {isAr ? "إلغاء المصادقة الثنائية" : "Disable 2FA"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {isAr ? "أدخل كلمة المرور للتأكيد" : "Enter your password to confirm"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2">
                    <Input
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      placeholder={isAr ? "كلمة المرور" : "Password"}
                      className="h-9 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setShowDisableDialog(false); setDisablePassword(""); }}>
                      {isAr ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-1.5 rounded-lg" onClick={handleDisable2FA} disabled={disabling2FA || !disablePassword}>
                      {disabling2FA && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {isAr ? "إلغاء 2FA" : "Disable 2FA"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Active Sessions Dialog */}
              <Dialog open={showSessionsDialog} onOpenChange={(v) => { setShowSessionsDialog(v); if (!v) { setRevokePassword(""); setRevokeNewPassword(""); } }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-blue-600" />
                      {isAr ? "الجلسات النشطة" : "Active Sessions"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {isAr ? "إدارة جلسات تسجيل الدخول الخاصة بك" : "Manage your login sessions"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    {/* Current session */}
                    <div className="rounded-lg border p-3 bg-primary/5 border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-primary" />
                          <span className="text-[13px] font-medium">{isAr ? "الجلسة الحالية" : "Current Session"}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {isAr ? "نشطة" : "Active"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {navigator.userAgent.includes("Chrome") ? "Chrome" : navigator.userAgent.includes("Firefox") ? "Firefox" : navigator.userAgent.includes("Safari") ? "Safari" : "Browser"} — {navigator.platform || "Unknown OS"}
                      </p>
                    </div>

                    <Separator />

                    {/* Revoke all sessions */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          {isAr ? "إنهاء جميع الجلسات الأخرى" : "Revoke All Other Sessions"}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {isAr
                          ? "سيتم تسجيل خروجك من جميع الأجهزة الأخرى. يتطلب تغيير كلمة المرور."
                          : "You'll be logged out of all other devices. This requires changing your password."}
                      </p>
                      <div className="space-y-2">
                        <Input
                          type="password"
                          value={revokePassword}
                          onChange={(e) => setRevokePassword(e.target.value)}
                          placeholder={isAr ? "كلمة المرور الحالية" : "Current password"}
                          className="h-8 text-xs"
                          dir="ltr"
                        />
                        <Input
                          type="password"
                          value={revokeNewPassword}
                          onChange={(e) => setRevokeNewPassword(e.target.value)}
                          placeholder={isAr ? "كلمة مرور جديدة" : "New password"}
                          className="h-8 text-xs"
                          dir="ltr"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full h-8 text-xs gap-1.5 rounded-lg"
                        disabled={revokingAll || !revokePassword || !revokeNewPassword}
                        onClick={async () => {
                          if (revokeNewPassword.length < 8) {
                            toast.error(isAr ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "New password must be at least 8 characters");
                            return;
                          }
                          setRevokingAll(true);
                          try {
                            await changePassword(revokePassword, revokeNewPassword);
                            toast.success(isAr ? "تم إنهاء جميع الجلسات الأخرى" : "All other sessions revoked");
                            setShowSessionsDialog(false);
                            setRevokePassword("");
                            setRevokeNewPassword("");
                          } catch (err: unknown) {
                            showError(err, language);
                          } finally {
                            setRevokingAll(false);
                          }
                        }}
                      >
                        {revokingAll && <Loader2 className="h-3 w-3 animate-spin" />}
                        {isAr ? "إنهاء الجلسات وتغيير كلمة المرور" : "Revoke Sessions & Change Password"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Activity Log Dialog */}
              <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      {isAr ? "سجل النشاط" : "Activity Log"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {isAr ? "آخر أنشطة الأمان على حسابك" : "Recent security activity on your account"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
                    {/* Account creation */}
                    {user?.created_at && (
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium">{isAr ? "إنشاء الحساب" : "Account Created"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(user.created_at).toLocaleString(isAr ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Email verified */}
                    {user?.is_verified && (
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium">{isAr ? "تم تأكيد البريد الإلكتروني" : "Email Verified"}</p>
                          <p className="text-[11px] text-muted-foreground">{isAr ? "تم التحقق من عنوان البريد" : "Email address has been verified"}</p>
                        </div>
                      </div>
                    )}

                    {/* 2FA enabled */}
                    {twoFAStatus?.enabled_at && (
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium">{isAr ? "تفعيل المصادقة الثنائية" : "2FA Enabled"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(twoFAStatus.enabled_at).toLocaleString(isAr ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 2FA last used */}
                    {twoFAStatus?.last_used_at && (
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 shrink-0 mt-0.5">
                          <Key className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium">{isAr ? "آخر استخدام للمصادقة الثنائية" : "Last 2FA Verification"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(twoFAStatus.last_used_at).toLocaleString(isAr ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Current login */}
                    <div className="flex items-start gap-3 rounded-lg border p-3 bg-primary/5 border-primary/20">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                        <Monitor className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">{isAr ? "الجلسة الحالية" : "Current Login Session"}</p>
                        <p className="text-[11px] text-muted-foreground">{isAr ? "نشطة الآن" : "Active now"}</p>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
