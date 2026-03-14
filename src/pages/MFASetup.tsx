import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import {
  Loader2, ShieldCheck, ShieldOff, Copy, Check, Eye, EyeOff,
  RefreshCw, KeyRound, AlertTriangle, Smartphone,
} from "lucide-react";
import {
  getTwoFactorStatus, enableTwoFactor, verifyTwoFactor,
  disableTwoFactor, regenerateBackupCodes,
  TwoFactorStatus, EnableTwoFactorResponse,
} from "@/services/mfaApi";
import { format } from "date-fns";

// ── QR Code canvas ──

function QRCanvas({ uri }: { uri: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !uri) return;
    QRCode.toCanvas(canvasRef.current, uri, {
      width: 192,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => setError(true));
  }, [uri]);

  if (error) return null;
  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border shadow-sm"
      style={{ width: 192, height: 192 }}
    />
  );
}

// ── Copy button ──

function CopyButton({ text, label, labelCopied, className }: {
  text: string;
  label: string;
  labelCopied: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={handle} className={`gap-1.5 ${className ?? ""}`}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? labelCopied : label}
    </Button>
  );
}

// ── Backup Codes grid ──

function BackupCodesGrid({ codes, isAr }: { codes: string[]; isAr: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{isAr ? "رموز الاستعادة الاحتياطية" : "Backup Codes"}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="sm"
            onClick={() => setRevealed((v) => !v)}
            className="h-7 gap-1.5 text-xs"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? (isAr ? "إخفاء" : "Hide") : (isAr ? "كشف" : "Reveal")}
          </Button>
          <CopyButton
            text={codes.join("\n")}
            label={isAr ? "نسخ الكل" : "Copy all"}
            labelCopied={isAr ? "تم النسخ" : "Copied!"}
            className="h-7 text-xs"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {codes.map((code, i) => (
          <div
            key={i}
            className="font-mono text-sm text-center py-2 px-3 rounded-md bg-muted border border-border"
          >
            {revealed ? code : "••••-••••"}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "احتفظ بهذه الرموز في مكان آمن. كل رمز يُستخدم مرة واحدة فقط."
          : "Store these codes somewhere safe. Each code can only be used once."}
      </p>
    </div>
  );
}

// ── Enable Dialog (3-step) ──

interface EnableDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  isAr: boolean;
}

