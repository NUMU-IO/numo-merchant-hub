/**
 * MascotSprite — the animated NUMU clown assistant.
 *
 * Each state is a horizontal strip of equal 128px cells (sliced from the
 * source sprite sheet), stepped with a CSS `steps()` keyframe (`mascot-sprite`
 * in index.css) so an idle mascot costs no JS timer or re-render. One-shot
 * states (happy / wink / wave) play once, hold the last frame and report
 * completion via `animationend`; looping states (idle / talking / thinking /
 * excited) cycle forever. Strips are bundled by Vite as URLs.
 */
import { useRef } from "react";

import excited from "./sprites/excited.png";
import happy from "./sprites/happy.png";
import idle from "./sprites/idle.png";
import loading from "./sprites/loading.png";
import talking from "./sprites/talking.png";
import thinking from "./sprites/thinking.png";
import wave from "./sprites/wave.png";
import wink from "./sprites/wink.png";

export type MascotState =
  | "idle"
  | "talking"
  | "thinking"
  | "happy"
  | "excited"
  | "wink"
  | "loading"
  | "wave";

interface Sheet {
  src: string;
  frames: number;
  fps: number;
  loop: boolean;
}

const SHEETS: Record<MascotState, Sheet> = {
  idle: { src: idle, frames: 5, fps: 5, loop: true },
  talking: { src: talking, frames: 5, fps: 9, loop: true },
  thinking: { src: thinking, frames: 5, fps: 6, loop: true },
  happy: { src: happy, frames: 5, fps: 10, loop: false },
  excited: { src: excited, frames: 5, fps: 11, loop: true },
  wink: { src: wink, frames: 2, fps: 4, loop: false },
  loading: { src: loading, frames: 1, fps: 1, loop: true },
  wave: { src: wave, frames: 2, fps: 5, loop: false },
};

interface MascotSpriteProps {
  state: MascotState;
  /** Rendered square size in px. */
  size?: number;
  /** Fired when a non-looping state finishes its last frame. */
  onComplete?: () => void;
  className?: string;
}

export function MascotSprite({
  state,
  size = 44,
  onComplete,
  className,
}: MascotSpriteProps) {
  const sheet = SHEETS[state];
  const onDone = useRef(onComplete);
  onDone.current = onComplete;
  const animated = sheet.frames > 1;

  return (
    <div
      // Remount per state so the animation restarts from frame 0.
      key={state}
      className={className}
      aria-hidden
      onAnimationEnd={animated && !sheet.loop ? () => onDone.current?.() : undefined}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sheet.src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheet.frames * size}px ${size}px`,
        animation: animated
          ? `mascot-sprite ${sheet.frames / sheet.fps}s steps(${sheet.frames}, jump-none) ${sheet.loop ? "infinite" : "1 forwards"}`
          : undefined,
        flexShrink: 0,
      }}
    />
  );
}

export default MascotSprite;
