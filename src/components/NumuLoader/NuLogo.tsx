/**
 * NUMU Logo — Uses the new brand asset.
 */

export function NuLogo() {
  return (
    <div className="relative flex flex-col items-center justify-center gap-6">
      <style>{`
        @keyframes numu-fade-in {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes numu-pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(14, 165, 233, 0.4)); }
          50%      { filter: drop-shadow(0 0 24px rgba(14, 165, 233, 0.8)); }
        }
        .nu-text-fade {
          animation: numu-fade-in 0.8s ease-out 0.3s both;
        }
        .nu-logo-img {
          animation: numu-fade-in 0.6s ease-out both;
        }
      `}</style>

      <div className="relative animate-[numu-pulse-glow_3s_ease-in-out_infinite]">
        <img
          src="/numu-logo-320.webp"
          alt="NUMU Logo"
          width={160}
          height={160}
          className="w-32 h-32 md:w-40 md:h-40 object-contain rounded-3xl shadow-xl nu-logo-img"
        />
      </div>

      <div className="flex flex-col items-center nu-text-fade mt-2">
        <span className="text-4xl font-extrabold tracking-widest text-white" dir="rtl">
          نمو
        </span>
        <span className="text-2xl font-black tracking-[0.3em] text-white mt-1">
          NUMU
        </span>
      </div>
    </div>
  );
}
