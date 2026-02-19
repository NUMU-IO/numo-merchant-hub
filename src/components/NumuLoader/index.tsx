/**
 * NUMU Loading Screen — full-screen loader with animated logo.
 */

import { NuLogo } from "./NuLogo";

export function NumuLoadingScreen() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
      <style>{`
        @keyframes numu-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div className="relative flex flex-col items-center justify-center p-8">
        <div className="mb-12 w-72 md:w-96">
          <NuLogo />
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent"
              style={{ animation: "numu-shimmer 1.5s infinite" }}
            />
          </div>
          <p className="text-[10px] font-bold tracking-[0.25em] text-slate-400 uppercase">
            Loading
          </p>
        </div>
      </div>
    </div>
  );
}
