/**
 * ToolTrace — the small "what it actually did" rows above an answer.
 *
 * The agent's SSE stream already emits a `tool_call` event per tool, and the
 * store now keeps the names. Showing them turns a blank wait into a visible
 * chain of work — "Read orders", "Searched knowledge" — and, more usefully,
 * lets a merchant see *what the answer was based on* before trusting it.
 *
 * Each tool borrows the accent of the capability it belongs to, so a row here
 * and its chip on the launcher are the same colour.
 */
import {
  BadgePercent,
  BarChart3,
  BookOpen,
  Package,
  Palette,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";

type Entry = { icon: typeof Package; tone: string };

/** Every tool in the registry, mapped to its capability's icon and hue. */
const TOOLS: Record<string, Entry> = {
  get_orders: { icon: ShoppingCart, tone: "--cap-blue" },
  get_products: { icon: Package, tone: "--cap-orange" },
  create_product: { icon: Package, tone: "--cap-orange" },
  update_product: { icon: Package, tone: "--cap-orange" },
  get_abandoned_checkouts: { icon: ShoppingBag, tone: "--cap-red" },
  send_cart_recovery: { icon: Send, tone: "--cap-red" },
  get_store_analytics: { icon: BarChart3, tone: "--cap-violet" },
  get_store_summary: { icon: Store, tone: "--cap-violet" },
  create_discount: { icon: BadgePercent, tone: "--cap-green" },
  get_theme_config: { icon: Palette, tone: "--cap-magenta" },
  update_theme_setting: { icon: Palette, tone: "--cap-magenta" },
  add_theme_section: { icon: Palette, tone: "--cap-magenta" },
  update_section_settings: { icon: Palette, tone: "--cap-magenta" },
  remove_section: { icon: Palette, tone: "--cap-magenta" },
  recommend_growth: { icon: TrendingUp, tone: "--cap-cyan" },
  search_knowledge: { icon: BookOpen, tone: "--cap-gold" },
  trigger_workflow: { icon: Workflow, tone: "--cap-cyan" },
};

export function ToolTrace({
  tools,
  running,
}: {
  tools?: string[];
  running?: boolean;
}) {
  const { t } = useTranslation();
  if (!tools?.length) return null;

  return (
    <ul className="flex flex-col gap-0.5 ps-1 text-xs">
      {tools.map((name, i) => {
        const entry = TOOLS[name] ?? { icon: Sparkles, tone: "--cap-violet" };
        const Icon = entry.icon;
        const last = i === tools.length - 1;
        return (
          <li key={`${name}-${i}`} className="flex items-center gap-1.5">
            <Icon
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: `hsl(var(${entry.tone}))` }}
            />
            <span
              className={
                running && last ? "text-foreground" : "text-muted-foreground"
              }
            >
              {/* Unknown tool names fall back to the raw name rather than a
                  missing-key string — a new tool should still read sanely
                  before its label ships. */}
              {t(`agent.tools.${name}`, { defaultValue: name })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default ToolTrace;
