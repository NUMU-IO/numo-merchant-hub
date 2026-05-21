/**
 * PathValidator — debounced storefront-path input for trackable links.
 *
 * Validates the path against the backend's HEAD-checked validator
 * (SEC-002 hardened: internal-IP blocklist, manual redirect-host
 * check, hard 3s timeout). Shows an inline state badge as the user
 * types so they know whether the link they're about to generate
 * will produce a working page.
 *
 * The parent component reads `value` and exposes a `onValidChange`
 * callback so it can enable/disable its "Generate" button based on
 * whether the current path is known-valid.
 */

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { validatePath, type ValidatePathResponse } from "@/services/campaignApi";

interface PathValidatorProps {
  storeId: string;
  value: string;
  onChange: (next: string) => void;
  /** Called whenever the validated path's canonical form is known. */
  onValidPathChange?: (canonical: string | null) => void;
}

type Status = "idle" | "validating" | "valid" | "invalid";

export function PathValidator({
  storeId,
  value,
  onChange,
  onValidPathChange,
}: PathValidatorProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ValidatePathResponse | null>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!value.trim()) {
      setStatus("idle");
      setResult(null);
      onValidPathChange?.(null);
      return;
    }

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      const myRequestId = ++requestIdRef.current;
      setStatus("validating");
      try {
        const res = await validatePath(storeId, value.trim());
        // Stale-response guard: if the user kept typing, our result is
        // for an earlier value and must be dropped.
        if (myRequestId !== requestIdRef.current) return;
        setResult(res);
        if (res.valid) {
          setStatus("valid");
          onValidPathChange?.(res.suggested_canonical || res.canonical_path || value);
        } else {
          setStatus("invalid");
          onValidPathChange?.(null);
        }
      } catch {
        if (myRequestId !== requestIdRef.current) return;
        setStatus("invalid");
        setResult(null);
        onValidPathChange?.(null);
      }
    }, 400);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [value, storeId, onValidPathChange]);

  const reasonCopy = (() => {
    if (!result?.reason) return null;
    switch (result.reason) {
      case "path_malformed":
        return isAr ? "صيغة المسار غير صحيحة" : "Malformed path";
      case "path_not_found":
        return isAr ? "هذه الصفحة غير موجودة" : "Page not found";
      case "validation_timeout":
        return isAr ? "انتهت مهلة التحقق" : "Validation timed out";
      case "external_host":
        return isAr
          ? "المسار يشير لمضيف خارج المتجر"
          : "Path resolves to an external host";
      case "internal_target":
        return isAr
          ? "المسار يشير لمضيف داخلي محظور"
          : "Path resolves to a blocked internal host";
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="custom-path">
        {isAr ? "مسار مخصص" : "Custom path"}
      </Label>
      <div className="relative">
        <Input
          id="custom-path"
          type="text"
          dir="ltr"
          placeholder="/lookbook/eid-2026"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute inset-y-0 right-2 flex items-center text-muted-foreground">
          {status === "validating" && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {status === "valid" && (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
          {status === "invalid" && (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
        </div>
      </div>

      {status === "invalid" && reasonCopy && (
        <p className="text-xs text-amber-700">{reasonCopy}</p>
      )}
      {status === "valid" && result?.suggested_canonical && result.suggested_canonical !== value && (
        <button
          type="button"
          className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
          onClick={() => onChange(result.suggested_canonical!)}
        >
          {isAr
            ? `استخدم الرابط الموصى به: ${result.suggested_canonical}`
            : `Use canonical: ${result.suggested_canonical}`}
        </button>
      )}
    </div>
  );
}
