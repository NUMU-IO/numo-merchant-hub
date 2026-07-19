import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient, apiClientFormData } from "@/services/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, CreditCard, Smartphone, Upload, CheckCircle2, Clock } from "lucide-react";

const PRESETS_EGP = [100, 250, 500, 1000];
const MIN_EGP = 50;
const MAX_EGP = 50000;

interface TopupCreated {
  id: string;
  method: string;
  amount_cents: number;
  status: string;
  special_reference: string;
  checkout_url: string | null;
  manual: {
    method: string;
    reference_code: string;
    destination: string;
    destination_label?: string;
    qr_payload: string | null;
    expires_at: string | null;
  } | null;
}

interface ProofResponse {
  credited_balance_cents: number | null;
  topup_status: string;
  on_hold: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which methods the admin has enabled (from GET /wallet). */
  methodsEnabled: Record<string, boolean>;
  /** Called after a proof lands (credited or on hold). */
  onDone: () => void;
}

const TopUpDialog = ({ open, onOpenChange, methodsEnabled, onDone }: Props) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [amountEgp, setAmountEgp] = useState<number>(250);
  const [creating, setCreating] = useState(false);
  const [manualTopup, setManualTopup] = useState<TopupCreated | null>(null);
  const [txRef, setTxRef] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofResult, setProofResult] = useState<"credited" | "on_hold" | null>(null);

  const amountValid = amountEgp >= MIN_EGP && amountEgp <= MAX_EGP;
  const cardOn = methodsEnabled.card !== false;
  const vcOn = methodsEnabled.vodafone_cash !== false;
  const ipOn = methodsEnabled.instapay !== false;
  const defaultTab = cardOn ? "card" : vcOn ? "vodafone_cash" : "instapay";

  const reset = () => {
    setManualTopup(null);
    setTxRef("");
    setProofFile(null);
    setProofResult(null);
  };

  const createTopup = async (method: "card" | "vodafone_cash" | "instapay") => {
    if (!amountValid) {
      toast.error(isAr ? `المبلغ يجب أن يكون بين ${MIN_EGP} و ${MAX_EGP} ج.م` : `Amount must be between ${MIN_EGP} and ${MAX_EGP} EGP`);
      return;
    }
    setCreating(true);
    try {
      const topup = await apiClient<TopupCreated>("/wallet/topups", {
        method: "POST",
        body: JSON.stringify({ method, amount_cents: Math.round(amountEgp * 100) }),
      });
      if (method === "card" && topup.checkout_url) {
        window.location.href = topup.checkout_url;
        return;
      }
      setManualTopup(topup);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (isAr ? "تعذر إنشاء عملية الشحن" : "Could not create top-up"));
    } finally {
      setCreating(false);
    }
  };

  const submitProof = async () => {
    if (!manualTopup || !proofFile || txRef.trim().length < 3) {
      toast.error(isAr ? "أدخل رقم العملية وأرفق لقطة الشاشة" : "Enter the transaction reference and attach the receipt screenshot");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("transaction_ref", txRef.trim());
      form.append("file", proofFile);
      const res = await apiClientFormData<ProofResponse>(
        `/wallet/topups/${manualTopup.id}/proof`,
        form,
      );
      setProofResult(res.credited_balance_cents !== null ? "credited" : "on_hold");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (isAr ? "تعذر رفع الإيصال" : "Could not upload the receipt"));
    } finally {
      setUploading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isAr ? "تم النسخ" : "Copied");
  };

  const isVC = manualTopup?.manual?.method === "vodafone_cash";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[480px]" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isAr ? "شحن المحفظة" : "Top up wallet"}</DialogTitle>
        </DialogHeader>

        {proofResult ? (
          <div className="flex flex-col items-center py-8 text-center gap-3">
            {proofResult === "credited" ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="font-semibold">{isAr ? "تم شحن محفظتك فوراً!" : "Your wallet was credited instantly!"}</p>
              </>
            ) : (
              <>
                <Clock className="h-12 w-12 text-amber-500" />
                <p className="font-semibold">{isAr ? "تمت إضافة الرصيد — قيد التحقق" : "Credit added — on hold"}</p>
                <p className="text-sm text-muted-foreground">
                  {isAr
                    ? "يظهر المبلغ في محفظتك كرصيد معلّق حتى يكتمل التحقق (عادةً خلال ساعات قليلة). سيتم تفعيله تلقائياً بعد المراجعة."
                    : "The amount now shows in your wallet as on hold while we verify the transfer (usually within a few hours). It activates automatically after review."}
                </p>
              </>
            )}
            <Button className="mt-2" onClick={() => { reset(); onOpenChange(false); }}>
              {isAr ? "تم" : "Done"}
            </Button>
          </div>
        ) : manualTopup?.manual ? (
          /* ── Manual method: pay + upload proof ────────────────────── */
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {isVC
                  ? (isAr
                      ? "حوّل المبلغ من محفظة فودافون كاش الخاصة بك إلى الرقم التالي، واكتب الرمز المرجعي في خانة الملاحظات إن وُجدت:"
                      : "Transfer the amount from your Vodafone Cash wallet to the number below, and include the reference code in the note field if available:")
                  : (isAr
                      ? "حوّل المبلغ عبر تطبيق إنستاباي أو تطبيق البنك إلى العنوان التالي، واكتب الرمز المرجعي في خانة الملاحظات:"
                      : "Transfer the amount via InstaPay or your bank app to the address below, and include the reference code in the transfer note:")}
              </p>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isVC ? (isAr ? "رقم فودافون كاش" : "Vodafone Cash number") : (isAr ? "العنوان (IPA)" : "Address (IPA)")}
                  </p>
                  <p className="font-mono font-semibold" dir="ltr">{manualTopup.manual.destination}</p>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(manualTopup.manual?.destination || "")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{isAr ? "الرمز المرجعي (مهم)" : "Reference code (important)"}</p>
                  <p className="font-mono font-semibold">{manualTopup.manual.reference_code}</p>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(manualTopup.manual?.reference_code || "")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">{isAr ? "المبلغ" : "Amount"}</p>
                <p className="font-bold tabular-nums">{(manualTopup.amount_cents / 100).toLocaleString()} {isAr ? "ج.م" : "EGP"}</p>
              </div>
              {manualTopup.manual.qr_payload && (
                <div className="flex justify-center pt-1">
                  <div className="bg-white p-2 rounded-lg">
                    <QRCodeSVG value={manualTopup.manual.qr_payload} size={120} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{isAr ? "بعد التحويل، ارفع إيصال العملية:" : "After transferring, upload the receipt:"}</p>
              <Input
                placeholder={isAr ? "رقم العملية من الإيصال" : "Transaction reference from the receipt"}
                value={txRef}
                onChange={(e) => setTxRef(e.target.value)}
              />
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button className="w-full gap-2" onClick={submitProof} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isAr ? "رفع الإيصال" : "Upload receipt"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {isAr
                ? "يُضاف الرصيد فوراً بعد الرفع — إما مفعّلاً مباشرة أو معلّقاً لحين التحقق."
                : "Your balance updates immediately after upload — either active right away or on hold pending verification."}
            </p>
          </div>
        ) : (
          /* ── Amount + method selection ────────────────────────────── */
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">{isAr ? "المبلغ (ج.م)" : "Amount (EGP)"}</p>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS_EGP.map((v) => (
                  <Button
                    key={v}
                    variant={amountEgp === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAmountEgp(v)}
                    className="tabular-nums"
                  >
                    {v}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={MIN_EGP}
                max={MAX_EGP}
                value={amountEgp}
                onChange={(e) => setAmountEgp(Number(e.target.value))}
              />
            </div>

            <Tabs defaultValue={defaultTab}>
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${[cardOn, vcOn, ipOn].filter(Boolean).length}, 1fr)` }}>
                {cardOn && (
                  <TabsTrigger value="card" className="gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    {isAr ? "بطاقة" : "Card"}
                  </TabsTrigger>
                )}
                {vcOn && (
                  <TabsTrigger value="vodafone_cash" className="gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" />
                    {isAr ? "فودافون كاش" : "Vodafone Cash"}
                  </TabsTrigger>
                )}
                {ipOn && (
                  <TabsTrigger value="instapay" className="gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" />
                    {isAr ? "إنستاباي" : "InstaPay"}
                  </TabsTrigger>
                )}
              </TabsList>
              {cardOn && (
                <TabsContent value="card" className="space-y-3 pt-3">
                  <p className="text-sm text-muted-foreground">
                    {isAr
                      ? "ستنتقل لصفحة دفع آمنة بالبطاقة. يُضاف الرصيد فور إتمام الدفع."
                      : "You'll be redirected to a secure card payment page. Your balance is credited the moment payment completes."}
                  </p>
                  <Button className="w-full" onClick={() => createTopup("card")} disabled={creating || !amountValid}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "متابعة الدفع" : "Continue to payment")}
                  </Button>
                </TabsContent>
              )}
              {vcOn && (
                <TabsContent value="vodafone_cash" className="space-y-3 pt-3">
                  <p className="text-sm text-muted-foreground">
                    {isAr
                      ? "حوّل من محفظة فودافون كاش مباشرة لرقمنا وارفع الإيصال — يظهر الرصيد فوراً بعد الرفع."
                      : "Transfer directly from your Vodafone Cash wallet to our number and upload the receipt — your balance shows immediately after upload."}
                  </p>
                  <Button className="w-full" onClick={() => createTopup("vodafone_cash")} disabled={creating || !amountValid}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "إنشاء تحويل فودافون كاش" : "Create Vodafone Cash transfer")}
                  </Button>
                </TabsContent>
              )}
              {ipOn && (
                <TabsContent value="instapay" className="space-y-3 pt-3">
                  <p className="text-sm text-muted-foreground">
                    {isAr
                      ? "حوّل مباشرة عبر إنستاباي وارفع الإيصال — يظهر الرصيد فوراً بعد الرفع."
                      : "Transfer directly via InstaPay and upload the receipt — your balance shows immediately after upload."}
                  </p>
                  <Button className="w-full" onClick={() => createTopup("instapay")} disabled={creating || !amountValid}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "إنشاء تحويل إنستاباي" : "Create InstaPay transfer")}
                  </Button>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TopUpDialog;
