import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getStore, updateStore } from "@/services/storeApi";

/**
 * Multi-currency presentment settings — Phase 6.
 *
 * Capture currency is unchanged (whatever the merchant configured at
 * onboarding). This panel controls **display**: what currencies show
 * up in the storefront's currency switcher, which one is the default,
 * and whether converted prices appear at all.
 *
 * Settings written:
 *   store.settings.presentment_currencies         — list of ISO codes
 *   store.settings.default_presentment_currency   — initial selection
 *   store.settings.auto_convert                   — bool toggle
 *
 * Backend reads these in `/storefront/store/{id}/currencies` and
 * surfaces them to the SDK's useCurrency() hook. Rates come from the
 * global currency_rates table, refreshed daily.
 */

// Reasonable starter set — MENA + global. Merchants can ask us to
// add more via support; the backend doesn't restrict the list, this
// is just the picker UX.
const SUPPORTED = [
  "EGP",
  "USD",
  "EUR",
  "GBP",
  "SAR",
  "AED",
  "QAR",
  "KWD",
  "JOD",
  "TRY",
] as const;

interface StoreSettings {
  presentment_currencies?: string[];
  default_presentment_currency?: string;
  auto_convert?: boolean;
}

export default function PresentmentCurrencies() {
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const base = currentStore?.default_currency || "EGP";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [defaultCcy, setDefaultCcy] = useState<string>("");
  const [autoConvert, setAutoConvert] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      try {
        const store = await getStore(storeId);
        const settings = ((store as unknown as { settings?: StoreSettings })
          .settings || {}) as StoreSettings;
        // Always include the base currency — merchant can't disable it.
        const list = settings.presentment_currencies || [];
        const withBase = list.includes(base) ? list : [base, ...list];
        setSelected(withBase);
        setDefaultCcy(settings.default_presentment_currency || base);
        setAutoConvert(Boolean(settings.auto_convert));
      } catch (err) {
        toast({
          title: "Failed to load currency settings",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId, base, toast]);

  function toggle(code: string) {
    if (code === base) return; // base is mandatory
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  // Available picks for the default dropdown — only currencies the
  // merchant actually offers can be the default.
  const defaultOptions = useMemo(() => {
    const out = selected.includes(base) ? selected : [base, ...selected];
    return Array.from(new Set(out));
  }, [selected, base]);

  async function save() {
    if (!storeId) return;
    setSaving(true);
    try {
      const presentment = selected.includes(base)
        ? selected
        : [base, ...selected];
      await updateStore(storeId, {
        settings: {
          ...(currentStore as unknown as { settings?: StoreSettings })
            ?.settings,
          presentment_currencies: presentment,
          default_presentment_currency: defaultOptions.includes(defaultCcy)
            ? defaultCcy
            : base,
          auto_convert: autoConvert,
        },
      } as Parameters<typeof updateStore>[1]);
      toast({ title: "Presentment settings saved." });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!storeId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Presentment Currencies</CardTitle>
            <CardDescription>Select a store.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Presentment Currencies</h1>
        <p className="text-sm text-muted-foreground">
          Choose which currencies your storefront can display. Payment is
          always captured in your store's base currency ({base}); this is
          display-only conversion for visitors.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Offered currencies</CardTitle>
              <CardDescription>
                Your base currency is always included. Visitors will pick
                from this list in the storefront's currency switcher.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SUPPORTED.map((code) => {
                const isBase = code === base;
                const checked = selected.includes(code) || isBase;
                return (
                  <label
                    key={code}
                    className={`flex items-center gap-2 rounded border p-2 ${
                      isBase ? "opacity-75 bg-muted/30" : "cursor-pointer"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(code)}
                      disabled={isBase}
                      aria-label={code}
                    />
                    <span className="font-medium">{code}</span>
                    {isBase && (
                      <Badge variant="outline" className="text-[10px]">
                        base
                      </Badge>
                    )}
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default selection</CardTitle>
              <CardDescription>
                The currency shown to visitors before they pick anything.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <select
                className="border rounded px-3 py-2 bg-background"
                value={defaultCcy}
                onChange={(e) => setDefaultCcy(e.target.value)}
                aria-label="Default presentment currency"
              >
                {defaultOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                    {c === base ? " (base)" : ""}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auto-convert prices</CardTitle>
              <CardDescription>
                When on, the storefront shows converted prices automatically.
                Off keeps every visitor on your base currency unless they
                explicitly switch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Switch
                  checked={autoConvert}
                  onCheckedChange={setAutoConvert}
                  aria-label="Enable automatic conversion"
                />
                <span className="text-sm">
                  {autoConvert ? "Enabled" : "Disabled"}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
