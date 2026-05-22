/**
 * QrCodeDisplay — render a base64 PNG from the trackable-link endpoint.
 *
 * The QR is generated server-side (single source of truth for the
 * encoded URL), so this component only renders + offers
 * copy/download affordances. No client-side QR generation.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface QrCodeDisplayProps {
  /** The trackable URL — copied to clipboard on the Copy button. */
  url: string;
  /** Base64-encoded PNG payload (no data: prefix). */
  qrPngBase64: string;
  /** File name suggestion for the downloaded PNG (without extension). */
  downloadName?: string;
  /**
   * Optional short URL (e.g. https://numueg.app/r/AB7K9XYZ) returned
   * by the trackable-link endpoint when ``with_short_link`` was true.
   * When set, gets its own copy-paste field + "Copy short link"
   * button — preferred for SMS, print, or anywhere a 200-char URL
   * is impractical.
   */
  shortUrl?: string | null;
}

export function QrCodeDisplay({
  url,
  qrPngBase64,
  downloadName = "campaign-qr",
  shortUrl,
}: QrCodeDisplayProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [copied, setCopied] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);

  const dataUrl = `data:image/png;base64,${qrPngBase64}`;

  const copyToClipboard = async (text: string, onDone: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
      toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
    } catch {
      toast.error(isAr ? "فشل النسخ" : "Failed to copy");
    }
  };

  const handleCopy = () =>
    copyToClipboard(url, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  const handleCopyShort = () => {
    if (!shortUrl) return;
    return copyToClipboard(shortUrl, () => {
      setCopiedShort(true);
      setTimeout(() => setCopiedShort(false), 2000);
    });
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${downloadName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="rounded-lg border bg-background p-3 shrink-0 self-start">
        <img
          src={dataUrl}
          alt={isAr ? "رمز QR للحملة" : "Campaign QR code"}
          width={192}
          height={192}
          className="block"
        />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {shortUrl && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              {isAr ? "الرابط القصير" : "Short link"}
            </div>
            <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 px-3 py-2 text-sm font-mono break-all">
              {shortUrl}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleCopyShort}
              className="gap-1.5"
            >
              {copiedShort ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {isAr ? "نسخ الرابط القصير" : "Copy short link"}
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          {shortUrl && (
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              {isAr ? "الرابط الكامل" : "Full link"}
            </div>
          )}
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
            {url}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={shortUrl ? "outline" : "default"}
              onClick={handleCopy}
              className="gap-1.5"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {isAr ? "نسخ الرابط الكامل" : "Copy full link"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {isAr ? "تنزيل QR" : "Download QR"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
