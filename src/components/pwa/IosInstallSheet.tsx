/**
 * iOS "Add to Home Screen" instructions.
 *
 * iOS has no `beforeinstallprompt` — Apple never implemented it — so on iPhone
 * an install cannot be OFFERED, only TAUGHT. This sheet is the replacement for
 * the button Android gets.
 *
 * The second variant matters more than it looks. NUMU merchants receive links
 * over WHATSAPP, which opens them in an in-app WebView where Add to Home Screen
 * is missing or degraded. Without the "open in Safari" branch, a large share of
 * iOS merchants would follow these steps, find no such menu item, and conclude
 * the app is broken.
 */
import { useState } from "react";
import { Share, Plus, Copy, Check, ExternalLink } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface IosInstallSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when we detected an in-app WebView — show the "open in browser" copy. */
  inWebView?: boolean;
}

export function IosInstallSheet({ open, onOpenChange, inWebView }: IosInstallSheetProps) {
  const { isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the merchant can still copy from the URL bar */
    }
  };

  const steps = inWebView
    ? []
    : [
        {
          Icon: Share,
          text: isRTL ? "اضغط على زرار المشاركة تحت" : "Tap the Share button below",
        },
        {
          Icon: Plus,
          text: isRTL ? 'اختار «إضافة إلى الشاشة الرئيسية»' : 'Choose "Add to Home Screen"',
        },
        {
          Icon: Check,
          text: isRTL ? 'اضغط «إضافة» فوق على اليمين' : 'Tap "Add" in the top corner',
        },
      ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="text-start text-lg font-extrabold">
            {inWebView
              ? isRTL
                ? "افتح نومو في المتصفح"
                : "Open NUMU in your browser"
              : isRTL
                ? "ضيف نومو للشاشة الرئيسية"
                : "Add NUMU to your Home Screen"}
          </SheetTitle>
        </SheetHeader>

        {inWebView ? (
          <div className="space-y-4 pb-6 pt-3">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {isRTL
                ? "انت فاتح نومو جوه تطبيق تاني، وهنا مفيش خيار التثبيت. انسخ الرابط وافتحه في سفاري أو كروم."
                : "You're viewing NUMU inside another app, where installing isn't available. Copy the link and open it in Safari or Chrome."}
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 p-3">
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]" dir="ltr">
                {typeof window !== "undefined" ? window.location.origin : ""}
              </span>
            </div>
            <Button type="button" onClick={copyLink} className="h-12 w-full rounded-xl font-bold">
              {copied ? (
                <>
                  <Check className="me-2 h-4 w-4" />
                  {isRTL ? "اتنسخ" : "Copied"}
                </>
              ) : (
                <>
                  <Copy className="me-2 h-4 w-4" />
                  {isRTL ? "انسخ الرابط" : "Copy link"}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pb-6 pt-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-[13px] font-extrabold text-white">
                  {isRTL ? ["١", "٢", "٣"][i] : i + 1}
                </span>
                <step.Icon className="h-5 w-5 shrink-0 text-saffron" aria-hidden />
                <span className="text-[15px] font-semibold leading-snug">{step.text}</span>
              </div>
            ))}
            <p className="px-1 pt-1 text-[13px] text-muted-foreground">
              {isRTL
                ? "لازم تكون فاتح الرابط في سفاري عشان الخيار ده يظهر."
                : "This option only appears in Safari."}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
