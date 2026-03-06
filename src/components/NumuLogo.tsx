/**
 * NUMU geometric logo — inspired by Mrkoon's cluster-of-shapes aesthetic
 * but using NUMU's navy blue palette. Four geometric shapes arranged in a
 * diamond/cluster formation with the NUMU wordmark below.
 */

interface NumuLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { svg: 32, text: "text-sm" },
  md: { svg: 48, text: "text-lg" },
  lg: { svg: 64, text: "text-2xl" },
  xl: { svg: 96, text: "text-4xl" },
};

export function NumuLogo({ size = "md", showText = true, className = "" }: NumuLogoProps) {
  const { svg, text } = sizes[size];

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      <svg
        width={svg}
        height={svg}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top row - two shapes */}
        <circle cx="28" cy="22" r="12" fill="hsl(var(--primary))" opacity="0.85" />
        <rect x="44" y="10" width="22" height="22" rx="5" fill="hsl(var(--primary))" opacity="0.7" />

        {/* Bottom row - two shapes */}
        <rect x="6" y="42" width="24" height="24" rx="12" fill="hsl(var(--primary))" opacity="0.95" />
        <circle cx="54" cy="54" r="14" fill="hsl(var(--primary))" opacity="0.8" />

        {/* Center accent dot */}
        <circle cx="40" cy="38" r="4" fill="hsl(var(--primary))" />
      </svg>

      {showText && (
        <div className="flex flex-col items-center -mt-0.5">
          <span className={`${text} font-black tracking-[0.12em] text-foreground leading-none`}>
            NUMU
          </span>
        </div>
      )}
    </div>
  );
}

/** Icon-only variant for small spaces */
export function NumuIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="28" cy="22" r="12" fill="hsl(var(--primary))" opacity="0.85" />
      <rect x="44" y="10" width="22" height="22" rx="5" fill="hsl(var(--primary))" opacity="0.7" />
      <rect x="6" y="42" width="24" height="24" rx="12" fill="hsl(var(--primary))" opacity="0.95" />
      <circle cx="54" cy="54" r="14" fill="hsl(var(--primary))" opacity="0.8" />
      <circle cx="40" cy="38" r="4" fill="hsl(var(--primary))" />
    </svg>
  );
}
