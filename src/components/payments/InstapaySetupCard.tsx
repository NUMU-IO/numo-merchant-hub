/**
 * InstaPay setup card for the PaymentSetup page.
 *
 * Different shape from the card-processor gateways (Paymob/Kashier/…):
 * there is no API integration — the merchant only needs to hand us
 * their IPA + auto-approval thresholds. A flat inline form matches
 * the simpler mental model better than a detail sub-view.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, Trash2, Upload, QrCode, Link as LinkIcon } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/services/api";
import {
  deleteInstapayCredentials,
  deleteInstapayQrImage,
  fetchInstapayCredentials,
  saveInstapayCredentials,
  uploadInstapayQrImage,
  type InstapayCredentialsResponse,
} from "@/services/storeApi";
import { showError } from "@/lib/show-error";

interface Props {
  storeId: string;
  isAr: boolean;
}

const DEFAULT_THRESHOLD_CENTS = 50_000;      // 500 EGP
const DEFAULT_DAILY_CAP_CENTS = 500_000;     // 5,000 EGP
const DEFAULT_DAILY_COUNT = 10;

export default function InstapaySetupCard({ storeId, isAr }: Props) {
  const [creds, setCreds] = useState<InstapayCredentialsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [ipa, setIpa] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fallbackPhone, setFallbackPhone] = useState("");
  const [thresholdEgp, setThresholdEgp] = useState<number>(
    DEFAULT_THRESHOLD_CENTS / 100,
  );
  const [dailyCapEgp, setDailyCapEgp] = useState<number>(
    DEFAULT_DAILY_CAP_CENTS / 100,
  );
  const [dailyCount, setDailyCount] = useState<number>(DEFAULT_DAILY_COUNT);
  const [enabled, setEnabled] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  const [uploadingQr, setUploadingQr] = useState(false);
  const [removingQr, setRemovingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement | null>(null);

  const [qrLinkUrl, setQrLinkUrl] = useState("");
  // Live QR preview rendered from `qrLinkUrl`. Re-encoded as the
  // merchant types — keeps the feedback loop tight without a save
  // round-trip. Bail to null when the input is empty so the preview
  // box hides.
  const [qrLinkPreview, setQrLinkPreview] = useState<string | null>(null);

  // Persist the "Offer at checkout" toggle independently of the creds
  // Save button. Mirrors the PATCH /settings/payment flow used by the
  // other gateway toggles — a single `instapay_enabled` boolean. The
  // backend guards against toggling on without saved credentials.
  const handleToggleEnabled = async (next: boolean) => {
    setTogglingEnabled(true);
    const previous = enabled;
    // Optimistic — revert if the PATCH fails.
    setEnabled(next);
    try {
      await apiClient(`/stores/${storeId}/settings/payment`, {
        method: "PATCH",
        body: JSON.stringify({ instapay_enabled: next }),
      });
      toast.success(
        next
          ? isAr
            ? "تم تفعيل إنستاباي في الدفع"
            : "InstaPay is now live at checkout"
          : isAr
            ? "تم إيقاف عرض إنستاباي"
            : "InstaPay hidden from checkout",
      );
    } catch (err) {
      setEnabled(previous);
      showError(err);
    } finally {
      setTogglingEnabled(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchInstapayCredentials(storeId)
      .then((c) => {
        if (cancelled) return;
        setCreds(c);
        setEnabled(!!c.enabled);
        setDisplayName(c.ipa_display_name || "");
        setFallbackPhone(c.fallback_phone || "");
        setThresholdEgp(
          (c.auto_approve_threshold_cents ?? DEFAULT_THRESHOLD_CENTS) / 100,
        );
        setDailyCapEgp(
          (c.auto_approve_daily_cap_cents ?? DEFAULT_DAILY_CAP_CENTS) / 100,
        );
        setDailyCount(c.auto_approve_daily_count ?? DEFAULT_DAILY_COUNT);
        setQrLinkUrl(c.qr_link_url || "");
      })
      .catch(() => setCreds({ is_configured: false } as InstapayCredentialsResponse))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  // Re-encode the live preview whenever the link changes. Keeps the
  // feedback synchronous from the merchant's perspective — they paste
  // a link, see the QR they're about to ship to customers.
  useEffect(() => {
    let cancelled = false;
    const trimmed = qrLinkUrl.trim();
    if (!trimmed) {
      setQrLinkPreview(null);
      return;
    }
    QRCode.toDataURL(trimmed, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setQrLinkPreview(url);
      })
      .catch(() => {
        if (!cancelled) setQrLinkPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrLinkUrl]);

  const handleSave = async () => {
    if (!ipa.trim() && !creds?.is_configured) {
      toast.error(
        isAr
          ? "الرجاء إدخال عنوان الدفع الفوري (IPA)"
          : "Please enter your InstaPay IPA",
      );
      return;
    }
    setSaving(true);
    try {
      // On first-time setup we must send the IPA. On update, leave it
      // null so the backend preserves the encrypted value — we can't
      // reconstruct the full IPA from the masked form, and sending a
      // stripped-masked placeholder would (a) fail the min-length
      // validator and (b) corrupt the stored credential if it passed.
      const trimmedIpa = ipa.trim();
      const saved = await saveInstapayCredentials(storeId, {
        ipa: trimmedIpa ? trimmedIpa : null,
        ipa_display_name: displayName.trim() || null,
        fallback_phone: fallbackPhone.trim() || null,
        auto_approve_threshold_cents: Math.round(thresholdEgp * 100),
        auto_approve_daily_cap_cents: Math.round(dailyCapEgp * 100),
        auto_approve_daily_count: Math.max(0, Math.floor(dailyCount)),
        // Empty string → backend clears; non-empty → backend stores.
        qr_link_url: qrLinkUrl.trim(),
      });
      setCreds(saved);
      setIpa("");
      setEnabled(!!saved.enabled);
      toast.success(
        isAr ? "تم حفظ إعدادات إنستاباي" : "InstaPay settings saved",
      );
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleQrFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    // Always reset the input so picking the same file twice still fires.
    e.target.value = "";
    if (!file) return;
    setUploadingQr(true);
    try {
      const updated = await uploadInstapayQrImage(storeId, file);
      setCreds(updated);
      toast.success(isAr ? "تم رفع رمز QR" : "QR uploaded");
    } catch (err) {
      showError(err);
    } finally {
      setUploadingQr(false);
    }
  };

  const handleRemoveQr = async () => {
    if (
      !confirm(
        isAr
          ? "إزالة رمز QR لإنستاباي؟"
          : "Remove the InstaPay QR image?",
      )
    ) {
      return;
    }
    setRemovingQr(true);
    try {
      const updated = await deleteInstapayQrImage(storeId);
      setCreds(updated);
      toast.success(isAr ? "تم حذف رمز QR" : "QR removed");
    } catch (err) {
      showError(err);
    } finally {
      setRemovingQr(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">
          {isAr ? "جارٍ تحميل إعدادات إنستاباي..." : "Loading InstaPay…"}
        </span>
      </div>
    );
  }

  const isConfigured = creds?.is_configured;

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/instapay-logo.svg"
            alt="InstaPay"
            className="h-10 w-auto object-contain"
          />
          <div>
            <h2 className="text-base font-bold">
              {isAr ? "انستاباي" : "InstaPay"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "قبول المدفوعات المباشرة إلى حسابك البنكي"
                : "Accept direct bank-to-bank payments with manual verification"}
            </p>
          </div>
        </div>
        {isConfigured ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            {enabled ? (isAr ? "نشط" : "Live") : isAr ? "مُعد" : "Ready"}
          </span>
        ) : null}
      </div>

      <div className="p-5 space-y-4">
        {isConfigured && creds?.ipa_masked ? (
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            {isAr ? "العنوان الحالي: " : "Current IPA: "}
            <span className="font-mono">{creds.ipa_masked}</span>
            {creds.last_configured ? (
              <span className="ml-2">
                ({isAr ? "آخر تحديث " : "last updated "}
                {new Date(creds.last_configured).toLocaleDateString()})
              </span>
            ) : null}
          </div>
        ) : null}

        <div>
          <Label>
            {isAr ? "عنوان الدفع (IPA)" : "InstaPay address (IPA)"}{" "}
            {!isConfigured ? <span className="text-red-600">*</span> : null}
          </Label>
          <Input
            value={ipa}
            onChange={(e) => setIpa(e.target.value)}
            placeholder={
              isConfigured ? "•••••" : "merchant@cib"
            }
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {isAr
              ? "العنوان الذي يرسل إليه العملاء الأموال من تطبيق البنك."
              : "The address customers will send funds to from their bank app."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{isAr ? "الاسم المعروض" : "Display name"}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={isAr ? "متجر نمو" : "Your store"}
            />
          </div>
          <div>
            <Label>{isAr ? "رقم احتياطي" : "Fallback phone"}</Label>
            <Input
              value={fallbackPhone}
              onChange={(e) => setFallbackPhone(e.target.value)}
              placeholder="+20 10…"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">
                {isAr ? "الموافقة التلقائية" : "Auto-approval"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "للطلبات الصغيرة، يتم قبول الإثبات تلقائياً بناءً على القواعد أدناه."
                  : "Small orders auto-approve based on the rules below."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">
                {isAr ? "حد القبول (ج.م)" : "Threshold (EGP)"}
              </Label>
              <Input
                type="number"
                min={0}
                value={thresholdEgp}
                onChange={(e) => setThresholdEgp(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">
                {isAr ? "الحد اليومي (ج.م)" : "Daily cap (EGP)"}
              </Label>
              <Input
                type="number"
                min={0}
                value={dailyCapEgp}
                onChange={(e) => setDailyCapEgp(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">
                {isAr ? "عدد الطلبات/اليوم" : "Orders/day"}
              </Label>
              <Input
                type="number"
                min={0}
                value={dailyCount}
                onChange={(e) => setDailyCount(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* ── Customer-facing QR ──────────────────────────────────────
             Two ways the merchant can supply a working QR:
               1. Paste their InstaPay "Share link" URL — we render
                  the QR client-side. Customers scan with their phone
                  camera; the URL deep-links into the InstaPay app.
                  Easiest path; no upload, no friction.
               2. Upload a screenshot of the QR they generated inside
                  the InstaPay app's "Receive" screen. Fallback for
                  merchants who don't have a share link.
             Link wins over upload at checkout if both are set.
        */}
        <div className="border-t pt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2 mb-1">
              <QrCode className="w-4 h-4" />
              {isAr ? "رمز QR للعملاء" : "Customer-facing QR"}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isAr
                ? "اختياري — اعرض رمز QR للعملاء ليفتحوا تطبيق إنستاباي مباشرة. ألصق رابط الدفع، أو ارفع صورة من تطبيق إنستاباي."
                : "Optional — show customers a QR that opens the InstaPay app for them. Paste your share link, or upload a screenshot from the InstaPay app."}
            </p>
          </div>

          {/* ── Path A: paste link ── */}
          <div>
            <Label className="flex items-center gap-2 text-xs">
              <LinkIcon className="w-3.5 h-3.5" />
              {isAr ? "رابط الدفع لإنستاباي" : "InstaPay payment link"}
            </Label>
            <Input
              value={qrLinkUrl}
              onChange={(e) => setQrLinkUrl(e.target.value)}
              placeholder="https://ipn.eg/QR/…"
              autoComplete="off"
              dir="ltr"
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {isAr
                ? "افتح تطبيق إنستاباي → استلام → مشاركة الرابط، الصق هنا. سنحول الرابط إلى رمز QR للعملاء."
                : "InstaPay app → Receive → Share link. Paste here and we'll turn it into a QR for customers."}
            </p>
            {qrLinkPreview ? (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={qrLinkPreview}
                  alt="QR preview"
                  className="w-24 h-24 border rounded bg-white"
                />
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? "هذا ما سيراه العميل عند الدفع. اضغط حفظ لتفعيله."
                    : "This is what customers will see at checkout. Click Save to apply."}
                </p>
              </div>
            ) : null}
          </div>

          {/* ── Path B: upload image (fallback) ── */}
          <div className="border-t pt-4">
            <div className="flex items-start justify-between mb-2 gap-4">
              <Label className="flex items-center gap-2 text-xs">
                <Upload className="w-3.5 h-3.5" />
                {isAr ? "أو ارفع صورة QR (احتياطي)" : "Or upload a QR image (fallback)"}
              </Label>
              {creds?.qr_image_url ? (
                <img
                  src={creds.qr_image_url}
                  alt="InstaPay QR"
                  className="w-16 h-16 object-contain border rounded shrink-0"
                />
              ) : null}
            </div>
            <input
              ref={qrInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              aria-label={isAr ? "رفع رمز QR لإنستاباي" : "Upload InstaPay QR image"}
              title={isAr ? "رفع رمز QR لإنستاباي" : "Upload InstaPay QR image"}
              onChange={handleQrFileChange}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => qrInputRef.current?.click()}
                disabled={uploadingQr || removingQr}
              >
                {uploadingQr ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {creds?.qr_image_url
                  ? isAr
                    ? "استبدال"
                    : "Replace"
                  : isAr
                    ? "رفع صورة"
                    : "Upload image"}
              </Button>
              {creds?.qr_image_url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveQr}
                  disabled={uploadingQr || removingQr}
                >
                  {removingQr ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              ) : null}
            </div>
            {creds?.qr_link_url && creds?.qr_image_url ? (
              <p className="text-[11px] text-muted-foreground mt-2">
                {isAr
                  ? "ملاحظة: الرابط أعلاه يُعرض على العملاء بدلاً من الصورة المرفوعة."
                  : "Note: the link above takes priority over the uploaded image at checkout."}
              </p>
            ) : null}
          </div>
        </div>

        {isConfigured ? (
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <p className="text-sm font-semibold">
                {isAr ? "تفعيل في الدفع" : "Offer at checkout"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "عرض إنستاباي كطريقة دفع للعملاء."
                  : "Show InstaPay as a payment option to customers."}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={togglingEnabled}
            />
          </div>
        ) : null}

        <div className="pt-2 flex gap-2">
          <Button onClick={handleSave} disabled={saving || deleting} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isConfigured
              ? isAr
                ? "تحديث"
                : "Update settings"
              : isAr
                ? "حفظ"
                : "Save"}
          </Button>
          {isConfigured ? (
            <Button
              variant="outline"
              onClick={async () => {
                if (
                  !confirm(
                    isAr
                      ? "حذف إعدادات إنستاباي؟ لن يظهر للعملاء الجدد."
                      : "Remove InstaPay? New customers won't see it at checkout.",
                  )
                ) {
                  return;
                }
                setDeleting(true);
                try {
                  const cleared = await deleteInstapayCredentials(storeId);
                  setCreds(cleared);
                  setIpa("");
                  setDisplayName("");
                  setFallbackPhone("");
                  setEnabled(false);
                  toast.success(
                    isAr ? "تم حذف الإعدادات" : "InstaPay removed",
                  );
                } catch (err) {
                  showError(err);
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={saving || deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
