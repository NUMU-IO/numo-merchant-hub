import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NumuLoadingScreen } from "./index";

/**
 * Plays the tapping-hand welcome screen exactly once: the first time a
 * freshly registered account is authenticated in this browser.
 *
 * "Fresh" = account created within the last 48h (covers register-then-
 * verify flows without ever greeting long-standing users on new devices).
 * A per-user localStorage flag guarantees the screen never repeats.
 * Demo sandbox sessions are excluded — each demo click mints a new user
 * and would replay the splash every time.
 */

const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000;
const WELCOME_DURATION_MS = 2800;
const FADE_MS = 400;

const welcomeKey = (userId: string) => `numu:welcome-shown:${userId}`;

export function FirstLoginGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"idle" | "showing" | "fading">("idle");
  const startedForRef = useRef<string | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || startedForRef.current === userId) return;
    const current = userRef.current;
    if (!current || current.id !== userId) return;
    if (current.tenant?.is_demo) return;

    const createdAt = new Date(current.created_at).getTime();
    const isFreshAccount =
      Number.isFinite(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;

    let alreadyWelcomed = false;
    try {
      alreadyWelcomed = !!localStorage.getItem(welcomeKey(userId));
    } catch {
      // Storage unavailable (private mode) — treat as not welcomed.
    }
    if (!isFreshAccount || alreadyWelcomed) return;

    startedForRef.current = userId;
    try {
      localStorage.setItem(welcomeKey(userId), new Date().toISOString());
    } catch {
      // Best effort — worst case the splash replays next session.
    }

    setPhase("showing");
    const fadeTimer = setTimeout(() => setPhase("fading"), WELCOME_DURATION_MS);
    const doneTimer = setTimeout(
      () => setPhase("idle"),
      WELCOME_DURATION_MS + FADE_MS,
    );
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      setPhase("idle");
    };
  }, [userId]);

  return (
    <>
      {children}
      {phase !== "idle" && (
        <div
          className={`fixed inset-0 z-[210] transition-opacity duration-[400ms] ${
            phase === "fading" ? "opacity-0" : "opacity-100"
          }`}
        >
          <NumuLoadingScreen />
        </div>
      )}
    </>
  );
}
