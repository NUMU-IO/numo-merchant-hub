/**
 * Animated character ensemble for the auth/login hero panel.
 *
 * Four cartoon shapes — navy, ink, terracotta, saffron — stand on the
 * panel's baseline. Their bodies lean and their eyes track the mouse.
 * When the email field gains focus they briefly glance at one another;
 * when a password is typed but hidden the back two stretch taller and
 * tilt away; when the password is revealed all four look away and the
 * navy one peeks back periodically.
 *
 * The colour palette maps the original demo to NUMU brand tokens:
 *   purple  → navy       (#003366)
 *   black   → ink        (#0F1624)
 *   orange  → terracotta (#C14A1C)
 *   yellow  → saffron    (#E8A430)
 *
 * Eye-tracking math comes from a global `mousemove` listener — works
 * even when the parent container has `pointer-events: none`, so it can
 * sit behind the tagline copy without blocking text selection.
 */

import { useEffect, useRef, useState } from "react";

interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({
  size = 12,
  maxDistance = 5,
  pupilColor = "#0F1624",
  forceLookX,
  forceLookY,
}: PupilProps) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const calc = () => {
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.min(Math.hypot(dx, dy), maxDistance);
    const ang = Math.atan2(dy, dx);
    return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist };
  };

  const pos = calc();
  return (
    <div
      ref={ref}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 0.1s ease-out",
      }}
    />
  );
};

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "#0F1624",
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const calc = () => {
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.min(Math.hypot(dx, dy), maxDistance);
    const ang = Math.atan2(dy, dx);
    return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist };
  };

  const pos = calc();
  return (
    <div
      ref={ref}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? "2px" : `${size}px`,
        backgroundColor: eyeColor,
        overflow: "hidden",
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      )}
    </div>
  );
};

interface AnimatedCharactersProps {
  /** True while the email input has focus — triggers a brief glance between the two back characters. */
  isFocusing?: boolean;
  /** True when the password field has any content. */
  hasPassword?: boolean;
  /** True when the password is currently visible (eye toggle on). All characters avert their gaze. */
  passwordVisible?: boolean;
}

