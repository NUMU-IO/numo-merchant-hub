import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useTrialPaywall } from "@/contexts/TrialPaywallContext";
import { apiClient } from "@/services/api";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";
import {
  fetchPaymobCredentials, savePaymobCredentials, deletePaymobCredentials,
  fetchKashierCredentials, saveKashierCredentials, deleteKashierCredentials,
  fetchFawryCredentials, saveFawryCredentials, deleteFawryCredentials,
  fetchFawaterakCredentials, saveFawaterakCredentials, deleteFawaterakCredentials,
  fetchMoyasarCredentials, saveMoyasarCredentials, deleteMoyasarCredentials,
  type PaymobCredentialsResponse, type KashierCredentialsResponse, type FawryCredentialsResponse,
  type FawaterakCredentialsResponse, type MoyasarCredentialsResponse,
} from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Eye, EyeOff, Loader2, Check, Banknote,
  Trash2, ArrowLeft, Zap, CircleDollarSign, Link2,
  CheckCircle2, ArrowUpRight, ShieldCheck,
} from "lucide-react";
import InstapaySetupCard from "@/components/payments/InstapaySetupCard";
import CodDepositPolicyCard from "@/components/payments/CodDepositPolicyCard";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════════════════════════════════
   REAL BRAND LOGOS
   ═══════════════════════════════════════════════════════════════════════ */

/* Paymob — blue italic wordmark (#1A8CFF) */
const PaymobLogo = ({ height = 18 }: { height?: number }) => (
  <span style={{ color: "#1A8CFF", fontSize: height, fontWeight: 800, fontStyle: "italic", letterSpacing: "-0.02em", fontFamily: "system-ui, sans-serif" }}>paymob</span>
);
const PaymobIcon = ({ size = 32 }: { size?: number }) => (
  <img src="/paymob-icon.webp" alt="Paymob" className="rounded-lg" style={{ width: size, height: size, objectFit: "cover" }} />
);

/* Kashier — teal wordmark (#2EC4B6) + orange subtitle (#F4845F) */
const KashierLogo = ({ height = 18 }: { height?: number }) => (
  <span className="inline-flex items-baseline gap-1">
    <span style={{ color: "#2EC4B6", fontSize: height, fontWeight: 800, letterSpacing: "-0.01em", fontFamily: "system-ui, sans-serif" }}>Kashier</span>
    <span style={{ color: "#F4845F", fontSize: height * 0.55, fontWeight: 500, fontStyle: "italic", fontFamily: "system-ui" }}>Payment Solutions</span>
  </span>
);
const KashierIcon = ({ size = 32 }: { size?: number }) => (
  <img src="/kashier-icon.webp" alt="Kashier" className="rounded-lg" style={{ width: size, height: size, objectFit: "cover" }} />
);

/* Fawry — official logo + icon images */
const FawryLogo = ({ height = 18 }: { height?: number }) => (
  <img src="/fawry-logo.webp" alt="Fawry" style={{ height, objectFit: "contain" }} />
);
const FawryIcon = ({ size = 32 }: { size?: number }) => (
  <img src="/fawry-icon.webp" alt="Fawry" className="rounded-lg" style={{ width: size, height: size, objectFit: "cover" }} />
);

/* Fawaterak — purple wordmark (#6C63FF) */
const FawaterakLogo = ({ height = 18 }: { height?: number }) => (
  <span style={{ color: "#6C63FF", fontSize: height, fontWeight: 800, letterSpacing: "-0.01em", fontFamily: "system-ui, sans-serif" }}>fawaterak</span>
);
const FawaterakIcon = ({ size = 32 }: { size?: number }) => (
  <div className="rounded-lg flex items-center justify-center" style={{ width: size, height: size, background: "#6C63FF12" }}>
    <span style={{ color: "#6C63FF", fontSize: size * 0.45, fontWeight: 900, fontFamily: "system-ui" }}>F</span>
  </div>
);

/* Moyasar (KSA) — official "M" mark. Asset: docs.moyasar.com/img/logo.svg */
const MOYASAR_MARK = "M64.71,2.7c38.7-9.73,77.4,7.36,96.27,42.53l37.11,69.15-32.97,61.43-55.33-103.11c-9.4-17.52-26.04-14.88-30.92-13.66-4.88,1.23-20.78,6.77-20.78,26.65v242.57c0,19.88,15.91,25.43,20.78,26.65,4.88,1.24,21.52,3.86,30.92-13.66L268.64,45.23c18.87-35.17,57.57-52.26,96.27-42.53,38.71,9.73,64.71,43.08,64.71,82.99v242.57c0,39.91-26.01,73.27-64.72,82.99-7.24,1.82-14.48,2.7-21.59,2.7-30.89,0-59.33-16.64-74.67-45.23l-37.42-69.74,32.97-61.43,55.65,103.7c9.4,17.52,26.05,14.89,30.92,13.66,4.88-1.23,20.78-6.77,20.78-26.65V85.7c0-19.88-15.91-25.43-20.78-26.65-1.52-.38-4.2-.9-7.44-.9-7.13,0-17.01,2.52-23.48,14.56l-158.85,296.03c-15.34,28.59-43.78,45.23-74.67,45.23-7.11,0-14.35-.88-21.59-2.7C26.01,401.54,0,368.18,0,328.27V85.7C0,45.79,26.01,12.43,64.71,2.7Z";
const MoyasarLogo = ({ height = 18 }: { height?: number }) => (
  <span className="inline-flex items-center gap-1.5">
    <svg height={height} viewBox="0 0 429.63 413.97" fill="none" xmlns="http://www.w3.org/2000/svg"><path d={MOYASAR_MARK} fill="#191502" /></svg>
    <span style={{ color: "#191502", fontSize: height, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "system-ui, sans-serif" }}>moyasar</span>
  </span>
);
const MoyasarIcon = ({ size = 32 }: { size?: number }) => (
  <div className="rounded-lg flex items-center justify-center" style={{ width: size, height: size, background: "#19150210" }}>
    <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 429.63 413.97" fill="none" xmlns="http://www.w3.org/2000/svg"><path d={MOYASAR_MARK} fill="#191502" /></svg>
  </div>
);

