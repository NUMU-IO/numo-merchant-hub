/**
 * Auto-approval + image-verification controls shared by the manual
 * payment rails (InstaPay, Vodafone Cash).
 *
 * These knobs map 1-1 onto one server-side rules engine that doesn't
 * care which rail a proof came from, so they must not fork per card —
 * a threshold that means one thing on InstaPay and another on Vodafone
 * Cash is exactly the drift this component exists to prevent.
 *
 * The only per-rail difference is the word for the merchant's
 * destination ("IPA" vs "wallet number"), passed in as `destinationNoun`.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface ManualRailAutoApprovalValues {
  thresholdEgp: number;
  dailyCapEgp: number;
  dailyCount: number;
  requireOcrAmount: boolean;
  requireOcrDestination: boolean;
  ocrAmountTolerancePct: number;
  requireNoteContainsRef: boolean;
  requireTxnRefMatch: boolean;
  requireRecipientNameMatch: boolean;
  recipientNameToken: string;
}

interface Props {
  isAr: boolean;
  values: ManualRailAutoApprovalValues;
  onChange: <K extends keyof ManualRailAutoApprovalValues>(
    key: K,
    value: ManualRailAutoApprovalValues[K],
  ) => void;
  /** Admin-assigned; when absent the OCR section is hidden entirely. */
  ocrProvider?: string | null;
  /** "IPA" / "wallet number" — merchant-facing noun for the destination. */
  destinationNoun: string;
  /** Reference-code shape shown in the note-rule help text. */
  referenceExample: string;
  /** Rendered under the tolerance input; used to explain a rail's fee. */
  toleranceHint?: string | null;
}

