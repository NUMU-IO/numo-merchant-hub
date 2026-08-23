import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SetupStep {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  cta: string;
  to?: string;
  onClick?: () => void;
}

/**
 * Navy "Shipping setup" hero: three steps (zones → rates → courier) with a
 * progress bar. Hides itself once everything is done — the landing page
 * then leads with the live numbers instead of a checklist.
 */
export function ShippingSetupHero({ steps, isAr }: { steps: SetupStep[]; isAr: boolean }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <section className="souq-hero-navy p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="souq-eyebrow" style={{ color: "rgba(255,255,255,0.55)" }}>
            {isAr ? "إعداد الشحن" : "Shipping setup"}
          </div>
          <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-white">
            {isAr ? "خلّي متجرك يشحن لكل مصر" : "Get your store shipping everywhere"}
          </h2>
          <p className="mt-1 text-[13px] text-white/65">
            {isAr
              ? "مناطق وأسعار شحن ظاهرة للعميل عند الدفع، وشركة شحن تطبع البوالص."
              : "Zones and rates the customer sees at checkout, and a courier to print labels with."}
          </p>
        </div>
        <div className="text-end">
          <div className="text-[26px] font-extrabold tabular-nums leading-none text-white">
            {isAr ? `${done.toLocaleString("ar-EG")}/${steps.length.toLocaleString("ar-EG")}` : `${done}/${steps.length}`}
          </div>
          <div className="text-[11.5px] text-white/55">{isAr ? "خطوات مكتملة" : "steps done"}</div>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, hsl(var(--saffron)), hsl(var(--sage)))" }}
        />
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => {
          const inner = (
            <>
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold",
                  s.done ? "bg-sage text-white" : "bg-white/15 text-white",
                )}
              >
                {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-white">{s.title}</span>
                <span className="block truncate text-[11.5px] text-white/60">{s.detail}</span>
              </span>
              {!s.done && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-saffron">
                  {s.cta}
                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </span>
              )}
            </>
          );
          const cls = cn(
            "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-start transition-colors",
            !s.done && "hover:bg-white/10",
          );
          return (
            <li key={s.key}>
              {s.to ? (
                <Link to={s.to} className={cls}>{inner}</Link>
              ) : (
                <button type="button" onClick={s.onClick} className={cn(cls, "w-full")} disabled={s.done}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default ShippingSetupHero;