/* Tamara — from official CDN SVG (black wordmark + circle dot) */
const TamaraLogo = ({ height = 16 }: { height?: number }) => {
  const w = (200 / 56) * height;
  return (
    <svg width={w} height={height} viewBox="0 0 200 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M98.425 20.257c-2.447-.92-4.815-1.366-7.796-.735-2.328.492-4.198 1.43-5.426 3.768.54.44 1.025.858 1.5 1.272.779.678 1.587 1.375 2.67 2.187.856-1.224 2.353-2.601 3.957-2.633 1.862-.037 3.647.99 3.941 2.493.12.623.2 3.199.2 3.199l-.977.208c-.193.073-.406.073-.6 0l-.154-.06-.126-.049c-2.005-.776-4.132-1.19-6.282-1.223a12.4 12.4 0 00-2.16.168c-2.192.346-4.8 1.587-4.754 5.546.017 1.506.331 2.636.994 3.553a5.63 5.63 0 003.27 1.982 6.15 6.15 0 002.935-.32c2.49.076 4.922-.77 6.828-2.378l.124-.128.454-.404 1.345-1.043v3.925h5.61V26.863c.004-3.107-1.686-5.508-4.602-6.606zm-1.733 12.895c-1.2 2.15-3.156 3.364-5.406 3.364l-.286 0a7.5 7.5 0 01-1.405-.18c-1.682-.443-2.638-1.798-2.566-3.622l.034-.797h10.318l-.689 1.235z" fill="currentColor"/>
      <path d="M157.04 20.257c-2.447-.92-4.815-1.366-7.793-.735-2.33.492-4.201 1.43-5.426 3.768.54.44 1.025.858 1.499 1.272.783.678 1.588 1.375 2.67 2.187.857-1.224 2.356-2.601 3.958-2.633 1.865-.037 3.647.99 3.941 2.493.12.623.2 3.199.2 3.199l-.974.208a.79.79 0 01-.6 0l-.148-.06-.128-.049c-2.006-.776-4.133-1.19-6.283-1.223a12.4 12.4 0 00-2.159.168c-2.193.346-4.8 1.587-4.754 5.546.017 1.506.334 2.636.994 3.553a5.63 5.63 0 003.269 1.982 6.15 6.15 0 002.936-.32c2.492.077 4.924-.77 6.83-2.378l.037-.031.454-.428 1.345-1.043v3.925h5.611V26.863c0-3.107-1.691-5.508-4.606-6.606zm-1.734 12.895c-1.196 2.15-3.155 3.364-5.402 3.364l-.286 0a7.5 7.5 0 01-1.402-.18c-1.685-.443-2.642-1.798-2.57-3.622l.034-.797h10.315l-.689 1.235z" fill="currentColor"/>
      <path d="M195.377 20.257c-2.448-.92-4.815-1.366-7.796-.735-2.327.492-4.198 1.43-5.426 3.768.54.44 1.025.858 1.499 1.272.78.678 1.588 1.375 2.67 2.187.857-1.224 2.353-2.601 3.958-2.633 1.865-.037 3.647.99 3.941 2.493.12.623.2 3.199.2 3.199l-.977.208a.79.79 0 01-.574 0l-.154-.06-.128-.049c-2.006-.776-4.133-1.19-6.283-1.223a12.4 12.4 0 00-2.158.168c-2.194.346-4.801 1.587-4.754 5.546.017 1.506.334 2.636.994 3.553a5.63 5.63 0 003.27 1.982 6.15 6.15 0 002.935-.32c2.492.077 4.925-.77 6.831-2.378l.037-.031.457-.428 1.345-1.043v3.925h5.611V26.863c.003-3.107-1.688-5.508-4.606-6.606zm-1.734 12.895c-1.199 2.15-3.155 3.364-5.405 3.364l-.286 0a7.5 7.5 0 01-1.405-.18c-1.682-.443-2.639-1.798-2.566-3.622l.034-.797h10.312l-.684 1.235z" fill="currentColor"/>
      <path d="M177.018 20.992a5.5 5.5 0 00-3.967 2.441c-.094.171-.699 1.36-.699 1.36l-1.345-.311v-.664V21.27h-5.426v19.357h5.44v-1.758c0-1.822 0-3.64 0-5.457v-.346c0-.643-.043-1.31 0-1.975.079-1.166.562-2.267 1.365-3.114a4.64 4.64 0 013.035-1.528c.76-.109 2.671-.117 2.879-.12v-5.35c-.454-.005-.871-.008-1.282.012z" fill="currentColor"/>
      <path d="M78.219 36.105a8.8 8.8 0 01-1.428-.115c-1.428-.234-2.339-.937-2.727-2.095a5.3 5.3 0 01-.286-1.507V23.745l.843-.037c1.802-.089 3.712-.22 5.526-.723l-1.157-3.948-5.211.775V14h-6.154v5.811h-4.158v3.985h4.158s0 8.218.034 10.316c.004 1.281.373 2.535 1.065 3.613.828 1.261 2.03 2.05 3.79 2.484a14 14 0 005.84.02h.485V36.128h-.234l-.386-.023z" fill="currentColor"/>
      <path d="M125.339 29.722c0-1.955 1.314-3.499 3.099-3.665 2.153-.203 3.666.875 4.052 2.878.058.353.081.71.071 1.067v8.673 1.926h5.426V27.603c.006-.63-.046-1.26-.154-1.881-.451-2.401-1.736-3.865-3.904-4.482-2.347-.657-6.282-.166-8.11 3.033l-.834 1.669c-.479-2.395-1.847-4.13-4.029-4.757-2.347-.657-5.888-.106-7.71 3.093l-.817 1.43v-4.348h-5.676v19.36h5.654s0-7.675 0-10.502c0-.362.023-.724.069-1.083a3.64 3.64 0 01.784-2.078 3.14 3.14 0 011.7-1.045c1.548-.4 3.156.097 3.998 1.244.499.74.742 1.624.694 2.516v10.693h5.688V29.722z" fill="currentColor"/>
      <path d="M2.596 21.526A13.4 13.4 0 000 25.611l17.99 14.933a12.7 12.7 0 002.419-1.946l.351-.366c6.816-7.124 2.339-14.841-.377-17.437A13.05 13.05 0 0011.596 17.374a13.06 13.06 0 00-8.632 3.795l-.368.357z" fill="currentColor"/>
      <circle cx="39.71" cy="29.793" r="12.469" fill="currentColor"/>
    </svg>
  );
};
const TamaraIcon = ({ size = 32 }: { size?: number }) => (
  <div className="rounded-lg flex items-center justify-center" style={{ width: size, height: size, background: "#00000008" }}>
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 52 42" fill="none"><path d="M2.596 4.526A13.4 13.4 0 000 8.611l17.99 14.933a12.7 12.7 0 002.419-1.946l.351-.366c6.816-7.124 2.339-14.841-.377-17.437A13.05 13.05 0 0011.596.374 13.06 13.06 0 002.964 4.17l-.368.357z" fill="currentColor"/><circle cx="39.71" cy="12.793" r="12.469" fill="currentColor"/></svg>
  </div>
);

/* Tabby — green pill badge (#5AFEAE) with dark text */
const TabbyLogo = ({ height = 16 }: { height?: number }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ background: "#5AFEAE", color: "#292929", fontSize: height * 0.85, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "system-ui, sans-serif" }}>tabby</span>
);
const TabbyIcon = ({ size = 32 }: { size?: number }) => (
  <div className="rounded-lg flex items-center justify-center" style={{ width: size, height: size, background: "#5AFEAE" }}>
    <span style={{ color: "#292929", fontSize: size * 0.4, fontWeight: 900, fontFamily: "system-ui" }}>t</span>
  </div>
);

