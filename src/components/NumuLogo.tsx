/**
 * NUMU Logo components using the official brand symbol.
 * Symbol: /numu-symbol-navy-transparent.webp
 * Full logo: /numu_v3.png
 */

interface NumuLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { img: 32, text: "text-sm" },
  md: { img: 48, text: "text-lg" },
  lg: { img: 64, text: "text-2xl" },
  xl: { img: 96, text: "text-4xl" },
};

export function NumuLogo({ size = "md", showText = true, className = "" }: NumuLogoProps) {
  const { img, text } = sizes[size];

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      <img src="/numu-symbol-navy-transparent.webp" alt="NUMU" width={img} height={img} className="object-contain" />
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
    <img
      src="/numu-symbol-navy-transparent.webp"
      alt="NUMU"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