export function ManualRailAutoApproval({
  isAr,
  values,
  onChange,
  ocrProvider,
  destinationNoun,
  referenceExample,
  toleranceHint,
}: Props) {
  return (
    <>
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
              value={values.thresholdEgp}
              onChange={(e) =>
                onChange("thresholdEgp", Number(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label className="text-xs">
              {isAr ? "الحد اليومي (ج.م)" : "Daily cap (EGP)"}
            </Label>
            <Input
              type="number"
              min={0}
              value={values.dailyCapEgp}
              onChange={(e) =>
                onChange("dailyCapEgp", Number(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label className="text-xs">
              {isAr ? "عدد الطلبات/اليوم" : "Orders/day"}
            </Label>
            <Input
              type="number"
              min={0}
              value={values.dailyCount}
              onChange={(e) =>
                onChange("dailyCount", Number(e.target.value) || 0)
              }
            />
          </div>
        </div>
      </div>

      {/* Visible only when an admin has assigned an OCR provider to this
          store. Otherwise the section is hidden so merchants don't see
          knobs they can't act on — flipping these flags without a
          provider is a no-op anyway (the rules require ocr_status="ok"). */}
      {ocrProvider ? (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">
                {isAr
                  ? "التحقق من الصورة (متقدم)"
                  : "Image verification (advanced)"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "نقرأ الصورة آلياً للتحقق من المبلغ ورقم المستلم. عند الفشل أو عدم التطابق، يتم تحويل الإثبات للمراجعة اليدوية."
                  : "We read the image to cross-check amount + recipient. On failure or mismatch, the proof routes to manual review."}
              </p>
            </div>
          </div>

          <div className="rounded-md bg-muted/30 px-3 py-2 mb-3 text-[11px]">
            <span className="text-muted-foreground">
              {isAr ? "مزود التحقق: " : "OCR provider: "}
            </span>
            <span className="font-mono">{ocrProvider}</span>
            {(ocrProvider === "deepseek_hf" || ocrProvider === "glm_hf") && (
              <span className="block text-amber-700 mt-1">
                {isAr
                  ? "هذا المزود مجاني وقد يستغرق حتى دقيقة في الاستخدام الأول."
                  : "This provider is best-effort and may take up to a minute on first use."}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">
                  {isAr ? "تحقق من المبلغ" : "Verify amount"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr
                    ? "ارفض الموافقة التلقائية عند عدم تطابق المبلغ المقروء مع إجمالي الطلب."
                    : "Block auto-approval when the OCR'd amount disagrees with the order total."}
                </p>
              </div>
              <Switch
                checked={values.requireOcrAmount}
                onCheckedChange={(v) => onChange("requireOcrAmount", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">
                  {isAr
                    ? "تحقق من المستلم"
                    : `Verify recipient ${destinationNoun}`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr
                    ? "ارفض الموافقة التلقائية عند اختلاف المستلم في الصورة عن بياناتك."
                    : `Block auto-approval when the recipient on the screenshot doesn't match your ${destinationNoun}.`}
                </p>
              </div>
              <Switch
                checked={values.requireOcrDestination}
                onCheckedChange={(v) => onChange("requireOcrDestination", v)}
              />
            </div>

            <div>
              <Label className="text-xs">
                {isAr ? "هامش الفرق المسموح (%)" : "Amount tolerance (%)"}
              </Label>
              <Input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={values.ocrAmountTolerancePct}
                onChange={(e) =>
                  onChange("ocrAmountTolerancePct", Number(e.target.value) || 0)
                }
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {isAr
                  ? "أكبر فرق نسبي بين المبلغ المقروء وإجمالي الطلب يمر دون مراجعة."
                  : "Maximum percent difference allowed between the OCR'd amount and the order total before the rule fires."}
              </p>
              {toleranceHint ? (
                <p className="text-[10px] text-amber-700 mt-1">{toleranceHint}</p>
              ) : null}
            </div>

            {/* Note-field reference rule — single strongest fraud
                signal: a fraudster physically can't have typed our
                short-lived per-order code into someone else's note. */}
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-xs font-medium">
                  {isAr
                    ? "تحقق من ظهور الرمز المرجعي في خانة الملاحظات"
                    : "Require reference code in the transfer note"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr
                    ? `ارفض الموافقة التلقائية إذا لم تحتوي ملاحظة التحويل في صورة الإثبات على الرمز المرجعي للطلب (مثل ${referenceExample}).`
                    : `Block auto-approval when the note in the screenshot doesn't contain our order reference (e.g. ${referenceExample}).`}
                </p>
              </div>
              <Switch
                checked={values.requireNoteContainsRef}
                onCheckedChange={(v) => onChange("requireNoteContainsRef", v)}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-xs font-medium">
                  {isAr
                    ? "تحقق من تطابق الرقم المرجعي للمعاملة"
                    : "Verify transaction reference matches screenshot"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr
                    ? "ارفض الموافقة التلقائية إذا اختلف الرقم الذي كتبه العميل في النموذج عن الرقم المقروء من الصورة."
                    : "Block auto-approval when the typed transaction reference disagrees with the one OCR'd from the receipt."}
                </p>
              </div>
              <Switch
                checked={values.requireTxnRefMatch}
                onCheckedChange={(v) => onChange("requireTxnRefMatch", v)}
              />
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">
                    {isAr ? "تحقق من اسم المستلم" : "Verify recipient name"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isAr
                      ? "ارفض الموافقة التلقائية عند عدم ظهور اسمك في خانة المستلم بصورة الإثبات."
                      : "Block auto-approval when your name token doesn't appear in the receipt's recipient block."}
                  </p>
                </div>
                <Switch
                  checked={values.requireRecipientNameMatch}
                  onCheckedChange={(v) =>
                    onChange("requireRecipientNameMatch", v)
                  }
                />
              </div>
              <div>
                <Label className="text-xs">
                  {isAr ? "اسم/كلمة دلالية مرئية" : "Visible name token"}
                </Label>
                <Input
                  value={values.recipientNameToken}
                  onChange={(e) =>
                    onChange("recipientNameToken", e.target.value)
                  }
                  placeholder={isAr ? "مثل: غادة" : "e.g. Nagwa"}
                  autoComplete="off"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {isAr
                    ? "اكتب الجزء من اسمك الذي يظهر فعلياً في إيصال التحويل (عادةً الاسم الأول قبل التشفير بالنجوم)."
                    : 'The chunk of your name that survives the privacy mask — typically your first name (e.g. "Nagwa" for "Nagwa F**** H****").'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
