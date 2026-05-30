import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** ichip tone for the icon chip — saffron is the brand default. */
  tone?: "saffron" | "navy" | "sage" | "terra";
}

/* Souq empty state — large brand ichip (saffron by default, swap via
   `tone` prop) + display-weight title + ink-soft subtitle. Replaces the
   old muted-grey chip pattern; matches NHUB encouraging-not-dead-end
   voice. Used across all "no data yet" surfaces. */
export function EmptyState({ icon: Icon, title, description, action, className, tone = "saffron" }: EmptyStateProps) {
  const chip = {
    saffron: "ichip ichip-saffron",
    navy: "ichip ichip-navy",
    sage: "ichip ichip-sage",
    terra: "ichip ichip-terra",
  }[tone];
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className={cn(chip, "ichip-lg mb-5")}>
        <Icon />
      </div>
      <h3 className="text-base font-extrabold tracking-tight mb-1.5">{title}</h3>
      {description && (
        <p className="text-[13px] text-ink-soft max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
