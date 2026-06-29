/**
 * CustomDomainCard — connect & monitor a merchant-owned domain via the
 * backend's Cloudflare-for-SaaS flow.
 *
 * Flow: enter `shop.brand.com` → POST registers a CF custom hostname and
 * returns a CNAME → merchant adds `CNAME shop.brand.com -> origin.numueg.app`
 * at their registrar → we poll until Cloudflare issues the cert (status goes
 * pending_dns → verifying → active). Self-contained: owns its own fetch +
 * polling so the giant StoreSettings page doesn't have to.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Globe,
  Lock,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getCustomDomain,
  connectCustomDomain,
  disconnectCustomDomain,
  type CustomDomainState,
  type CustomDomainDnsRecord,
} from "@/services/storeApi";
import { ApiError } from "@/lib/api-error";

interface Props {
  storeId: string;
  language: "en" | "ar";
  /** Called after connect/disconnect so the parent can refetch the store. */
  onChanged?: () => void;
}

const POLL_MS = 8000;

export function CustomDomainCard({ storeId, language, onChanged }: Props) {
  const isAr = language === "ar";
  const [state, setState] = useState<CustomDomainState | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getCustomDomain(storeId);
      setState(s);
    } catch {
      // Non-fatal: show the connect form on a transient read failure.
      setState({
        connected: false,
        domain: null,
        status: "none",
        ssl_status: null,
        is_active: false,
        cname: null,
        verification: [],
        errors: [],
        checked_at: null,
      });
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Poll while a domain is connected but not yet active/failed.
  useEffect(() => {
    const pending =
      state?.connected && state.status !== "active" && state.status !== "failed";
    if (pending && !pollRef.current) {
      pollRef.current = setInterval(load, POLL_MS);
    }
    if (!pending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state?.connected, state?.status, load]);

  const handleConnect = async () => {
    const domain = input.trim().toLowerCase();
    if (!domain) return;
    setBusy(true);
    try {
      const s = await connectCustomDomain(storeId, domain);
      setState(s);
      setInput("");
      onChanged?.();
      toast.success(
        isAr ? "تم ربط النطاق. أضف سجل CNAME لإكماله." : "Domain connected. Add the CNAME to finish.",
      );
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.toUserMessage(language) : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        isAr
          ? "إزالة النطاق المخصص؟ سيتوقف عن العمل فوراً."
          : "Remove the custom domain? It will stop working immediately.",
      )
    )
      return;
    setBusy(true);
    try {
      const s = await disconnectCustomDomain(storeId);
      setState(s);
      onChanged?.();
      toast.success(isAr ? "تمت إزالة النطاق" : "Custom domain removed");
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.toUserMessage(language) : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/10 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isAr ? "جارٍ التحميل…" : "Loading…"}
      </div>
    );
  }

  // ── Not connected: the connect form ──
  if (!state?.connected) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            placeholder="shop.yourbrand.com"
            className="max-w-sm font-mono"
            disabled={busy}
          />
          <Button onClick={handleConnect} disabled={busy || !input.trim()}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAr ? (
              "ربط نطاق مخصص"
            ) : (
              "Connect Custom Domain"
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground max-w-md">
          {isAr
            ? "اربط نطاقك الخاص (مثل shop.yourbrand.com). سنصدر شهادة SSL تلقائياً عبر Cloudflare."
            : "Connect a domain you own (e.g. shop.yourbrand.com). We'll auto-issue an SSL certificate via Cloudflare."}
        </p>
      </div>
    );
  }

  // ── Connected: status + instructions ──
  return (
    <div className="space-y-3">
      <DomainStatusRow state={state} isAr={isAr} />

      {state.status !== "active" && state.cname && (
        <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
          <p className="text-sm font-medium">
            {isAr
              ? "أضف سجل DNS التالي لدى مزود النطاق:"
              : "Add this DNS record at your domain provider:"}
          </p>
          <DnsRecordRow record={state.cname} />
          {state.verification.map((r, i) => (
            <DnsRecordRow key={i} record={r} />
          ))}
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "بعد إضافة السجل، قد يستغرق التفعيل حتى بضع دقائق. تتحدث الحالة تلقائياً."
              : "After adding the record, activation can take a few minutes. Status updates automatically."}
          </p>
        </div>
      )}

      {state.status === "failed" && state.errors.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1">
          {state.errors.map((err, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDisconnect}
        disabled={busy}
        className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        <span className="ml-1">{isAr ? "إزالة النطاق" : "Remove domain"}</span>
      </Button>
    </div>
  );
}

function DomainStatusRow({
  state,
  isAr,
}: {
  state: CustomDomainState;
  isAr: boolean;
}) {
  const badge = statusBadge(state.status, isAr);
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/10 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        {state.is_active ? (
          <Lock className="h-4 w-4 text-green-500" />
        ) : (
          <Globe className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold truncate">
            {state.domain}
          </span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${badge.cls}`}
          >
            {badge.spinner && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            {badge.label}
          </span>
        </div>
        {state.is_active && state.domain && (
          <a
            href={`https://${state.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary/70 flex items-center gap-1 hover:text-primary transition-colors mt-0.5"
          >
            {`https://${state.domain}`}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function DnsRecordRow({ record }: { record: CustomDomainDnsRecord }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(record.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-xs font-mono overflow-x-auto">
      <span className="font-bold text-muted-foreground shrink-0">
        {record.type}
      </span>
      <span className="text-muted-foreground shrink-0">{record.name}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-semibold flex-1 min-w-0">{record.value}</span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
        title="Copy"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

function statusBadge(
  status: CustomDomainState["status"],
  isAr: boolean,
): { label: string; cls: string; spinner?: boolean } {
  switch (status) {
    case "active":
      return {
        label: isAr ? "نشط" : "Active",
        cls: "text-emerald-600 bg-emerald-500/10",
      };
    case "verifying":
      return {
        label: isAr ? "جارٍ التحقق" : "Verifying",
        cls: "text-amber-600 bg-amber-500/10",
        spinner: true,
      };
    case "failed":
      return {
        label: isAr ? "فشل" : "Failed",
        cls: "text-red-600 bg-red-500/10",
      };
    default:
      return {
        label: isAr ? "بانتظار DNS" : "Pending DNS",
        cls: "text-blue-600 bg-blue-500/10",
      };
  }
}
