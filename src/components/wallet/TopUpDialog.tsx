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
  instapay: {
    reference_code: string;
    ipa: string;
    ipa_display_name?: string;
    qr_payload: string;
    expires_at: string | null;
  } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after an InstaPay proof lands (credited or under review). */
  onDone: () => void;
}

const TopUpDialog = ({ open, onOpenChange, onDone }: Props) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [amountEgp, setAmountEgp] = useState<number>(250);
  const [creating, setCreating] = useState(false);
  const [instapayTopup, setInstapayTopup] = useState<TopupCreated | null>(null);
  const [txRef, setTxRef] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofResult, setProofResult] = useState<"credited" | "under_review" | null>(null);

  const amountValid = amountEgp >= MIN_EGP && amountEgp <= MAX_EGP;

  const reset = () => {
    setInstapayTopup(null);
    setTxRef("");
    setProofFile(null);
    setProofResult(null);
  };

  const createTopup = async (method: "paymob_card" | "instapay") => {
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
      if (method === "paymob_card" && topup.checkout_url) {
        // Card + Vodafone Cash live on the same hosted Paymob page.
        window.location.href = topup.checkout_url;
        return;
      }
      setInstapayTopup(topup);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (isAr ? "تعذر إنشاء عملية الشحن" : "Could not create top-up"));
    } finally {
      setCreating(false);
    }
  };

  const submitProof = async () => {
    if (!instapayTopup || !proofFile || txRef.trim().length < 3) {
      toast.error(isAr ? "أدخل رقم العملية وأرفق لقطة الشاشة" : "Enter the transaction reference and attach the receipt screenshot");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("transaction_ref", txRef.trim());
      form.append("file", proofFile);
      const res = await apiClientFormData<{ credited_balance_cents: number | null; topup_status: string }>(
        `/wallet/topups/${instapayTopup.id}/proof`,
        form,
      );
      setProofResult(res.credited_balance_cents !== null ? "credited" : "under_review");
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
                <p className="font-semibold">{isAr ? "الإيصال قيد المراجعة" : "Receipt under review"}</p>
                <p className="text-sm text-muted-foreground">
                  {isAr ? "سيتم إضافة الرصيد بعد المراجعة (عادةً خلال ساعات قليلة)." : "Your balance will be credited after review (usually within a few hours)."}
                </p>
              </>
            )}
            <Button className="mt-2" onClick={() => { reset(); onOpenChange(false); }}>
              {isAr ? "تم" : "Done"}
            </Button>
          </div>
        ) : instapayTopup ? (
          /* ── InstaPay: pay + upload proof ─────────────────────────── */
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "حوّل المبلغ عبر تطبيق إنستاباي أو تطبيق البنك إلى العنوان التالي، واكتب الرمز المرجعي في خانة الملاحظات:"
                  : "Transfer the amount via InstaPay or your bank app to the address below, and include the reference code in the transfer note:"}
              </p>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{isAr ? "العنوان (IPA)" : "Address (IPA)"}</p>
                  <p className="font-mono font-semibold">{instapayTopup.instapay?.ipa}</p>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(instapayTopup.instapay?.ipa || "")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{isAr ? "الرمز المرجعي (مهم — اكتبه في الملاحظات)" : "Reference code (important — put it in the note)"}</p>
                  <p className="font-mono font-semibold">{instapayTopup.instapay?.reference_code}</p>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(instapayTopup.instapay?.reference_code || "")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">{isAr ? "المبلغ" : "Amount"}</p>
                <p className="font-bold tabular-nums">{(instapayTopup.amount_cents / 100).toLocaleString()} {isAr ? "ج.م" : "EGP"}</p>
              </div>
              {instapayTopup.instapay?.qr_payload && (
                <div className="flex justify-center pt-1">
                  <div className="bg-white p-2 rounded-lg">
                    <QRCodeSVG value={instapayTopup.instapay.qr_payload} size={120} />
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

            <Tabs defaultValue="paymob">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paymob" className="gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  {isAr ? "بطاقة / فودافون كاش" : "Card / Vodafone Cash"}
                </TabsTrigger>
                <TabsTrigger value="instapay" className="gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  {isAr ? "إنستاباي" : "InstaPay"}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="paymob" className="space-y-3 pt-3">
                <p className="text-sm text-muted-foreground">
                  {isAr
                    ? "ستنتقل لصفحة دفع آمنة تدعم البطاقات ومحافظ الموبايل (فودافون كاش وغيرها). يُضاف الرصيد فور إتمام الدفع."
                    : "You'll be redirected to a secure payment page supporting cards and mobile wallets (Vodafone Cash and others). Your balance is credited the moment payment completes."}
                </p>
                <Button className="w-full" onClick={() => createTopup("paymob_card")} disabled={creating || !amountValid}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "متابعة الدفع" : "Continue to payment")}
                </Button>
              </TabsContent>
              <TabsContent value="instapay" className="space-y-3 pt-3">
                <p className="text-sm text-muted-foreground">
                  {isAr
                    ? "حوّل مباشرة عبر إنستاباي وارفع الإيصال — يُضاف الرصيد فوراً في الغالب بعد التحقق التلقائي."
                    : "Transfer directly via InstaPay and upload the receipt — the balance is usually credited instantly after automatic verification."}
                </p>
                <Button className="w-full" onClick={() => createTopup("instapay")} disabled={creating || !amountValid}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "إنشاء تحويل إنستاباي" : "Create InstaPay transfer")}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TopUpDialog;
