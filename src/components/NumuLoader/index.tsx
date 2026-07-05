/**
 * NUMU Welcome Screen — full-screen tapping-hand animation.
 * Shown ONCE per account: the first login of a freshly registered user
 * (see FirstLoginGate). All routine loading uses RingLoader instead.
 * Credit: adapted from Uiverse.io by Pradeepsaranbishnoi.
 */

export function NumuLoadingScreen() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#0f172a] transition-colors duration-500">
      <style>{styles}</style>

      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20 dark:opacity-40">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/20 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-14 p-8 mt-[-5vh]">
        <div className="numu-hand">
          <div className="numu-finger" />
          <div className="numu-finger" />
          <div className="numu-finger" />
          <div className="numu-finger" />
          <div className="numu-palm" />
          <div className="numu-thumb" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Welcome to Numu
        </p>
      </div>
    </div>
  );
}

const styles = `
  .numu-hand {
    --skin-color: #E4C560;
    --tap-speed: 0.6s;
    --tap-stagger: 0.1s;
    position: relative;
    width: 80px;
    height: 60px;
    margin-left: 80px;
  }

  .numu-hand:before {
    content: '';
    display: block;
    width: 180%;
    height: 75%;
    position: absolute;
    top: 70%;
    right: 20%;
    background-color: black;
    border-radius: 40px 10px;
    filter: blur(10px);
    opacity: 0.3;
  }

  .numu-palm {
    display: block;
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    background-color: var(--skin-color);
    border-radius: 10px 40px;
  }

  .numu-thumb {
    position: absolute;
    width: 120%;
    height: 38px;
    background-color: var(--skin-color);
    bottom: -18%;
    right: 1%;
    transform-origin: calc(100% - 20px) 20px;
    transform: rotate(-20deg);
    border-radius: 30px 20px 20px 10px;
    border-bottom: 2px solid rgba(0, 0, 0, 0.1);
    border-left: 2px solid rgba(0, 0, 0, 0.1);
  }

  .numu-thumb:after {
    width: 20%;
    height: 60%;
    content: '';
    background-color: rgba(255, 255, 255, 0.3);
    position: absolute;
    bottom: -8%;
    left: 5px;
    border-radius: 60% 10% 10% 30%;
    border-right: 2px solid rgba(0, 0, 0, 0.05);
  }

  .numu-finger {
    position: absolute;
    width: 80%;
    height: 35px;
    background-color: var(--skin-color);
    bottom: 32%;
    right: 64%;
    transform-origin: 100% 20px;
    animation-duration: calc(var(--tap-speed) * 2);
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
    transform: rotate(10deg);
  }

  .numu-finger:before {
    content: '';
    position: absolute;
    width: 140%;
    height: 30px;
    background-color: var(--skin-color);
    bottom: 8%;
    right: 65%;
    transform-origin: calc(100% - 20px) 20px;
    transform: rotate(-60deg);
    border-radius: 20px;
  }

  .numu-finger:nth-child(1) {
    animation-delay: 0s;
    filter: brightness(70%);
    animation-name: numu-tap-upper-1;
  }

  .numu-finger:nth-child(2) {
    animation-delay: var(--tap-stagger);
    filter: brightness(80%);
    animation-name: numu-tap-upper-2;
  }

  .numu-finger:nth-child(3) {
    animation-delay: calc(var(--tap-stagger) * 2);
    filter: brightness(90%);
    animation-name: numu-tap-upper-3;
  }

  .numu-finger:nth-child(4) {
    animation-delay: calc(var(--tap-stagger) * 3);
    filter: brightness(100%);
    animation-name: numu-tap-upper-4;
  }

  @keyframes numu-tap-upper-1 {
    0%, 50%, 100% { transform: rotate(10deg) scale(0.4); }
    40% { transform: rotate(50deg) scale(0.4); }
  }
  @keyframes numu-tap-upper-2 {
    0%, 50%, 100% { transform: rotate(10deg) scale(0.6); }
    40% { transform: rotate(50deg) scale(0.6); }
  }
  @keyframes numu-tap-upper-3 {
    0%, 50%, 100% { transform: rotate(10deg) scale(0.8); }
    40% { transform: rotate(50deg) scale(0.8); }
  }
  @keyframes numu-tap-upper-4 {
    0%, 50%, 100% { transform: rotate(10deg) scale(1); }
    40% { transform: rotate(50deg) scale(1); }
  }
`;
