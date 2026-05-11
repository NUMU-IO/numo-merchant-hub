import React, { useEffect, useRef } from "react";

/**
 * Ballpit — dependency-free falling-balls canvas animation.
 * Mirrors the landing-page implementation so the auth surfaces share
 * the same playful brand-physics on the left brand panel.
 */

interface BallpitProps {
  count?: number;
  gravity?: number;
  friction?: number;
  wallBounce?: number;
  followCursor?: boolean;
  colors?: string[];
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
}

const DEFAULT_COLORS = [
  "#003366",
  "#1F4A7A",
  "#E8A430",
  "#C14A1C",
  "#6B8E68",
  "#F5EFE6",
];

const Ballpit: React.FC<BallpitProps> = ({
  count = 80,
  gravity = 0.25,
  friction = 0.985,
  wallBounce = 0.75,
  followCursor = true,
  colors = DEFAULT_COLORS,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const runningRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const seed = () => {
      const rect = canvas.getBoundingClientRect();
      const balls: Ball[] = [];
      for (let i = 0; i < count; i++) {
        const r = 8 + Math.random() * 18;
        balls.push({
          x: Math.random() * rect.width,
          y: -Math.random() * rect.height,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 2,
          r,
          color: colors[i % colors.length],
        });
      }
      ballsRef.current = balls;
    };
    seed();

    const step = () => {
      if (!runningRef.current) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const balls = ballsRef.current;
      const m = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];

        if (!prefersReducedMotion) {
          b.vy += gravity;

          if (followCursor && m.active) {
            const dx = b.x - m.x;
            const dy = b.y - m.y;
            const d2 = dx * dx + dy * dy;
            const R = 110;
            if (d2 < R * R && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const force = ((R - d) / R) * 0.9;
              b.vx += (dx / d) * force;
              b.vy += (dy / d) * force;
            }
          }

          b.vx *= friction;
          b.vy *= friction;
          b.x += b.vx;
          b.y += b.vy;

          if (b.x - b.r < 0) { b.x = b.r; b.vx = -b.vx * wallBounce; }
          else if (b.x + b.r > w) { b.x = w - b.r; b.vx = -b.vx * wallBounce; }
          if (b.y + b.r > h) { b.y = h - b.r; b.vy = -b.vy * wallBounce; b.vx *= 0.98; }
          // Top wall: only bounce when the ball is actually moving up
          // into it. Without the vy<0 guard, balls seeded above the
          // canvas (y<0) get snapped to the top edge on the first
          // frame and never make it down to the floor.
          else if (b.vy < 0 && b.y - b.r < 0) {
            b.y = b.r;
            b.vy = -b.vy * wallBounce;
          }
        }

        for (let j = i + 1; j < balls.length; j++) {
          const o = balls[j];
          const dx = o.x - b.x;
          const dy = o.y - b.y;
          const d2 = dx * dx + dy * dy;
          const minD = b.r + o.r;
          if (d2 < minD * minD && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const overlap = (minD - d) / 2;
            b.x -= nx * overlap; b.y -= ny * overlap;
            o.x += nx * overlap; o.y += ny * overlap;
            const p = 2 * (b.vx * nx + b.vy * ny - (o.vx * nx + o.vy * ny)) / 2;
            b.vx -= p * nx; b.vy -= p * ny;
            o.vx += p * nx; o.vy += p * ny;
            b.vx *= 0.98; b.vy *= 0.98;
            o.vx *= 0.98; o.vy *= 0.98;
          }
        }
      }

      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => { runningRef.current = entries[0]?.isIntersecting ?? true; },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };
    const onLeave = () => { mouseRef.current.active = false; };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      io.disconnect();
    };
  }, [count, gravity, friction, wallBounce, followCursor, colors]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full touch-none"
      aria-hidden="true"
    />
  );
};

export default Ballpit;
