/**
 * `beforeinstallprompt` capture.
 *
 * WHY THIS IS A MODULE AND NOT A HOOK
 * Chrome fires `beforeinstallprompt` as soon as it decides the app is
 * installable — which can be BEFORE React has mounted. A hook that subscribes
 * in `useEffect` would miss it, and the merchant would never see an install
 * CTA. So the listener is registered at module-evaluation time (main.tsx
 * imports this before `createRoot`), the event is stashed, and React reads the
 * stash whenever it gets around to rendering.
 *
 * We also `preventDefault()` it, which suppresses Chrome's own mini-infobar so
 * the app can offer installation at a moment that makes sense (after the
 * merchant's first order) rather than the browser interrupting them on load.
 *
 * Android/Chromium only. iOS never fires this event — see IosInstallSheet.
 */

/** Not in TypeScript's DOM lib; this is the shape Chromium ships. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type Listener = () => void;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

/** Called once from main.tsx, before React renders. Safe to call twice. */
let started = false;
export function initInstallPromptCapture(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress Chrome's mini-infobar — we surface our own CTA instead.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    // The event is single-use and meaningless once installed.
    deferred = null;
    emit();
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function wasInstalled(): boolean {
  return installed;
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Show the native install dialog. Returns the merchant's choice, or null if
 * there was nothing to show.
 *
 * The deferred event is SINGLE-USE: once prompted it cannot be reused, so it is
 * cleared regardless of outcome. If the merchant dismisses, Chrome will fire a
 * fresh `beforeinstallprompt` on a later visit.
 */
export async function showInstallPrompt(): Promise<"accepted" | "dismissed" | null> {
  const event = deferred;
  if (!event) return null;
  deferred = null;
  emit();

  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return null;
  }
}
