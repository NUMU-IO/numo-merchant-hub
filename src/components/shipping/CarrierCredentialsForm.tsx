/**
 * Connect-form generated from a carrier's declared credential fields.
 *
 * Replaces the hardcoded Bosta panel. The backend registry says which
 * inputs a carrier needs and what to call them in each language, so a new
 * carrier gets a working form with no frontend change.
 *
 * Verification state comes from the server, not a localStorage probe.
 * `verified === null` means the carrier declares no read-only call we can
 * make — shown as "not verified", never as connected, because a green
 * badge we cannot justify is what this whole change exists to remove.
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type Carrier,
  credentialHelp,
  credentialLabel,
} from "@/services/carrierApi";

interface Props {
  carrier: Carrier;
  isAr: boolean;
  saving?: boolean;
  verifying?: boolean;
  onSave: (values: Record<string, string>) => void;
  onVerify?: () => void;
  onDisconnect?: () => void;
}

export const CarrierCredentialsForm = ({
  carrier,
  isAr,
  saving = false,
  verifying = false,
  onSave,
  onVerify,
  onDisconnect,
}: Props) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const required = carrier.credential_fields.filter((f) => f.required);
  const complete = required.every((f) => (values[f.key] ?? "").trim().length > 0);

  const set = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      {carrier.credential_fields.map((field) => {
        const help = credentialHelp(field, isAr);
        return (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`cred-${field.key}`} className="text-xs font-medium">
              {credentialLabel(field, isAr)}
              {!field.required && (
                <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">
                  {isAr ? "(اختياري)" : "(optional)"}
                </span>
              )}
            </Label>
            <Input
              id={`cred-${field.key}`}
              type={field.secret ? "password" : "text"}
              value={values[field.key] ?? ""}
              onChange={(e) => set(field.key, e.target.value)}
              autoComplete="off"
              /* Keys and IDs are Latin/numeric even in an Arabic UI. */
              dir="ltr"
              className="font-mono text-xs"
              placeholder={
                carrier.status.is_configured
                  ? isAr
                    ? "محفوظ — اكتب قيمة جديدة للتغيير"
                    : "Saved — type a new value to change"
                  : undefined
              }
            />
            {help && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {help}
              </p>
            )}
          </div>
        );
      })}

      <VerificationNotice carrier={carrier} isAr={isAr} />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" disabled={!complete || saving} onClick={() => onSave(values)}>
          {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
          {carrier.status.is_configured
            ? isAr
              ? "تحديث البيانات"
              : "Update credentials"
            : isAr
              ? "اربط الشركة"
              : "Connect carrier"}
        </Button>

        {carrier.status.is_configured && carrier.can_verify && onVerify && (
          <Button size="sm" variant="outline" disabled={verifying} onClick={onVerify}>
            {verifying && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            {isAr ? "إعادة التحقق" : "Re-check"}
          </Button>
        )}

        {carrier.status.is_configured && onDisconnect && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDisconnect}
          >
            {isAr ? "قطع الاتصال" : "Disconnect"}
          </Button>
        )}
      </div>
    </div>
  );
};

/** Explains the three verification states in plain language. */
const VerificationNotice = ({
  carrier,
  isAr,
}: {
  carrier: Carrier;
  isAr: boolean;
}) => {
  if (!carrier.status.is_configured) return null;

  if (carrier.status.verified === true) {
    return (
      <Note tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
        {isAr
          ? "البيانات اتأكدت والشركة ردّت."
          : "Credentials confirmed — the carrier answered."}
      </Note>
    );
  }

  if (carrier.status.verified === false) {
    return (
      <Note tone="bad" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        <span>
          {isAr
            ? "الشركة رفضت البيانات دي. الشحن مقفول لحد ما تتظبط."
            : "The carrier rejected these credentials. Shipping stays off until they work."}
        </span>
        {carrier.status.verification_error && (
          <span className="mt-1 block font-mono text-[10px] opacity-70" dir="ltr">
            {carrier.status.verification_error}
          </span>
        )}
      </Note>
    );
  }

  // verified === null — nothing to probe with.
  return (
    <Note tone="muted" icon={<ShieldQuestion className="h-3.5 w-3.5" />}>
      {isAr
        ? "البيانات محفوظة، بس الشركة دي مفيهاش طريقة نتأكد بيها من غير ما نعمل شحنة حقيقية."
        : "Saved, but this carrier offers no safe way to check the keys without booking a real shipment."}
    </Note>
  );
};

const TONES = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300",
  bad: "bg-rose-50 text-rose-800 border-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300",
  muted:
    "bg-slate-50 text-slate-600 border-slate-200/70 dark:bg-slate-500/10 dark:text-slate-400",
} as const;

const Note = ({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div
    className={`flex items-start gap-2 rounded-lg border p-2.5 text-[11px] leading-relaxed ${TONES[tone]}`}
  >
    <span className="mt-px shrink-0">{icon}</span>
    <div className="min-w-0">{children}</div>
  </div>
);