export default function AnimatedCharacters({
  isFocusing = false,
  hasPassword = false,
  passwordVisible = false,
}: AnimatedCharactersProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isNavyBlinking, setIsNavyBlinking] = useState(false);
  const [isInkBlinking, setIsInkBlinking] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isNavyPeeking, setIsNavyPeeking] = useState(false);

  const navyRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const terracottaRef = useRef<HTMLDivElement>(null);
  const saffronRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Navy character blink loop — 3–7s gaps, 150ms blink.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setIsNavyBlinking(true);
        t = setTimeout(() => {
          setIsNavyBlinking(false);
          schedule();
        }, 150);
      }, Math.random() * 4000 + 3000);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  // Ink character blink loop — independent timing for liveliness.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setIsInkBlinking(true);
        t = setTimeout(() => {
          setIsInkBlinking(false);
          schedule();
        }, 150);
      }, Math.random() * 4000 + 3000);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  // Glance at each other for ~800ms when email focus engages.
  useEffect(() => {
    if (isFocusing) {
      setIsLookingAtEachOther(true);
      const t = setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => clearTimeout(t);
    }
    setIsLookingAtEachOther(false);
  }, [isFocusing]);

  // While the password is visible, the navy character peeks back periodically.
  useEffect(() => {
    if (hasPassword && passwordVisible) {
      let t: ReturnType<typeof setTimeout>;
      const schedule = () => {
        t = setTimeout(() => {
          setIsNavyPeeking(true);
          t = setTimeout(() => {
            setIsNavyPeeking(false);
            schedule();
          }, 800);
        }, Math.random() * 3000 + 2000);
      };
      schedule();
      return () => clearTimeout(t);
    }
    setIsNavyPeeking(false);
  }, [hasPassword, passwordVisible]);

  const calcBody = (r: React.RefObject<HTMLDivElement | null>) => {
    if (!r.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = r.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 3;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const navy = calcBody(navyRef);
  const ink = calcBody(inkRef);
  const terracotta = calcBody(terracottaRef);
  const saffron = calcBody(saffronRef);

  // Brand tokens.
  const NAVY = "#003366";
  const INK = "#0F1624";
  const TERRACOTTA = "#C14A1C";
  const SAFFRON = "#E8A430";
  const PUPIL = "#0F1624";

  const pwShown = hasPassword && passwordVisible;
  const pwHidden = hasPassword && !passwordVisible;

  return (
    <div className="relative" style={{ width: "550px", height: "400px" }}>
      {/* Navy — back, tallest. Stretches taller and tilts away while a hidden password is typed. */}
      <div
        ref={navyRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: "70px",
          width: "180px",
          height: isFocusing || pwHidden ? "440px" : "400px",
          backgroundColor: NAVY,
          borderRadius: "10px 10px 0 0",
          zIndex: 1,
          transform: pwShown
            ? "skewX(0deg)"
            : isFocusing || pwHidden
              ? `skewX(${navy.bodySkew - 12}deg) translateX(40px)`
              : `skewX(${navy.bodySkew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-8 transition-all duration-700 ease-in-out"
          style={{
            left: pwShown ? "20px" : isLookingAtEachOther ? "55px" : `${45 + navy.faceX}px`,
            top: pwShown ? "35px" : isLookingAtEachOther ? "65px" : `${40 + navy.faceY}px`,
          }}
        >
          <EyeBall
            size={18}
            pupilSize={7}
            maxDistance={5}
            pupilColor={PUPIL}
            isBlinking={isNavyBlinking}
            forceLookX={pwShown ? (isNavyPeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
            forceLookY={pwShown ? (isNavyPeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
          />
          <EyeBall
            size={18}
            pupilSize={7}
            maxDistance={5}
            pupilColor={PUPIL}
            isBlinking={isNavyBlinking}
            forceLookX={pwShown ? (isNavyPeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
            forceLookY={pwShown ? (isNavyPeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
          />
        </div>
      </div>

      {/* Ink — middle column. Leans further into the conversation when the two back characters glance at each other. */}
      <div
        ref={inkRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: "240px",
          width: "120px",
          height: "310px",
          backgroundColor: INK,
          borderRadius: "8px 8px 0 0",
          zIndex: 2,
          transform: pwShown
            ? "skewX(0deg)"
            : isLookingAtEachOther
              ? `skewX(${ink.bodySkew * 1.5 + 10}deg) translateX(20px)`
              : isFocusing || pwHidden
                ? `skewX(${ink.bodySkew * 1.5}deg)`
                : `skewX(${ink.bodySkew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-6 transition-all duration-700 ease-in-out"
          style={{
            left: pwShown ? "10px" : isLookingAtEachOther ? "32px" : `${26 + ink.faceX}px`,
            top: pwShown ? "28px" : isLookingAtEachOther ? "12px" : `${32 + ink.faceY}px`,
          }}
        >
          <EyeBall
            size={16}
            pupilSize={6}
            maxDistance={4}
            pupilColor={PUPIL}
            isBlinking={isInkBlinking}
            forceLookX={pwShown ? -4 : isLookingAtEachOther ? 0 : undefined}
            forceLookY={pwShown ? -4 : isLookingAtEachOther ? -4 : undefined}
          />
          <EyeBall
            size={16}
            pupilSize={6}
            maxDistance={4}
            pupilColor={PUPIL}
            isBlinking={isInkBlinking}
            forceLookX={pwShown ? -4 : isLookingAtEachOther ? 0 : undefined}
            forceLookY={pwShown ? -4 : isLookingAtEachOther ? -4 : undefined}
          />
        </div>
      </div>

      {/* Terracotta — front-left dome. Just pupils, no whites. */}
      <div
        ref={terracottaRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: "0px",
          width: "240px",
          height: "200px",
          backgroundColor: TERRACOTTA,
          borderRadius: "120px 120px 0 0",
          zIndex: 3,
          transform: pwShown ? "skewX(0deg)" : `skewX(${terracotta.bodySkew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-8 transition-all duration-200 ease-out"
          style={{
            left: pwShown ? "50px" : `${82 + terracotta.faceX}px`,
            top: pwShown ? "85px" : `${90 + terracotta.faceY}px`,
          }}
        >
          <Pupil
            size={12}
            maxDistance={5}
            pupilColor={PUPIL}
            forceLookX={pwShown ? -5 : undefined}
            forceLookY={pwShown ? -4 : undefined}
          />
          <Pupil
            size={12}
            maxDistance={5}
            pupilColor={PUPIL}
            forceLookX={pwShown ? -5 : undefined}
            forceLookY={pwShown ? -4 : undefined}
          />
        </div>
      </div>

      {/* Saffron — front-right rounded top with a mouth line. */}
      <div
        ref={saffronRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: "310px",
          width: "140px",
          height: "230px",
          backgroundColor: SAFFRON,
          borderRadius: "70px 70px 0 0",
          zIndex: 4,
          transform: pwShown ? "skewX(0deg)" : `skewX(${saffron.bodySkew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-6 transition-all duration-200 ease-out"
          style={{
            left: pwShown ? "20px" : `${52 + saffron.faceX}px`,
            top: pwShown ? "35px" : `${40 + saffron.faceY}px`,
          }}
        >
          <Pupil
            size={12}
            maxDistance={5}
            pupilColor={PUPIL}
            forceLookX={pwShown ? -5 : undefined}
            forceLookY={pwShown ? -4 : undefined}
          />
          <Pupil
            size={12}
            maxDistance={5}
            pupilColor={PUPIL}
            forceLookX={pwShown ? -5 : undefined}
            forceLookY={pwShown ? -4 : undefined}
          />
        </div>
        <div
          className="absolute w-20 h-[4px] rounded-full transition-all duration-200 ease-out"
          style={{
            backgroundColor: INK,
            left: pwShown ? "10px" : `${40 + saffron.faceX}px`,
            top: pwShown ? "88px" : `${88 + saffron.faceY}px`,
          }}
        />
      </div>
    </div>
  );
}