/* ValU — teal wordmark (#2ABFAC) + orange asterisk (#F26522) */
const ValuLogo = ({ height = 18 }: { height?: number }) => (
  <span className="inline-flex items-start">
    <span style={{ color: "#2ABFAC", fontSize: height, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "system-ui, sans-serif" }}>valU</span>
    <span style={{ color: "#F26522", fontSize: height * 0.7, fontWeight: 900, lineHeight: 1, fontFamily: "system-ui" }}>*</span>
  </span>
);
const ValuIcon = ({ size = 32 }: { size?: number }) => (
  <div className="rounded-lg flex items-center justify-center" style={{ width: size, height: size, background: "#2ABFAC12" }}>
    <span style={{ color: "#2ABFAC", fontSize: size * 0.45, fontWeight: 900, fontFamily: "system-ui" }}>V</span>
    <span style={{ color: "#F26522", fontSize: size * 0.3, fontWeight: 900, fontFamily: "system-ui", marginTop: -4 }}>*</span>
  </div>
);

const NUMU_PRIMARY = "hsl(222.2, 47.4%, 11.2%)";

/* ═══════════════════════════════════════════════════════════════════════
   CARRIER META
   ═══════════════════════════════════════════════════════════════════════ */

type GatewayKey = "paymob" | "kashier" | "fawry" | "fawaterak" | "moyasar";
interface GatewayMeta { key: GatewayKey; market: "EG" | "SA"; color: string; description: string; descriptionAr: string; methods: string[]; }
const GATEWAYS: GatewayMeta[] = [
  { key: "paymob", market: "EG", color: "#1A8CFF", description: "Accept cards, wallets, and installments through Egypt's leading payment processor.", descriptionAr: "قبول البطاقات والمحافظ الإلكترونية والتقسيط عبر أكبر معالج مدفوعات في مصر.", methods: ["Visa", "Mastercard", "Meeza", "Wallets", "ValU"] },
  { key: "kashier", market: "EG", color: "#2EC4B6", description: "Simple card payments with quick integration. Accept Visa and Mastercard.", descriptionAr: "مدفوعات بطاقات بسيطة مع تكامل سريع. قبول فيزا وماستركارد.", methods: ["Visa", "Mastercard"] },
  { key: "fawry", market: "EG", color: "#F7941D", description: "Accept payments at 250,000+ Fawry retail points across Egypt.", descriptionAr: "قبول المدفوعات عبر أكثر من 250,000 نقطة فوري في مصر.", methods: ["Fawry Pay", "Reference Code"] },
  { key: "fawaterak", market: "EG", color: "#6C63FF", description: "Accept cards, wallets, Fawry, Aman & Masary through one integration.", descriptionAr: "قبول البطاقات والمحافظ وفوري وأمان ومصاري عبر تكامل واحد.", methods: ["Visa", "Mastercard", "Wallets", "Fawry", "Aman"] },
  { key: "moyasar", market: "SA", color: "#191502", description: "Accept mada, Visa, Mastercard, and Apple Pay through Saudi Arabia's leading gateway.", descriptionAr: "قبول مدى وفيزا وماستركارد وApple Pay عبر بوابة الدفع الرائدة في السعودية.", methods: ["mada", "Visa", "Mastercard", "Apple Pay"] },
];

/* Brand icon / wordmark by gateway key — used in the card grid and the
   detail header so a new gateway only needs one switch arm. */
const gatewayIcon = (key: GatewayKey, size: number) =>
  key === "paymob" ? <PaymobIcon size={size} />
  : key === "kashier" ? <KashierIcon size={size} />
  : key === "fawaterak" ? <FawaterakIcon size={size} />
  : key === "moyasar" ? <MoyasarIcon size={size} />
  : <FawryIcon size={size} />;
const gatewayLogo = (key: GatewayKey, height: number) =>
  key === "paymob" ? <PaymobLogo height={height} />
  : key === "kashier" ? <KashierLogo height={height} />
  : key === "fawaterak" ? <FawaterakLogo height={height} />
  : key === "moyasar" ? <MoyasarLogo height={height} />
  : <FawryLogo height={height} />;

interface BnplMeta { key: string; color: string; description: string; descriptionAr: string; }
const BNPL: BnplMeta[] = [
  { key: "tabby", color: "#5AFEAE", description: "Split purchases into 4 interest-free payments.", descriptionAr: "قسّم المشتريات إلى 4 دفعات بدون فوائد." },
  { key: "tamara", color: "#000000", description: "Grow your sales with flexible BNPL solutions.", descriptionAr: "نمو أعمالك من خلال حلول الدفع المرنة." },
  { key: "valu", color: "#2ABFAC", description: "Enable installment plans up to 60 months.", descriptionAr: "تفعيل خطط التقسيط حتى 60 شهراً." },
];

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT — Hub + Gateway sub-views
   ═══════════════════════════════════════════════════════════════════════ */

type PageView = "hub" | GatewayKey;

