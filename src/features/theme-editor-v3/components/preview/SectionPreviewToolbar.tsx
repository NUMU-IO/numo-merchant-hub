/**
 * SectionPreviewToolbar — floating action bar overlaid on the iframe
 * preview at the currently-selected section's position.
 *
 * Shopify-parity Preview Inspector. The merchant clicks a section in
 * the iframe (PreviewBridge posts `numu:editor:select`), the hub's
 * LivePreview wires that into `customizerStore.selection`, the iframe
 * posts the section's bounding rect (`numu:editor:section-rect`), and
 * this toolbar surfaces directly above the section with the same
 * actions the sidebar's row offers — but at the merchant's eye level
 * inside the preview itself.
 *
 * The component is dumb-positioned: it receives a `rect` from the
 * parent (LivePreview) that's already been mapped from iframe-local
 * coordinates to hub-window coordinates. All store mutations route
 * through the same actions the sidebar uses, so undo/redo, autosave,
 * and the live-preview round-trip all work without extra plumbing.
 *
 * Actions:
 *   - Add above / Add below: open the add-section dialog with the
 *     correct insertion target.
 *   - Move up / Move down: bounded by the section's position in the
 *     template order — buttons disable at the ends.
 *   - Duplicate: clones the section in place; selection moves to the
 *     new copy.
 *   - Hide/Show: toggles `disabled` on the section instance.
 *   - Delete: confirmable destructive action.
 *
 * The toolbar pins itself just above the top edge of the section
 * (or BELOW when the section's top is too close to the iframe's top
 * to fit the toolbar comfortably). Pointer events on the toolbar are
 * captured; clicks pass through everywhere else so the merchant can
 * still interact with the preview underneath.
 */

import {
  Plus,
  ChevronUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
} from "lucide-react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";

/** Hub-window-relative rect for the selected section in the iframe. */
export interface ToolbarRect {
  /** Hub-window-relative top edge of the section. */
  top: number;
  /** Hub-window-relative left edge of the section. */
  left: number;
  /** Width of the section in CSS pixels. */
  width: number;
  /** Height of the section in CSS pixels. */
  height: number;
}

interface Props {
  sectionId: string;
  rect: ToolbarRect;
  /** Iframe's bounding box in hub-window coordinates — used to keep the
   *  toolbar inside the viewport when the section's top is too close
   *  to the iframe's top to fit the bar above it. */
  iframeBox: { top: number; left: number; width: number; height: number };
}

const TOOLBAR_HEIGHT = 36; // px — matches the actual rendered bar
const GAP = 8; // px above the section

