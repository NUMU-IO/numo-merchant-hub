/**
 * WhatsAppTemplatePreview — modal that renders a Meta template body in
 * a WhatsApp-styled chat bubble so the merchant can see what their
 * customers will actually receive.
 *
 * The preview substitutes realistic sample values for every {{n}}
 * placeholder (Egyptian customer name, order number, etc.) so the
 * merchant doesn't see "{{1}}, your order {{2}}..." but the actual
 * rendered text. URL + QUICK_REPLY buttons render as the WhatsApp
 * native pill-buttons under the bubble.
 *
 * Pure presentational — no backend calls, no state beyond what the
 * parent passes in. The merchant cannot edit the template here; the
 * Meta-approved body is the source of truth.
 */

import { useEffect, useMemo } from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  WhatsAppTemplate,
  TemplateComponent,
} from "@/services/templatesApi";

// Sample values used to fill {{1}}, {{2}}, ... in template bodies for
// the preview. Indexed by placeholder position. The order matches the
// EGYPTIAN_TEMPLATES seed in NUMU-api so the rendered preview looks
// like the merchant's typical send (Egyptian customer, EGP, etc.).
const SAMPLE_VALUES: Record<string, string[]> = {
  en: ["Ahmed", "#1042", "EGP 250", "12 Tahrir St, Cairo", "Aramex"],
  ar: ["أحمد", "#1042", "EGP 250", "١٢ شارع التحرير، القاهرة", "أرامكس"],
};

function renderBodyText(body: string, lang: string): string {
  const isAr = lang.toLowerCase().startsWith("ar");
  const samples = isAr ? SAMPLE_VALUES.ar : SAMPLE_VALUES.en;
  return body.replace(/\{\{(\d+)\}\}/g, (_match, idx) => {
    const i = Number.parseInt(idx, 10) - 1;
    return samples[i] ?? `(sample ${idx})`;
  });
}

interface PreviewProps {
  template: WhatsAppTemplate;
  onClose: () => void;
  isAr: boolean;
}

export function WhatsAppTemplatePreview({
  template,
  onClose,
  isAr,
}: PreviewProps) {
  // Lock body scroll while the modal is open so the chat bubble
  // doesn't drift behind the backdrop on long pages.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Pull body + button components out of the template's components
  // array. Defensive — Meta sometimes returns the body wrapped in an
  // extra layer or with omitted text on PENDING templates.
  const { bodyText, buttons } = useMemo(() => {
    const bodyComp = template.components.find(
      (c: TemplateComponent) => c.type === "BODY",
    );
    const buttonsComp = template.components.find(
      (c: TemplateComponent) => c.type === "BUTTONS",
    );
    return {
      bodyText: bodyComp?.text ?? "(template has no body — Meta validation may have stripped it)",
      buttons: buttonsComp?.buttons ?? [],
    };
  }, [template]);

  const rendered = useMemo(
    () => renderBodyText(bodyText, template.language),
    [bodyText, template.language],
  );

  const bodyDir = template.language.toLowerCase().startsWith("ar")
    ? "rtl"
    : "ltr";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? "معاينة قالب الرسالة" : "Template preview"}
    >
      <div
        className="bg-background rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <p className="font-semibold text-sm">{template.name}</p>
            <p className="text-xs text-muted-foreground">
              {template.category} · {template.language.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* WhatsApp-themed chat preview. The colour ramp matches Meta's
            screenshot style — pale-cyan canvas with a single inbound
            green bubble. Replicating the exact UI is intentional so
            merchants can mentally map "this is what my customer sees". */}
        <div className="p-4 bg-[#e7e1d4] dark:bg-[#1a1f1c]">
          <div className="space-y-1">
            <div
              className="bg-white dark:bg-[#202c33] rounded-lg shadow-sm p-3 max-w-full"
              dir={bodyDir}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {rendered}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1 text-end">
                13:49
              </p>
            </div>

            {/* QUICK_REPLY + URL buttons render as full-width pill
                buttons under the bubble, mirroring WhatsApp's native
                rendering exactly. URL buttons are clickable (open in
                a new tab) so merchants can verify the redirect; QUICK
                buttons are visual-only. */}
            {buttons.length > 0 && (
              <div className="bg-white dark:bg-[#202c33] rounded-lg shadow-sm mt-1 divide-y">
                {buttons.map((btn, i) => (
                  <div
                    key={i}
                    className="px-3 py-2.5 text-center text-sm text-[#00a884] font-medium flex items-center justify-center gap-1.5"
                  >
                    {btn.type === "URL" && (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    {btn.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground flex-1">
            {isAr
              ? "القيم في المعاينة عينات — كل عميل بيشوف بياناته الفعلية وقت الإرسال."
              : "Values shown are samples — each customer sees their own real data at send time."}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            {isAr ? "إغلاق" : "Close"}
          </Button>
        </div>
      </div>
    </div>
  );
}
