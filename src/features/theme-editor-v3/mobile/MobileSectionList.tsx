/**
 * The section list — the Mobile Lite Editor's home screen.
 *
 * This is the entry point on purpose. The schema audit found theme-level
 * settings are the thin part of the catalogue (8 of 16 themes have ≤2, and
 * empire has ZERO), while section schemas are rich in every single theme
 * (39–356 settings; every hero and header clears 5 mobile-editable settings).
 * An editor that opened on "Theme settings" would show half the catalogue a
 * blank screen.
 *
 * Reordering is explicit up/down buttons, never drag-and-drop: a drag canvas on
 * a touch screen fights the page scroll and has no accessible equivalent.
 */
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EditorLocale, PageTemplate, SectionSchemaDefinition } from "../types";

interface MobileSectionListProps {
  template: PageTemplate | null;
  schemas: readonly SectionSchemaDefinition[] | undefined;
  locale: EditorLocale;
  isRTL: boolean;
  onOpen: (sectionId: string) => void;
  onToggle: (sectionId: string) => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
}

function sectionName(
  type: string,
  schemas: readonly SectionSchemaDefinition[] | undefined,
  locale: EditorLocale,
): string {
  const schema = schemas?.find((s) => s.type === type);
  if (!schema) return type;
  if (locale === "ar") return schema.locales?.ar?.name || schema.name || type;
  return schema.name || type;
}

export function MobileSectionList({
  template,
  schemas,
  locale,
  isRTL,
  onOpen,
  onToggle,
  onMove,
}: MobileSectionListProps) {
  const isAr = locale === "ar";
  const order = template?.order ?? [];
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  if (order.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
        {isAr ? "مفيش أقسام في الصفحة دي" : "This page has no sections yet"}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {order.map((sectionId, index) => {
        const instance = template?.sections?.[sectionId];
        if (!instance) return null;
        const hidden = instance.disabled === true;
        const isFirst = index === 0;
        const isLast = index === order.length - 1;

        return (
          <li
            key={sectionId}
            className={cn(
              "flex items-center gap-1 rounded-2xl border bg-card ps-1 pe-2",
              hidden ? "border-dashed border-border opacity-60" : "border-border",
            )}
          >
            {/* Reorder. Up is always visually up — these must NOT flip in RTL,
                unlike the horizontal chevron below. */}
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => onMove(sectionId, "up")}
                disabled={isFirst}
                aria-label={isAr ? "تحريك لأعلى" : "Move up"}
                className="grid h-6 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-25"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(sectionId, "down")}
                disabled={isLast}
                aria-label={isAr ? "تحريك لأسفل" : "Move down"}
                className="grid h-6 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-25"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpen(sectionId)}
              className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2 rounded-lg text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">
                {sectionName(instance.type, schemas, locale)}
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => onToggle(sectionId)}
              aria-pressed={!hidden}
              aria-label={
                hidden ? (isAr ? "إظهار القسم" : "Show section") : isAr ? "إخفاء القسم" : "Hide section"
              }
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
            >
              {hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
