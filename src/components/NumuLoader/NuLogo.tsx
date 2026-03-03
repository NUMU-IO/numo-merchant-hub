/**
 * NUMU Animated Logo — SVG geometric cluster with gradient comet effect.
 * Uses the Mrkoon-inspired geometric shape cluster.
 */

const CLUSTER_PATH = `
  M 60 20 A 14 14 0 1 1 60 48 A 14 14 0 1 1 60 20
  M 100 8 L 122 8 A 5 5 0 0 1 127 13 L 127 30 A 5 5 0 0 1 122 35 L 100 35 A 5 5 0 0 1 95 30 L 95 13 A 5 5 0 0 1 100 8
  M 18 55 L 46 55 A 14 14 0 0 1 46 83 L 18 83 A 14 14 0 0 1 18 55
  M 110 60 A 16 16 0 1 1 110 92 A 16 16 0 1 1 110 60
`;

export function NuLogo() {
  return (
    <div className="relative flex flex-col items-center justify-center gap-4">
      <style>{`
        @keyframes numu-draw-flow {
          0%   { stroke-dashoffset: 800; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes numu-fade-in {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .nu-path-flow {
          stroke-dasharray: 200 600;
          animation: numu-draw-flow 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .nu-text-fade {
          animation: numu-fade-in 0.8s ease-out 0.3s both;
        }
      `}</style>

      <svg
        width="160"
        height="100"
        viewBox="0 0 160 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="numu-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="50%" stopColor="hsl(222 60% 40%)" />
            <stop offset="100%" stopColor="hsl(222 80% 55%)" />
          </linearGradient>
        </defs>

        {/* Base track */}
        <path d={CLUSTER_PATH} stroke="hsl(var(--border))" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Active gradient stroke */}
        <path d={CLUSTER_PATH} stroke="url(#numu-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" className="nu-path-flow" />
      </svg>

      <span className="text-2xl font-black tracking-[0.15em] text-foreground nu-text-fade">
        NUMU
      </span>
    </div>
  );
}
