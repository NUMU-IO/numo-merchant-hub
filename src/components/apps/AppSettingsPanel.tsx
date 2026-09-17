/**
 * Per-app settings form, rendered from the app's own manifest.
 *
 * Reuses the V3 theme editor's `SchemaFormV3`, which is already app-agnostic:
 * it takes `SettingDefinition[]`, a values map and an `onChange`, and gives a
 * real colour picker, an R2-backed image uploader, selects, toggles, ranges,
 * `visible_if` conditional display and grouped forms for free. Importing it by
 * path because the feature barrel does not export it.
 *
 * Deliberately NOT in the theme customizer. These are store-wide settings with
 * no per-section meaning, and wiring app blocks into the customizer needs three
 * coordinated changes across two repos plus a storefront renderer that does not
 * exist — all to configure a toggle that belongs on this page.
 *
 * Saving sends the WHOLE form, so it asks the API to replace rather than merge.
 * The API defaults to merging precisely so that a partial save from somewhere
 * else (an onboarding step, a second tab) cannot silently drop keys this form
 * never showed.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SchemaFormV3 } from "@/features/theme-editor-v3/components/inputs/SchemaFormV3";
import type { SettingDefinition } from "@/features/theme-editor-v3/types";
import { updateAppSettings, type AppInstallation } from "@/services/appsApi";
import { showError } from "@/lib/show-error";
import { useLanguage } from "@/contexts/LanguageContext";

export function AppSettingsPanel({
  storeId,
  app,
  onSaved,
}: {
  storeId: string;
  app: AppInstallation;
  onSaved?: (next: AppInstallation) => void;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const schemaAll = (app.settings_schema ?? []) as SettingDefinition[];
  // Seed unset keys from the schema DEFAULTS. Without this a merchant opens the
  // form and sees blank fields for settings that are in fact active — the
  // component falls back to the same defaults at render time, so the form was
  // telling a different story than the storefront.
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const seeded: Record<string, unknown> = {};
    for (const def of schemaAll) {
      if (def?.id !== undefined && def.default !== undefined) seeded[def.id] = def.default;
    }
    return { ...seeded, ...(app.settings ?? {}) };
  });
  const [saving, setSaving] = useState(false);

  const schema = schemaAll;
  if (schema.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("apps.themeUnsupported")}
      </p>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const next = await updateAppSettings(storeId, app.slug, values);
      toast.success(t("apps.saved"));
      onSaved?.(next);
    } catch (err) {
      showError(err, language);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* A suspended app still shows its settings — they are the merchant's
          work and are not lost — but it says plainly that shoppers cannot see
          it, rather than letting the hub disagree with the storefront. */}
      {app.app_status === "suspended" && (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
          {t("apps.suspendedHelp")}
        </p>
      )}

      <SchemaFormV3
        settings={schema}
        values={values}
        locale={language === "ar" ? "ar" : "en"}
        storeId={storeId}
        onChange={(key, value) =>
          setValues((prev) => ({ ...prev, [key]: value }))
        }
      />

      <Button size="sm" onClick={save} disabled={saving}>
        {saving && <Loader2 className="me-2 h-3 w-3 animate-spin" />}
        {t("apps.saveSettings")}
      </Button>
    </div>
  );
}

export default AppSettingsPanel;
