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
}

export function QrCodeDisplay({
  url,
  qrPngBase64,
  downloadName = "campaign-qr",
}: QrCodeDisplayProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [copied, setCopied] = useState(false);

  const dataUrl = `data:image/png;base64,${qrPngBase64}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isAr ? "فشل النسخ" : "Failed to copy");
    }
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
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
          {url}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {isAr ? "نسخ الرابط" : "Copy link"}
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
  );
}