const PaymentSetup = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const { requireTrial } = useTrialPaywall();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const navigate = useNavigate();

  // The store's market decides which gateways are offered: a Saudi store
  // sees Moyasar only; an Egyptian store sees the Egyptian gateways only.
  const market: "EG" | "SA" =
    (currentStore?.country || "EG").toUpperCase() === "SA" ? "SA" : "EG";
  const visibleGateways = GATEWAYS.filter((g) => g.market === market);

  const [view, setView] = useState<PageView>("hub");
  const [paymobCreds, setPaymobCreds] = useState<PaymobCredentialsResponse | null>(null);
  const [kashierCreds, setKashierCreds] = useState<KashierCredentialsResponse | null>(null);
  const [fawryCreds, setFawryCreds] = useState<FawryCredentialsResponse | null>(null);
  const [fawaterakCreds, setFawaterakCreds] = useState<FawaterakCredentialsResponse | null>(null);
  const [moyasarCreds, setMoyasarCreds] = useState<MoyasarCredentialsResponse | null>(null);
  const [enabledGateway, setEnabledGateway] = useState<GatewayKey | null>(null);
  const [codEnabled, setCodEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    // Hydrate codEnabled from the server — payment.cod.enabled is the
    // source of truth that drives whether COD shows at checkout. Without
    // this, the toggle defaults to `true` on every page load and
    // silently disagrees with what the storefront actually sees.
    Promise.all([
      fetchPaymobCredentials(storeId).catch(() => null),
      fetchKashierCredentials(storeId).catch(() => null),
      fetchFawryCredentials(storeId).catch(() => null),
      fetchFawaterakCredentials(storeId).catch(() => null),
      fetchMoyasarCredentials(storeId).catch(() => null),
      apiClient<{ payment: { cod?: { enabled?: boolean } } }>(
        `/stores/${storeId}/settings`,
      ).catch(() => null),
    ])
      .then(([p, k, f, fw, m, settings]) => {
        setPaymobCreds(p); setKashierCreds(k); setFawryCreds(f); setFawaterakCreds(fw); setMoyasarCreds(m);
        if (settings?.payment?.cod?.enabled !== undefined) {
          setCodEnabled(Boolean(settings.payment.cod.enabled));
        }
        const configured = [
          p?.is_configured ? { key: "paymob" as const, time: p.last_configured ? new Date(p.last_configured).getTime() : 0 } : null,
          k?.is_configured ? { key: "kashier" as const, time: k.last_configured ? new Date(k.last_configured).getTime() : 0 } : null,
          f?.is_configured ? { key: "fawry" as const, time: f.last_configured ? new Date(f.last_configured).getTime() : 0 } : null,
          fw?.is_configured ? { key: "fawaterak" as const, time: fw.last_configured ? new Date(fw.last_configured).getTime() : 0 } : null,
          m?.is_configured ? { key: "moyasar" as const, time: m.last_configured ? new Date(m.last_configured).getTime() : 0 } : null,
        ].filter(Boolean) as { key: GatewayKey; time: number }[];
        if (configured.length > 0) setEnabledGateway(configured.sort((a, b) => b.time - a.time)[0].key);
      }).finally(() => setLoading(false));
  }, [storeId]);

  // Persist COD toggle on change. Optimistic — rolls back on failure.
  // The storefront's GET /payment-methods gates COD on this same flag,
  // so changes here are reflected at checkout immediately (no cache).
  const handleToggleCod = async (next: boolean) => {
    if (!storeId) return;
    const previous = codEnabled;
    setCodEnabled(next);
    try {
      await apiClient(`/stores/${storeId}/settings/payment`, {
        method: "PATCH",
        body: JSON.stringify({ cod_enabled: next }),
      });
      toast.success(
        next
          ? (isAr ? "تم تفعيل الدفع عند الاستلام" : "Cash on delivery enabled")
          : (isAr ? "تم إيقاف الدفع عند الاستلام" : "Cash on delivery disabled"),
      );
    } catch (err) {
      setCodEnabled(previous);
      showError(err);
    }
  };

  const getStatus = (key: GatewayKey) => {
    const c = key === "paymob" ? paymobCreds : key === "kashier" ? kashierCreds : key === "fawaterak" ? fawaterakCreds : key === "moyasar" ? moyasarCreds : fawryCreds;
    if (!c?.is_configured) return "not_configured";
    return enabledGateway === key ? "live" : "ready";
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  /* ═══════════════════════════════════════════════════════════════
     GATEWAY DETAIL VIEW (Bosta-style)
     ═══════════════════════════════════════════════════════════════ */
  if (view === "moyasar") {
    return (
      <MoyasarDetailView
        storeId={storeId} isAr={isAr} language={language}
        creds={moyasarCreds} setCreds={setMoyasarCreds}
        enabledGateway={enabledGateway} setEnabledGateway={setEnabledGateway}
        onBack={() => setView("hub")}
      />
    );
  }

  if (view === "paymob" || view === "kashier" || view === "fawry" || view === "fawaterak") {
    return (
      <GatewayDetailView
        gatewayKey={view} storeId={storeId} isAr={isAr} language={language}
        paymobCreds={paymobCreds} kashierCreds={kashierCreds} fawryCreds={fawryCreds} fawaterakCreds={fawaterakCreds}
        setPaymobCreds={setPaymobCreds} setKashierCreds={setKashierCreds} setFawryCreds={setFawryCreds} setFawaterakCreds={setFawaterakCreds}
        enabledGateway={enabledGateway} setEnabledGateway={setEnabledGateway}
        onBack={() => setView("hub")}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     HUB VIEW
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigate("/payments")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "المدفوعات" : "Payments"}</h1>
      </div>

      {/* ── Section: البطاقات — Cards ── */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b"><h2 className="text-base font-bold">{isAr ? "البطاقات" : "Cards"}</h2></div>
        <div className="p-5">
          {/* Supported networks */}
          <div className="rounded-xl border bg-muted/20 p-5 mb-6">
            <p className="text-sm font-semibold mb-1">{isAr ? "شبكات الدفع المدعومة" : "Supported Payment Networks"}</p>
            <p className="text-xs text-muted-foreground mb-3">{market === "SA" ? (isAr ? "مدى · فيزا/ماستركارد · Apple Pay" : "mada · Visa/Mastercard · Apple Pay") : (isAr ? "ميزة - فيزا/ماستركارد - المحافظ الإلكترونية - أمريكان اكسبريس" : "Meeza · Visa/Mastercard · Mobile Wallets · Amex")}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {(market === "SA" ? ["mada", "VISA", "Mastercard", "Apple Pay"] : ["VISA", "Mastercard", "Meeza", "Apple Pay", "Wallet"]).map(n => (
                <span key={n} className="px-2.5 py-1 rounded-md bg-background border text-[10px] font-medium tracking-wide">{n}</span>
              ))}
            </div>
          </div>

          {/* Hero banner */}
          <div className="rounded-xl p-6 mb-6 text-white relative overflow-hidden" style={{ background: NUMU_PRIMARY }}>
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "url('/numu-n-mark-transparent.png')", backgroundSize: "120px", backgroundRepeat: "repeat" }} />
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-1">{isAr ? "ابدأ باستقبال المدفوعات الإلكترونية فوراً من خلال نمو!" : "Start accepting payments instantly with NUMU!"}</h3>
              <div className="grid gap-4 sm:grid-cols-3 mt-5">
                {[
                  { icon: <Zap className="h-5 w-5" />, title: isAr ? "تفعيل فوري" : "Instant Activation", bullets: isAr ? ["تفعيل الدفع بنقرة زر", "استلام المدفوعات فوراً"] : ["Activate payments in one click", "Receive payments immediately"] },
                  { icon: <CircleDollarSign className="h-5 w-5" />, title: isAr ? "أسعار تنافسية" : "Competitive Rates", bullets: isAr ? ["بدون رسوم إعداد", "بدون رسوم شهرية"] : ["No setup fees", "No monthly fees"] },
                  { icon: <Link2 className="h-5 w-5" />, title: isAr ? "روابط دفع سريعة" : "Payment Links", bullets: isAr ? ["مشاركة روابط الدفع", "تنبيهات لإكمال الدفع"] : ["Share payment links", "Send payment reminders"] },
                ].map((c, i) => (
                  <div key={i} className="rounded-lg bg-white/[0.08] backdrop-blur-sm p-4">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mb-3">{c.icon}</div>
                    <p className="text-sm font-semibold mb-2">{c.title}</p>
                    <ul className="space-y-1.5">{c.bullets.map((b, j) => <li key={j} className="flex items-start gap-1.5 text-[11px] text-white/80"><CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0 text-white/60" />{b}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gateway cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {visibleGateways.map(gw => {
              const status = getStatus(gw.key);
              return (
                <div key={gw.key} className="group rounded-xl border bg-background p-5 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer" onClick={() => setView(gw.key)}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {gatewayIcon(gw.key, 36)}
                        <div>
                          {gatewayLogo(gw.key, 15)}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {status === "live" && <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{isAr ? "نشط" : "LIVE"}</span>}
                            {status === "ready" && <Badge variant="secondary" className="text-[9px]">{isAr ? "مُعد" : "Ready"}</Badge>}
                            {status === "not_configured" && <span className="text-[9px] text-muted-foreground">{isAr ? "غير مفعّل" : "Not active"}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{isAr ? gw.descriptionAr : gw.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {gw.methods.map(m => <span key={m} className="text-[10px] px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground">{m}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button variant={status === "not_configured" ? "default" : "outline"} size="sm" className="h-8 text-xs rounded-lg">
                      {status === "not_configured" ? (isAr ? "تفعيل" : "Activate") : (isAr ? "إدارة" : "Manage")}
                    </Button>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section: InstaPay (Egypt only) ── */}
      {storeId && market === "EG" ? (
        <InstapaySetupCard storeId={storeId} isAr={isAr} />
      ) : null}

      {/* ── Section: COD ── */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b"><h2 className="text-base font-bold">{isAr ? "الدفع عند الاستلام" : "Cash on Delivery"}</h2></div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl border bg-background p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><img src="/icons/cod.webp" alt="" className="h-6 w-6" /></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{isAr ? "الدفع نقداً" : "Cash on Delivery"}</span>
                  {codEnabled && <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{isAr ? "نشط" : "LIVE"}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{isAr ? "العميل يدفع نقداً عند الاستلام" : "Customer pays on delivery"}</p>
              </div>
            </div>
            <Switch checked={codEnabled} onCheckedChange={handleToggleCod} />
          </div>

          {/* COD Deposit-to-confirm policy */}
          {storeId ? (
            <CodDepositPolicyCard
              storeId={storeId}
              isAr={isAr}
              codEnabled={codEnabled}
            />
          ) : null}

          {/* COD Fraud Protection — moved to the dedicated Trust Network page */}
          <button
            type="button"
            onClick={() => navigate("/trust-network")}
            className="w-full text-start rounded-xl border bg-background p-5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{isAr ? "حماية من احتيال الدفع عند الاستلام" : "COD Fraud Protection"}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-violet-600 bg-violet-500/10 px-1.5 py-0.5 rounded">{isAr ? "شبكة نمو" : "NUMU NETWORK"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isAr ? "انتقلت إعدادات شبكة الثقة إلى صفحتها المخصّصة — اضغط للفتح." : "Trust Network settings have moved to their own page — tap to open."}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </button>
        </div>
      </div>

      {/* ── Section: BNPL ── */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b"><h2 className="text-base font-bold">{isAr ? "الدفع لاحقاً" : "Buy Now, Pay Later"}</h2></div>
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {BNPL.filter(p => p.key !== "valu" || market === "EG").map(p => (
              <div key={p.key} className="rounded-xl border bg-background p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    {p.key === "tabby" ? <TabbyIcon size={36} /> : p.key === "tamara" ? <TamaraIcon size={36} /> : <ValuIcon size={36} />}
                    <div>
                      {p.key === "tabby" ? <TabbyLogo height={14} /> : p.key === "tamara" ? <TamaraLogo height={12} /> : <ValuLogo height={16} />}
                      <Badge variant="secondary" className="text-[9px] mt-0.5">{isAr ? "قريبًا" : "Coming Soon"}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">{isAr ? p.descriptionAr : p.description}</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs w-full rounded-lg" disabled>{isAr ? "قريبًا" : "Coming Soon"}</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   GATEWAY DETAIL VIEW — Bosta-style dedicated page
   ═══════════════════════════════════════════════════════════════════════ */

interface GatewayDetailProps {
  gatewayKey: GatewayKey;
  storeId: string | undefined;
  isAr: boolean;
  language: string;
  paymobCreds: PaymobCredentialsResponse | null;
  kashierCreds: KashierCredentialsResponse | null;
  fawryCreds: FawryCredentialsResponse | null;
  fawaterakCreds: FawaterakCredentialsResponse | null;
  setPaymobCreds: (c: PaymobCredentialsResponse) => void;
  setKashierCreds: (c: KashierCredentialsResponse) => void;
  setFawryCreds: (c: FawryCredentialsResponse) => void;
  setFawaterakCreds: (c: FawaterakCredentialsResponse) => void;
  enabledGateway: GatewayKey | null;
  setEnabledGateway: (g: GatewayKey | null) => void;
  onBack: () => void;
}

const GatewayDetailView = ({ gatewayKey, storeId, isAr, language, paymobCreds, kashierCreds, fawryCreds, fawaterakCreds, setPaymobCreds, setKashierCreds, setFawryCreds, setFawaterakCreds, enabledGateway, setEnabledGateway, onBack }: GatewayDetailProps) => {
  const isPaymob = gatewayKey === "paymob";
  const isFawry = gatewayKey === "fawry";
  const isFawaterak = gatewayKey === "fawaterak";
  const creds = isPaymob ? paymobCreds : isFawry ? fawryCreds : isFawaterak ? fawaterakCreds : kashierCreds;
  const color = isPaymob ? "#1A8CFF" : isFawry ? "#F7941D" : isFawaterak ? "#6C63FF" : "#2EC4B6";

  // Gate connect actions behind the trial paywall (handleSave calls
  // requireTrial). Without this hook the call threw "requireTrial is not
  // defined" on /payment-setup (Sentry).
  const { requireTrial } = useTrialPaywall();

  const [editing, setEditing] = useState(!creds?.is_configured);
  const [paymobForm, setPaymobForm] = useState({ secret_key: "", public_key: "", hmac_secret: "", card_integration_id: "", wallet_integration_id: "", apple_pay_integration_id: "" });
  const [kashierForm, setKashierForm] = useState({ merchant_id: "", api_key: "", secret_key: "", apple_pay_enabled: kashierCreds?.apple_pay_enabled ?? false });
  const [fawryForm, setFawryForm] = useState({ merchant_code: "", security_key: "" });
  const [fawaterakForm, setFawaterakForm] = useState({ api_key: "", vendor_key: "", environment: "staging" });
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [enablingSaving, setEnablingSaving] = useState(false);

  const handleSave = async () => {
    if (!storeId) return;
    if (!requireTrial("connect_payment")) return;
    setSaving(true);
    let validationWarning: string | null = null;
    try {
      if (isPaymob) {
        const r = await savePaymobCredentials(storeId, { secret_key: paymobForm.secret_key, public_key: paymobForm.public_key, hmac_secret: paymobForm.hmac_secret, card_integration_id: paymobForm.card_integration_id, wallet_integration_id: paymobForm.wallet_integration_id || undefined, apple_pay_integration_id: paymobForm.apple_pay_integration_id || undefined });
        setPaymobCreds(r); setPaymobForm({ secret_key: "", public_key: "", hmac_secret: "", card_integration_id: "", wallet_integration_id: "", apple_pay_integration_id: "" });
        validationWarning = r.validation_warning ?? null;
      } else if (isFawry) {
        const r = await saveFawryCredentials(storeId, { merchant_code: fawryForm.merchant_code, security_key: fawryForm.security_key });
        setFawryCreds(r); setFawryForm({ merchant_code: "", security_key: "" });
      } else if (isFawaterak) {
        const r = await saveFawaterakCredentials(storeId, { api_key: fawaterakForm.api_key, vendor_key: fawaterakForm.vendor_key, environment: fawaterakForm.environment });
        setFawaterakCreds(r); setFawaterakForm({ api_key: "", vendor_key: "", environment: "staging" });
      } else {
        const r = await saveKashierCredentials(storeId, { merchant_id: kashierForm.merchant_id, api_key: kashierForm.api_key, secret_key: kashierForm.secret_key || undefined, apple_pay_enabled: kashierForm.apple_pay_enabled });
        setKashierCreds(r); setKashierForm({ merchant_id: "", api_key: "", secret_key: "", apple_pay_enabled: false });
      }
      setEnabledGateway(gatewayKey); setEditing(false);
      if (validationWarning) {
        // Saved, but the live probe (e.g. Paymob) rejected the credentials —
        // show the real reason now instead of letting checkout fail later.
        toast.error(
          (isAr ? "تم الحفظ لكن فشل التحقق: " : "Saved, but validation failed: ") + validationWarning,
          { duration: 12000 },
        );
      } else {
        toast.success(isAr ? "تم التفعيل بنجاح" : "Activated successfully");
      }
    } catch (e) { showError(e, language); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!storeId) return;
    try {
      if (isPaymob) { await deletePaymobCredentials(storeId); setPaymobCreds({ is_configured: false, public_key_masked: null, secret_key_masked: null, hmac_secret_masked: null, card_integration_id: null, wallet_integration_id: null, last_configured: null }); }
      else if (isFawry) { await deleteFawryCredentials(storeId); setFawryCreds({ is_configured: false, merchant_code: null, security_key_masked: null, last_configured: null }); }
      else if (isFawaterak) { await deleteFawaterakCredentials(storeId); setFawaterakCreds({ is_configured: false, api_key_masked: null, vendor_key_masked: null, environment: null, last_configured: null }); }
      else { await deleteKashierCredentials(storeId); setKashierCreds({ is_configured: false, merchant_id: null, api_key_masked: null, last_configured: null }); }
      if (enabledGateway === gatewayKey) setEnabledGateway(null);
      toast.success(isAr ? "تم قطع الاتصال" : "Disconnected");
    } catch (e) { showError(e, language); }
  };

  const handleToggle = async (checked: boolean) => {
    if (!storeId) return; setEnablingSaving(true);
    try {
      await apiClient(`/stores/${storeId}/settings/payment`, { method: "PATCH", body: JSON.stringify({ paymob_enabled: isPaymob ? checked : false, kashier_enabled: gatewayKey === "kashier" ? checked : false, fawry_enabled: isFawry ? checked : false, fawaterak_enabled: isFawaterak ? checked : false }) });
      setEnabledGateway(checked ? gatewayKey : null);
      toast.success(checked ? (isAr ? "تم التفعيل" : "Enabled") : (isAr ? "تم الإيقاف" : "Disabled"));
    } catch (e) { showError(e, language); } finally { setEnablingSaving(false); }
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      {/* Header with brand */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          {isPaymob ? <PaymobIcon size={36} /> : isFawry ? <FawryIcon size={36} /> : isFawaterak ? <FawaterakIcon size={36} /> : <KashierIcon size={36} />}
          <div>
            <div className="flex items-center gap-2">
              {isPaymob ? <PaymobLogo height={20} /> : isFawry ? <FawryLogo height={18} /> : isFawaterak ? <FawaterakLogo height={18} /> : <KashierLogo height={18} />}
              {creds?.is_configured && enabledGateway === gatewayKey && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{isAr ? "متصل" : "LIVE"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isPaymob ? (isAr ? "بوابة الدفع الرائدة في مصر" : "Egypt's leading payment gateway") : isFawry ? (isAr ? "الدفع عبر نقاط فوري" : "Pay at Fawry retail points") : isFawaterak ? (isAr ? "بوابة دفع متعددة الطرق" : "Multi-method payment aggregator") : (isAr ? "حلول الدفع البسيطة" : "Simple payment solutions")}
            </p>
          </div>
        </div>
        {creds?.is_configured && (
          <Switch checked={enabledGateway === gatewayKey} disabled={enablingSaving} onCheckedChange={handleToggle} />
        )}
      </div>

      {/* Connection Card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPaymob ? <PaymobIcon size={28} /> : isFawry ? <FawryIcon size={28} /> : isFawaterak ? <FawaterakIcon size={28} /> : <KashierIcon size={28} />}
              <div>
                <p className="text-sm font-semibold">{isAr ? "إعدادات الاتصال" : "Connection Settings"}</p>
              </div>
            </div>
            {creds?.is_configured && !editing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{isAr ? "متصل" : "LIVE"}
              </span>
            )}
          </div>
        </div>
        <div className="p-5">
          {creds?.is_configured && !editing ? (
            <div className="space-y-4">
              {/* Connected info */}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/10 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{isAr ? "متصل وجاهز لاستقبال المدفوعات" : "Connected & ready to accept payments"}</span>
              </div>
              {/* Credential fields */}
              <div className="grid gap-3 sm:grid-cols-2">
                {(isPaymob ? [
                  { l: "Secret Key", v: paymobCreds!.secret_key_masked },
                  { l: "Public Key", v: paymobCreds!.public_key_masked },
                  { l: "HMAC Secret", v: paymobCreds!.hmac_secret_masked },
                  { l: "Card Integration ID", v: paymobCreds!.card_integration_id },
                  ...(paymobCreds!.wallet_integration_id ? [{ l: "Wallet ID", v: paymobCreds!.wallet_integration_id }] : []),
                  ...(paymobCreds!.apple_pay_integration_id ? [{ l: "Apple Pay ID", v: paymobCreds!.apple_pay_integration_id }] : []),
                ] : isFawry ? [
                  { l: "Merchant Code", v: fawryCreds!.merchant_code },
                  { l: "Security Key", v: fawryCreds!.security_key_masked },
                ] : isFawaterak ? [
                  { l: "API Key", v: fawaterakCreds!.api_key_masked },
                  { l: "Vendor Key", v: fawaterakCreds!.vendor_key_masked },
                  { l: "Environment", v: fawaterakCreds!.environment },
                ] : [
                  { l: "Merchant ID", v: kashierCreds!.merchant_id },
                  { l: "API Key", v: kashierCreds!.api_key_masked },
                  ...(kashierCreds!.apple_pay_enabled ? [{ l: "Apple Pay", v: isAr ? "مُفعّل" : "Enabled" }] : []),
                ]).map(f => (
                  <div key={f.l} className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{f.l}</p>
                    <p className="font-mono text-xs">{f.v || "••••"}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setEditing(true)}>{isAr ? "تعديل" : "Edit"}</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={handleDelete}><Trash2 className="h-3 w-3 mr-1" />{isAr ? "قطع الاتصال" : "Disconnect"}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                {isPaymob ? (isAr ? "تجد هذه البيانات في Paymob Dashboard → Developers → Settings" : "Find these in Paymob Dashboard → Developers → Settings") : isFawry ? (isAr ? "تجد هذه البيانات في Fawry Business Console → API Settings" : "Find these in Fawry Business Console → API Settings") : isFawaterak ? (isAr ? "تجد هذه البيانات في لوحة تحكم فواتيرك → التكامل" : "Find these in Fawaterak Dashboard → Integration") : (isAr ? "تجد هذه البيانات في Kashier Dashboard → Settings" : "Find in Kashier Dashboard → Settings")}
              </p>
              {isPaymob ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { k: "secret_key" as const, l: "Secret Key", p: "egy_sk_live_...", s: true },
                    { k: "public_key" as const, l: "Public Key", p: "egy_pk_live_...", s: true },
                    { k: "hmac_secret" as const, l: "HMAC Secret", p: "HMAC secret", s: true },
                    { k: "card_integration_id" as const, l: "Card Integration ID", p: "123456", s: false },
                    { k: "wallet_integration_id" as const, l: `Wallet ID (${isAr ? "اختياري" : "optional"})`, p: "789012", s: false },
                    { k: "apple_pay_integration_id" as const, l: `Apple Pay ID (${isAr ? "اختياري" : "optional"})`, p: "789013", s: false },
                  ].map(f => (
                    <div key={f.k} className="space-y-1.5">
                      <Label className="text-[11px] font-medium">{f.l}</Label>
                      <div className="relative">
                        <Input type={f.s && !showKeys ? "password" : "text"} placeholder={f.p} className="h-9 text-xs pr-8" value={paymobForm[f.k]} onChange={e => setPaymobForm(p => ({ ...p, [f.k]: e.target.value }))} />
                        {f.s && <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowKeys(!showKeys)}>{showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : isFawry ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-[11px] font-medium">Merchant Code</Label><Input placeholder="FWR-xxx" className="h-9 text-xs" value={fawryForm.merchant_code} onChange={e => setFawryForm(f => ({ ...f, merchant_code: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-medium">Security Key</Label><div className="relative"><Input type={showKeys ? "text" : "password"} placeholder="Security key" className="h-9 text-xs pr-8" value={fawryForm.security_key} onChange={e => setFawryForm(f => ({ ...f, security_key: e.target.value }))} /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowKeys(!showKeys)}>{showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
                </div>
              ) : isFawaterak ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-[11px] font-medium">API Key</Label><div className="relative"><Input type={showKeys ? "text" : "password"} placeholder="Bearer token" className="h-9 text-xs pr-8" value={fawaterakForm.api_key} onChange={e => setFawaterakForm(f => ({ ...f, api_key: e.target.value }))} /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowKeys(!showKeys)}>{showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-medium">Vendor Key</Label><div className="relative"><Input type={showKeys ? "text" : "password"} placeholder="HMAC vendor key" className="h-9 text-xs pr-8" value={fawaterakForm.vendor_key} onChange={e => setFawaterakForm(f => ({ ...f, vendor_key: e.target.value }))} /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowKeys(!showKeys)}>{showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-medium">Environment</Label><select title="Environment" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors" value={fawaterakForm.environment} onChange={e => setFawaterakForm(f => ({ ...f, environment: e.target.value }))}><option value="staging">Staging</option><option value="production">Production</option></select></div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-[11px] font-medium">Merchant ID</Label><Input placeholder="MID-xxx" className="h-9 text-xs" value={kashierForm.merchant_id} onChange={e => setKashierForm(f => ({ ...f, merchant_id: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-medium">API Key</Label><div className="relative"><Input type={showKeys ? "text" : "password"} placeholder="API key" className="h-9 text-xs pr-8" value={kashierForm.api_key} onChange={e => setKashierForm(f => ({ ...f, api_key: e.target.value }))} /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowKeys(!showKeys)}>{showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-medium">Secret Key <span className="text-muted-foreground font-normal">({isAr ? "اختياري" : "optional"})</span></Label><Input type={showKeys ? "text" : "password"} placeholder="Secret" className="h-9 text-xs" value={kashierForm.secret_key} onChange={e => setKashierForm(f => ({ ...f, secret_key: e.target.value }))} /></div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2.5">
                    <div>
                      <p className="text-[11px] font-medium"> Apple Pay</p>
                      <p className="text-[10px] text-muted-foreground">{isAr ? "اعرض Apple Pay في صفحة الدفع (يتطلب تفعيله في حساب كاشير)" : "Show Apple Pay at checkout (requires Apple Pay enabled on your Kashier account)"}</p>
                    </div>
                    <Switch checked={kashierForm.apple_pay_enabled} onCheckedChange={c => setKashierForm(f => ({ ...f, apple_pay_enabled: c }))} />
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="h-8 text-xs gap-1.5" style={{ background: color }} disabled={saving || (isPaymob ? (!paymobForm.secret_key || !paymobForm.public_key || !paymobForm.hmac_secret || !paymobForm.card_integration_id) : isFawry ? (!fawryForm.merchant_code || !fawryForm.security_key) : isFawaterak ? (!fawaterakForm.api_key || !fawaterakForm.vendor_key) : (!kashierForm.merchant_id || !kashierForm.api_key))} onClick={handleSave}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {creds?.is_configured ? (isAr ? "تحديث" : "Update") : (isAr ? "تفعيل" : "Activate")}
                </Button>
                {creds?.is_configured && editing && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Supported Methods */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">{isAr ? "طرق الدفع المدعومة" : "Supported Methods"}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(isPaymob
            ? [{ icon: <CreditCard className="h-4 w-4" />, l: isAr ? "بطاقات" : "Cards", d: "Visa, Mastercard, Meeza" }, { icon: <Banknote className="h-4 w-4" />, l: isAr ? "محافظ" : "Wallets", d: "Vodafone Cash, Fawry" }, { icon: <CircleDollarSign className="h-4 w-4" />, l: isAr ? "تقسيط" : "Installments", d: "ValU, Souhoola" }]
            : isFawry
            ? [{ icon: <Banknote className="h-4 w-4" />, l: isAr ? "الدفع بالكود" : "Reference Code", d: isAr ? "كود مرجعي يُدفع في أي فرع فوري" : "Pay at any Fawry outlet" }, { icon: <CreditCard className="h-4 w-4" />, l: "Fawry Pay", d: isAr ? "الدفع أونلاين عبر فوري" : "Online Fawry payment" }]
            : isFawaterak
            ? [{ icon: <CreditCard className="h-4 w-4" />, l: isAr ? "بطاقات" : "Cards", d: "Visa, Mastercard" }, { icon: <Banknote className="h-4 w-4" />, l: isAr ? "محافظ ونقاط بيع" : "Wallets & Retail", d: isAr ? "فوري، أمان، مصاري" : "Fawry, Aman, Masary" }, { icon: <CircleDollarSign className="h-4 w-4" />, l: isAr ? "محافظ إلكترونية" : "Mobile Wallets", d: isAr ? "فودافون كاش، أورانج" : "Vodafone Cash, Orange" }]
            : [{ icon: <CreditCard className="h-4 w-4" />, l: isAr ? "بطاقات" : "Cards", d: "Visa, Mastercard" }]
          ).map((m, i) => (
            <div key={i} className="rounded-lg border bg-muted/10 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">{m.icon}</div>
              <div><p className="text-xs font-medium">{m.l}</p><p className="text-[10px] text-muted-foreground">{m.d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MOYASAR DETAIL VIEW (KSA) — secret key + publishable key + webhook secret
   ═══════════════════════════════════════════════════════════════════════ */

interface MoyasarDetailProps {
  storeId: string | undefined;
  isAr: boolean;
  language: string;
  creds: MoyasarCredentialsResponse | null;
  setCreds: (c: MoyasarCredentialsResponse) => void;
  enabledGateway: GatewayKey | null;
  setEnabledGateway: (g: GatewayKey | null) => void;
  onBack: () => void;
}

const MoyasarDetailView = ({ storeId, isAr, language, creds, setCreds, enabledGateway, setEnabledGateway, onBack }: MoyasarDetailProps) => {
  const { requireTrial } = useTrialPaywall();
  const color = "#191502";

  const [editing, setEditing] = useState(!creds?.is_configured);
  const [form, setForm] = useState({ secret_key: "", publishable_key: "", webhook_secret: "" });
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [enablingSaving, setEnablingSaving] = useState(false);

  const handleSave = async () => {
    if (!storeId) return;
    if (!requireTrial("connect_payment")) return;
    setSaving(true);
    try {
      const r = await saveMoyasarCredentials(storeId, {
        secret_key: form.secret_key,
        publishable_key: form.publishable_key || undefined,
        webhook_secret: form.webhook_secret || undefined,
      });
      setCreds(r);
      setForm({ secret_key: "", publishable_key: "", webhook_secret: "" });
      setEnabledGateway("moyasar");
      setEditing(false);
      toast.success(isAr ? "تم التفعيل بنجاح" : "Activated successfully");
    } catch (e) { showError(e, language); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!storeId) return;
    try {
      await deleteMoyasarCredentials(storeId);
      setCreds({ is_configured: false, secret_key_masked: null, publishable_key_masked: null, webhook_secret_masked: null, last_configured: null });
      if (enabledGateway === "moyasar") setEnabledGateway(null);
      setEditing(true);
      toast.success(isAr ? "تم قطع الاتصال" : "Disconnected");
    } catch (e) { showError(e, language); }
  };

  const handleToggle = async (checked: boolean) => {
    if (!storeId) return; setEnablingSaving(true);
    try {
      await apiClient(`/stores/${storeId}/settings/payment`, { method: "PATCH", body: JSON.stringify({ moyasar_enabled: checked }) });
      setEnabledGateway(checked ? "moyasar" : null);
      toast.success(checked ? (isAr ? "تم التفعيل" : "Enabled") : (isAr ? "تم الإيقاف" : "Disabled"));
    } catch (e) { showError(e, language); } finally { setEnablingSaving(false); }
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <MoyasarIcon size={36} />
          <div>
            <div className="flex items-center gap-2">
              <MoyasarLogo height={20} />
              {creds?.is_configured && enabledGateway === "moyasar" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{isAr ? "متصل" : "LIVE"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{isAr ? "بوابة الدفع الرائدة في السعودية" : "Saudi Arabia's leading payment gateway"}</p>
          </div>
        </div>
        {creds?.is_configured && (
          <Switch checked={enabledGateway === "moyasar"} disabled={enablingSaving} onCheckedChange={handleToggle} />
        )}
      </div>

      {/* Connection Card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MoyasarIcon size={28} />
              <p className="text-sm font-semibold">{isAr ? "إعدادات الاتصال" : "Connection Settings"}</p>
            </div>
            {creds?.is_configured && !editing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{isAr ? "متصل" : "LIVE"}
              </span>
            )}
          </div>
        </div>
        <div className="p-5">
          {creds?.is_configured && !editing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/10 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{isAr ? "متصل وجاهز لاستقبال المدفوعات" : "Connected & ready to accept payments"}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { l: "Secret Key", v: creds.secret_key_masked },
                  { l: "Publishable Key", v: creds.publishable_key_masked },
                  { l: isAr ? "مفتاح التحقق من Webhook" : "Webhook Secret", v: creds.webhook_secret_masked },
                ].map(f => (
                  <div key={f.l} className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{f.l}</p>
                    <p className="font-mono text-xs">{f.v || "••••"}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setEditing(true)}>{isAr ? "تعديل" : "Edit"}</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={handleDelete}><Trash2 className="h-3 w-3 mr-1" />{isAr ? "قطع الاتصال" : "Disconnect"}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                {isAr ? "تجد المفاتيح في Moyasar Dashboard → Settings → API Keys، ورمز التحقق في Settings → Webhooks." : "Find the keys in Moyasar Dashboard → Settings → API Keys, and the verification token in Settings → Webhooks."}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium">Secret Key</Label>
                  <div className="relative">
                    <Input type={showKeys ? "text" : "password"} placeholder="sk_live_..." className="h-9 text-xs pr-8" value={form.secret_key} onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))} />
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowKeys(!showKeys)}>{showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium">Publishable Key <span className="text-muted-foreground font-normal">({isAr ? "اختياري" : "optional"})</span></Label>
                  <Input placeholder="pk_live_..." className="h-9 text-xs" value={form.publishable_key} onChange={e => setForm(f => ({ ...f, publishable_key: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[11px] font-medium">{isAr ? "مفتاح التحقق من Webhook" : "Webhook Secret"} <span className="text-muted-foreground font-normal">({isAr ? "للتحقق من إشعارات الدفع" : "verifies payment notifications"})</span></Label>
                  <div className="relative">
                    <Input type={showKeys ? "text" : "password"} placeholder={isAr ? "رمز التحقق من Webhook" : "Webhook verification token"} className="h-9 text-xs pr-8" value={form.webhook_secret} onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))} />
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowKeys(!showKeys)}>{showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{isAr ? "أضف رابط Webhook في Moyasar: " : "Add this webhook URL in Moyasar: "}<span className="font-mono">https://numueg.app/api/v1/webhooks/moyasar/callback</span></p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="h-8 text-xs gap-1.5" style={{ background: color }} disabled={saving || !form.secret_key} onClick={handleSave}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {creds?.is_configured ? (isAr ? "تحديث" : "Update") : (isAr ? "تفعيل" : "Activate")}
                </Button>
                {creds?.is_configured && editing && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Supported Methods */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">{isAr ? "طرق الدفع المدعومة" : "Supported Methods"}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: <CreditCard className="h-4 w-4" />, l: isAr ? "بطاقات" : "Cards", d: "mada, Visa, Mastercard" },
            { icon: <CircleDollarSign className="h-4 w-4" />, l: "Apple Pay", d: isAr ? "الدفع عبر Apple Pay" : "Pay with Apple Pay" },
            { icon: <Banknote className="h-4 w-4" />, l: "STC Pay", d: isAr ? "محفظة STC Pay" : "STC Pay wallet" },
          ].map((m, i) => (
            <div key={i} className="rounded-lg border bg-muted/10 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">{m.icon}</div>
              <div><p className="text-xs font-medium">{m.l}</p><p className="text-[10px] text-muted-foreground">{m.d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaymentSetup;
