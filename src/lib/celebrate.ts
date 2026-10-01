/**
 * Small celebration moments (first order, setup complete). No dependencies:
 * a burst of absolutely-positioned dots animated with the Web Animations API,
 * and a two-note chime from WebAudio. Both stay silent and still for
 * visitors who ask for reduced motion.
 */

const COLORS = ["#E8A430", "#C14A1C", "#1F4A7A", "#3E8E6B", "#F2D7A6"];

function reducedMotion(): boolean {
  return typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function confettiBurst(pieces = 60): void {
  if (reducedMotion()) return;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "9999", overflow: "hidden" });
  document.body.appendChild(layer);

  const originX = window.innerWidth / 2;
  for (let i = 0; i < pieces; i++) {
    const dot = document.createElement("span");
    const size = 6 + Math.random() * 6;
    Object.assign(dot.style, {
      position: "absolute",
      left: `${originX}px`,
      top: "30%",
      width: `${size}px`,
      height: `${size * 0.6}px`,
      background: COLORS[i % COLORS.length],
      borderRadius: "2px",
    });
    layer.appendChild(dot);
    const angle = Math.random() * Math.PI * 2;
    const distance = 120 + Math.random() * 260;
    dot.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance + 280}px) rotate(${Math.random() * 720}deg)`,
          opacity: 0,
        },
      ],
      { duration: 1100 + Math.random() * 600, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
  }
  window.setTimeout(() => layer.remove(), 1900);
}

export function chime(): void {
  if (reducedMotion()) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.14;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Autoplay policies may block audio before a gesture; the visual is enough.
  }
}

export function celebrate(): void {
  confettiBurst();
  chime();
}
