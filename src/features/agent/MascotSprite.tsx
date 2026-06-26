/**
 * MascotSprite — the animated NUMU clown assistant.
 *
 * Each state is a horizontal strip of equal 128px cells (sliced from the
 * source sprite sheet). We step `background-position-x` in JS rather than via a
 * CSS `steps()` keyframe so that one-shot states (happy / wink / wave) can play
 * exactly once and report completion, while looping states (idle / talking /
 * thinking / excited) cycle forever. Strips are bundled by Vite as URLs.
 */
import { useEffect, useRef, useState } from "react";

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
  const [frame, setFrame] = useState(0);
  const onDone = useRef(onComplete);
  onDone.current = onComplete;

  useEffect(() => {
    setFrame(0);
    if (sheet.frames <= 1) return;

    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= sheet.frames) {
        if (sheet.loop) {
          i = 0;
        } else {
          window.clearInterval(id);
          setFrame(sheet.frames - 1);
          onDone.current?.();
          return;
        }
      }
      setFrame(i);
    }, 1000 / sheet.fps);

    return () => window.clearInterval(id);
  }, [state, sheet.frames, sheet.fps, sheet.loop]);

  return (
    <div
      className={className}
      aria-hidden
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sheet.src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheet.frames * size}px ${size}px`,
        backgroundPositionX: `-${frame * size}px`,
        flexShrink: 0,
      }}
    />
  );
}

export default MascotSprite;
