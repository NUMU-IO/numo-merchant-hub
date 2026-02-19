/**
 * NUMU Animated Logo — SVG "numu" text with gradient comet effect.
 * Ported from numu-loader project.
 */

const PATH_DATA = `
  M 25 80 L 25 35 A 15 15 0 0 1 55 35 L 55 80
  M 75 35 L 75 80 A 15 15 0 0 0 105 80 L 105 35
  M 125 80 L 125 35 A 15 15 0 0 1 155 35 L 155 80 L 155 35 A 15 15 0 0 1 185 35 L 185 80
  M 205 35 L 205 80 A 15 15 0 0 0 235 80 L 235 35
`;

export function NuLogo() {
  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes numu-draw-flow {
          0%   { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }
        .nu-path-flow {
          stroke-dasharray: 250 750;
          animation: numu-draw-flow 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      <svg
        width="260"
        height="115"
        viewBox="0 0 260 115"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible w-full h-auto"
      >
        <defs>
          <linearGradient id="numu-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id="numu-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base track */}
        <path d={PATH_DATA} stroke="#E2E8F0" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />

        {/* Glow layer */}
        <path d={PATH_DATA} stroke="url(#numu-grad)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" className="nu-path-flow opacity-40 blur-md" />

        {/* Active gradient stroke */}
        <path d={PATH_DATA} stroke="url(#numu-grad)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" className="nu-path-flow" />
      </svg>
    </div>
  );
}