function EnableDialog({ open, onClose, onComplete, isAr }: EnableDialogProps) {
  const [step, setStep] = useState<"loading" | "scan" | "verify" | "done">("loading");
  const [setupData, setSetupData] = useState<EnableTwoFactorResponse | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("loading");
    setOtpCode("");
    setSetupData(null);
    setShowSecret(false);
    enableTwoFactor()
      .then((res) => { setSetupData(res); setStep("scan"); })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : (isAr ? "فشل بدء إعداد 2FA" : "Failed to start 2FA setup"));
        onClose();
      });
  }, [open]);

  const handleVerify = async () => {
    if (otpCode.length < 6 || !setupData) return;
    setIsVerifying(true);
    try {
      await verifyTwoFactor(otpCode);
      // Backup codes came from the enable step — never from verify
      setBackupCodes(setupData.backup_codes);
      setStep("done");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (isAr ? "الرمز غير صحيح. حاول مجددًا." : "Invalid code. Please try again."));
      setOtpCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  // Format secret as groups of 4 for readability
  const formattedSecret = setupData?.secret
    ? (setupData.secret.match(/.{1,4}/g) ?? [setupData.secret]).join(" ")
    : "";

  const stepIndicator = (
    <div className="flex items-center gap-2 mb-1">
      {(["scan", "verify", "done"] as const).map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            step === s
              ? "bg-primary text-primary-foreground"
              : (["scan", "verify", "done"].indexOf(step) > i)
                ? "bg-green-500 text-white"
                : "bg-muted text-muted-foreground"
          }`}>
            {["scan", "verify", "done"].indexOf(step) > i ? <Check className="h-3 w-3" /> : i + 1}
          </div>
          {i < 2 && <div className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && step !== "loading") onClose(); }}>
      <DialogContent className="max-w-lg">

        {/* ── Loading ── */}
        {step === "loading" && (
          <>
            <DialogHeader>
              <DialogTitle>{isAr ? "جاري الإعداد..." : "Preparing setup..."}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </>
        )}

        {/* ── Step 1: Scan ── */}
        {step === "scan" && setupData && (
          <>
            <DialogHeader>
              {stepIndicator}
              <DialogTitle>{isAr ? "اربط تطبيق المصادقة" : "Connect authenticator app"}</DialogTitle>
              <DialogDescription>
                {isAr
                  ? "امسح رمز QR أو أدخل المفتاح يدويًا في تطبيق مثل Google Authenticator أو Authy"
                  : "Scan the QR code or enter the key manually in an app like Google Authenticator or Authy"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-1">
              {/* QR + key side by side */}
              <div className="flex gap-5 items-start">
                {/* QR code */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="rounded-xl border p-3 bg-white shadow-sm">
                    <QRCanvas uri={setupData.qr_code_uri} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{isAr ? "امسح بالكاميرا" : "Scan with camera"}</p>
                </div>

                {/* Instructions + key */}
                <div className="flex-1 space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {isAr ? "أو أدخل المفتاح يدويًا" : "Or enter key manually"}
                    </p>
                    <div className="relative">
                      <div className="font-mono text-sm rounded-md border bg-muted px-3 py-2.5 tracking-widest select-all break-all">
                        {showSecret ? formattedSecret : "•••• •••• •••• ••••"}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSecret((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showSecret ? "Hide secret key" : "Show secret key"}
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {showSecret && (
                      <CopyButton
                        text={setupData.secret}
                        label={isAr ? "نسخ المفتاح" : "Copy key"}
                        labelCopied={isAr ? "تم النسخ" : "Copied!"}
                        className="w-full h-8 text-xs"
                      />
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {isAr ? "تطبيقات مدعومة" : "Supported apps"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Google Authenticator", "Authy", "1Password", "Bitwarden"].map((app) => (
                        <span key={app} className="text-[11px] border rounded-md px-2 py-0.5 text-muted-foreground bg-muted/50">
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{isAr ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={() => setStep("verify")}>
                {isAr ? "التالي: تحقق من الرمز" : "Next: Verify code"}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 2: Verify ── */}
        {step === "verify" && (
          <>
            <DialogHeader>
              {stepIndicator}
              <DialogTitle>{isAr ? "أدخل رمز التحقق" : "Enter verification code"}</DialogTitle>
              <DialogDescription>
                {isAr
                  ? "أدخل الرمز المكوّن من 6 أرقام الذي يظهر في تطبيق المصادقة"
                  : "Enter the 6-digit code shown in your authenticator app"}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-6 py-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-7 w-7 text-primary" />
              </div>
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={setOtpCode}
                onComplete={handleVerify}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground text-center">
                {isAr
                  ? "الرمز يتغير كل 30 ثانية. أدخله قبل انتهاء مدته."
                  : "The code refreshes every 30 seconds. Enter it before it expires."}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setOtpCode(""); setStep("scan"); }}>
                {isAr ? "رجوع" : "Back"}
              </Button>
              <Button
                onClick={handleVerify}
                disabled={otpCode.length < 6 || isVerifying}
                className="gap-2 min-w-[120px]"
              >
                {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {isAr ? "تحقق وفعّل" : "Verify & enable"}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 3: Done — show backup codes ── */}
        {step === "done" && (
          <>
            <DialogHeader>
              {stepIndicator}
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                {isAr ? "تم تفعيل المصادقة الثنائية!" : "Two-factor auth enabled!"}
              </DialogTitle>
              <DialogDescription>
                {isAr
                  ? "احتفظ برموز الاستعادة في مكان آمن — ستحتاجها إذا فقدت وصولك لتطبيق المصادقة."
                  : "Save your backup codes somewhere safe — you'll need them if you lose access to your authenticator app."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {isAr
                  ? "ستُعرض هذه الرموز مرة واحدة فقط ولا يمكن استرجاعها لاحقًا."
                  : "These codes will only be shown once and cannot be retrieved later."}
              </p>
            </div>

            <BackupCodesGrid codes={backupCodes} isAr={isAr} />

            <DialogFooter>
              <Button onClick={() => { onComplete(); onClose(); }} className="w-full gap-2">
                <Check className="h-4 w-4" />
                {isAr ? "تم، لقد حفظت الرموز" : "Done, I've saved my codes"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Disable Dialog ──

interface DisableDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  isAr: boolean;
}

function DisableDialog({ open, onClose, onComplete, isAr }: DisableDialogProps) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  useEffect(() => { if (!open) { setPassword(""); setShowPw(false); } }, [open]);

  const handleDisable = async () => {
    if (!password.trim()) return;
    setIsDisabling(true);
    try {
      await disableTwoFactor(password);
      toast.success(isAr ? "تم تعطيل المصادقة الثنائية" : "2FA has been disabled");
      onComplete();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (isAr ? "كلمة المرور غير صحيحة" : "Incorrect password"));
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            {isAr ? "تعطيل المصادقة الثنائية" : "Disable 2FA"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isAr
              ? "سيقل مستوى أمان حسابك. أدخل كلمة المرور للمتابعة."
              : "This reduces your account security. Enter your password to continue."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-1.5 py-1">
          <Label htmlFor="disable-pw">{isAr ? "كلمة المرور" : "Password"}</Label>
          <div className="relative">
            <Input
              id="disable-pw"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDisable(); }}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDisable}
            disabled={isDisabling || !password.trim()}
            className="gap-2"
          >
            {isDisabling && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? "تعطيل" : "Disable 2FA"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Regenerate Backup Codes Dialog ──

interface RegenerateDialogProps {
  open: boolean;
  onClose: () => void;
  isAr: boolean;
}

function RegenerateDialog({ open, onClose, isAr }: RegenerateDialogProps) {
  const [step, setStep] = useState<"verify" | "done">("verify");
  const [otpCode, setOtpCode] = useState("");
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { if (!open) { setStep("verify"); setOtpCode(""); setNewCodes([]); } }, [open]);

  const handleRegenerate = async () => {
    if (otpCode.length < 6) return;
    setIsLoading(true);
    try {
      const res = await regenerateBackupCodes(otpCode);
      setNewCodes(res.backup_codes);
      setStep("done");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (isAr ? "الرمز غير صحيح" : "Invalid code"));
      setOtpCode("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        {step === "verify" ? (
          <>
            <DialogHeader>
              <DialogTitle>{isAr ? "توليد رموز احتياطية جديدة" : "Generate new backup codes"}</DialogTitle>
              <DialogDescription>
                {isAr
                  ? "أدخل رمز المصادقة للتأكيد. ستُلغى الرموز القديمة فورًا."
                  : "Enter your authenticator code to confirm. Old codes will be immediately invalidated."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-5 py-3">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} onComplete={handleRegenerate}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{isAr ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={handleRegenerate} disabled={otpCode.length < 6 || isLoading} className="gap-2">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isAr ? "توليد رموز جديدة" : "Generate new codes"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                {isAr ? "تم توليد رموز جديدة" : "New codes generated"}
              </DialogTitle>
              <DialogDescription>
                {isAr ? "الرموز القديمة لم تعد صالحة." : "Your old backup codes are now invalid."}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {isAr
                  ? "ستُعرض هذه الرموز مرة واحدة فقط."
                  : "These codes will only be shown once."}
              </p>
            </div>
            <BackupCodesGrid codes={newCodes} isAr={isAr} />
            <DialogFooter>
              <Button onClick={onClose} className="w-full">{isAr ? "تم، لقد حفظت الرموز" : "Done, I've saved them"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──

const MFASetup = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  const loadStatus = () => {
    setIsLoadingStatus(true);
    getTwoFactorStatus()
      .then(setStatus)
      .catch(() => toast.error(isAr ? "فشل تحميل حالة 2FA" : "Failed to load 2FA status"))
      .finally(() => setIsLoadingStatus(false));
  };

  useEffect(loadStatus, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <KeyRound className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isAr ? "المصادقة الثنائية" : "Two-Factor Authentication"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAr ? "أضف طبقة حماية إضافية لحسابك" : "Add an extra layer of security to your account"}
          </p>
        </div>
      </div>

      {/* Status card */}
      <Card>
        <CardContent className="pt-6">
          {isLoadingStatus ? (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{isAr ? "جاري التحميل..." : "Loading..."}</span>
            </div>
          ) : status ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                  status.is_enabled
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-muted"
                }`}>
                  {status.is_enabled
                    ? <ShieldCheck className="h-6 w-6 text-green-700 dark:text-green-400" />
                    : <ShieldOff className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-semibold">
                    {status.is_enabled
                      ? (isAr ? "المصادقة الثنائية مفعّلة" : "Two-factor authentication is on")
                      : (isAr ? "المصادقة الثنائية معطّلة" : "Two-factor authentication is off")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {status.is_enabled && status.enabled_at
                      ? (isAr ? `فُعّلت في ${format(new Date(status.enabled_at), "MMM d, yyyy")}` : `Enabled on ${format(new Date(status.enabled_at), "MMM d, yyyy")}`)
                      : (isAr ? "نوصي بتفعيل 2FA لحماية حسابك من الوصول غير المصرّح" : "We recommend enabling 2FA to protect your account from unauthorized access")}
                  </p>
                </div>
              </div>

              {status.is_enabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisableOpen(true)}
                  className="shrink-0 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                >
                  <ShieldOff className="h-4 w-4" />
                  {isAr ? "تعطيل" : "Disable"}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setEnableOpen(true)} className="shrink-0 gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  {isAr ? "تفعيل 2FA" : "Enable 2FA"}
                </Button>
              )}
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={loadStatus} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              {isAr ? "إعادة المحاولة" : "Retry"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Backup codes management (only when enabled) */}
      {status?.is_enabled && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{isAr ? "رموز الاستعادة" : "Backup Codes"}</CardTitle>
            <CardDescription>
              {isAr
                ? "استخدمها للدخول إذا لم يكن بإمكانك الوصول لتطبيق المصادقة"
                : "Use these to sign in if you can't access your authenticator app"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {isAr
                  ? "لا يمكن عرض الرموز القديمة. إذا فقدتها، استخدم الزر أدناه لتوليد رموز جديدة."
                  : "Old codes cannot be viewed. If you've lost them, generate new ones below."}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              {isAr ? "توليد رموز احتياطية جديدة" : "Generate new backup codes"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isAr ? "كيف تعمل المصادقة الثنائية؟" : "How does 2FA work?"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              { en: "Sign in with your email and password as usual.", ar: "سجّل دخولك بالبريد الإلكتروني وكلمة المرور كالمعتاد." },
              { en: "Open your authenticator app and get the 6-digit code.", ar: "افتح تطبيق المصادقة واحصل على الرمز المكوّن من 6 أرقام." },
              { en: "Enter the code to complete sign-in.", ar: "أدخل الرمز لإتمام تسجيل الدخول." },
              { en: "If you lose your phone, use a backup code instead.", ar: "إذا فقدت هاتفك، استخدم أحد رموز الاستعادة بدلًا من ذلك." },
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-muted-foreground">{isAr ? s.ar : s.en}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EnableDialog open={enableOpen} onClose={() => setEnableOpen(false)} onComplete={loadStatus} isAr={isAr} />
      <DisableDialog open={disableOpen} onClose={() => setDisableOpen(false)} onComplete={loadStatus} isAr={isAr} />
      <RegenerateDialog open={regenerateOpen} onClose={() => setRegenerateOpen(false)} isAr={isAr} />
    </div>
  );
};

export default MFASetup;