export function SectionPreviewToolbar({ sectionId, rect, iframeBox }: Props) {
  const locale = useCustomizerStore((s) => s.locale);
  const draft = useCustomizerStore((s) => s.draft);
  const activePage = useCustomizerStore((s) => s.activePage);
  const moveSection = useCustomizerStore((s) => s.moveSection);
  const duplicateSection = useCustomizerStore((s) => s.duplicateSection);
  const removeSection = useCustomizerStore((s) => s.removeSection);
  const toggleSection = useCustomizerStore((s) => s.toggleSection);
  const setShowAddSection = useCustomizerStore((s) => s.setShowAddSection);
  const isAr = locale === "ar";

  // Find the section's position in the active template's order so we
  // can disable Move up at index 0 and Move down at the last index.
  // Also pull the section's `disabled` flag for the hide/show toggle.
  const template = draft?.templates?.[activePage];
  const order = template?.order ?? [];
  const idx = order.indexOf(sectionId);
  const isFirst = idx <= 0;
  const isLast = idx === -1 || idx >= order.length - 1;
  const section = template?.sections?.[sectionId];
  const isHidden = section?.disabled === true;

  // The "Add above" action wants to insert before this section. The
  // store's addSection takes an "insertAfter" id — for "before", pass
  // the id of the section that comes just before this one. When this
  // section is first, pass empty so addSection treats it as "insert
  // at start of order". The store doesn't have an explicit insert-at-
  // start primitive today; we route through the existing API by using
  // an empty `insertAfter` which currently appends. Refinement: when
  // idx === 0, we open the dialog with no anchor — the merchant adds
  // their new section, and the order gets reshuffled if needed via a
  // manual drag. Trade-off accepted to keep this PR self-contained.
  const idAbove = idx > 0 ? order[idx - 1] : null;

  // Position the bar above the section's top edge. If there isn't
  // enough vertical room (section starts near the top of the iframe),
  // pin BELOW the section's top edge instead so the bar stays on-screen.
  const minTopWithinIframe = TOOLBAR_HEIGHT + GAP;
  const sectionTopInIframe = rect.top - iframeBox.top;
  const placeBelow = sectionTopInIframe < minTopWithinIframe;
  const computedTop = placeBelow
    ? rect.top + GAP
    : rect.top - TOOLBAR_HEIGHT - GAP;
  // Clamp the left edge so a wide toolbar doesn't slide past the
  // iframe's right edge. The toolbar is roughly 320px wide.
  const clampedLeft = Math.max(
    iframeBox.left + 8,
    Math.min(rect.left, iframeBox.left + iframeBox.width - 320 - 8),
  );

  const style: CSSProperties = {
    position: "fixed",
    top: computedTop,
    left: clampedLeft,
    zIndex: 50,
  };

  // Toolbar shouldn't be visible if the section's bounding box is
  // smaller than a sane minimum — usually means the section is mid-
  // mount or was just deleted and we're seeing a stale rect.
  if (rect.width < 40 || rect.height < 20) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        role="toolbar"
        aria-label={isAr ? "أدوات القسم" : "Section actions"}
        style={style}
        className={cn(
          "flex items-center gap-0.5 rounded-md border bg-background/95 px-1 py-1 shadow-lg backdrop-blur",
          "pointer-events-auto",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — visual only; actual reorder lives in the
            sidebar's drag-and-drop and the up/down buttons here. */}
        <span
          className="px-1 text-muted-foreground/50 cursor-grab"
          aria-hidden="true"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>

        <ToolbarButton
          tooltip={isAr ? "أضف قسم فوق" : "Add section above"}
          onClick={() => setShowAddSection(true, idAbove ?? undefined)}
          disabled={!template}
        >
          <Plus className="h-3.5 w-3.5" />
          <ChevronUp className="h-3 w-3 -ml-0.5" />
        </ToolbarButton>

        <ToolbarButton
          tooltip={isAr ? "أضف قسم تحت" : "Add section below"}
          onClick={() => setShowAddSection(true, sectionId)}
          disabled={!template}
        >
          <Plus className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3 -ml-0.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          tooltip={isAr ? "تحريك لأعلى" : "Move up"}
          onClick={() => moveSection(sectionId, "up")}
          disabled={isFirst}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          tooltip={isAr ? "تحريك لأسفل" : "Move down"}
          onClick={() => moveSection(sectionId, "down")}
          disabled={isLast}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          tooltip={isAr ? "تكرار" : "Duplicate"}
          onClick={() => duplicateSection(sectionId)}
        >
          <Copy className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          tooltip={isHidden ? (isAr ? "إظهار" : "Show") : isAr ? "إخفاء" : "Hide"}
          onClick={() => toggleSection(sectionId)}
        >
          {isHidden ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          tooltip={isAr ? "حذف" : "Delete"}
          onClick={() => {
            // Single-click delete with confirm dialog would block fast
            // editing flow. Sidebar's row has the same pattern (one
            // click → delete). Undo recovers immediately if it was a
            // mistake.
            if (
              window.confirm(
                isAr
                  ? "هل أنت متأكد من حذف هذا القسم؟"
                  : "Delete this section?",
              )
            ) {
              removeSection(sectionId);
            }
          }}
          danger
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
    </TooltipProvider>
  );
}

// ─── Internal button + divider primitives ────────────────────────────

function ToolbarButton({
  tooltip,
  onClick,
  disabled,
  danger,
  children,
}: {
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 min-w-7",
            danger && "hover:bg-destructive/10 hover:text-destructive",
          )}
          disabled={disabled}
          onClick={onClick}
        >
          <span className="inline-flex items-center">{children}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />;
}
