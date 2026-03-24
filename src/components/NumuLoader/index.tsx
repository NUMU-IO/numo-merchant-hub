/**
 * NUMU Loading Screen — full-screen loader with animated logo.
 */

import { NuLogo } from "./NuLogo";

export function NumuLoadingScreen() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0f172a] transition-colors duration-500">
      <style>{`
        @keyframes numu-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes numu-fade-up {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Subtle radial glow behind the logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 dark:opacity-40">
        <div className="w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative flex flex-col items-center justify-center p-8 z-10 animate-[numu-fade-up_0.6s_ease-out_both] mt-[-5vh]">
        <div className="mb-14">
          <NuLogo />
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-800 shadow-inner">
            <div
              className="h-full w-full bg-gradient-to-r from-transparent via-[#0ea5e9] to-transparent"
              style={{ animation: "numu-shimmer 1.5s infinite ease-in-out" }}
            />
          </div>
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">
            Loading Numu
          </p>
        </div>
      </div>
    </div>
  );
}
