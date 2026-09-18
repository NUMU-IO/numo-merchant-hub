import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

/** A secret or snippet with a copy button. Always LTR — these are never prose. */
export function CopyBox({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-1">
      {label && <div className="text-xs text-muted-foreground">{label}</div>}
      <div className="flex items-start gap-2">
        <pre
          dir="ltr"
          className="flex-1 rounded-md border bg-muted p-3 text-xs font-mono break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
        >
          {text}
        </pre>
        <Button variant="outline" size="icon" onClick={copy} className="shrink-0">
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
