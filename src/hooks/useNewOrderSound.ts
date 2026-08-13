/**
 * The new-order chime — the same sound `numu-merchant-app` uses.
 *
 * Source: `numu-merchant-app/assets/sounds/notification.wav`, transcoded to
 * mp3 + ogg (220 KB → 16 KB). One sound across the mobile app and the hub so a
 * merchant learns a single cue.
 *
 * ─── WHAT THIS CAN AND CANNOT DO ─────────────────────────────────────────────
 * This plays when an order arrives while the HUB IS OPEN. It is NOT the sound
 * of a background push notification.
 *
 * A web push notification's sound is chosen by the OS, not by us: the `sound`
 * property was dropped from the Notifications spec and is implemented by no
 * browser. Android's custom notification-channel sounds are a NATIVE-app
 * feature — which is exactly why `numu-merchant-app` can use this file for
 * background pushes and a PWA cannot. There is no workaround; a background
 * push gets the platform default.
 *
 * ─── THE AUTOPLAY GATE ───────────────────────────────────────────────────────
 * Browsers refuse `audio.play()` until the user has interacted with the page.
 * `NewOrderNotifier` polls on a timer, so by the time an order arrives there
 * may have been no interaction in that tab and playback would reject.
 *
 * So we "unlock" on the first real gesture: play the clip muted, which the
 * browser accepts, after which later unmuted plays are permitted for the
 * lifetime of the page. This is the standard workaround and it is why the
 * first order after a hard reload can be silent if the merchant has not
 * clicked anything at all.
 */
import { useCallback, useEffect, useRef } from "react";

const SOUND_ENABLED_KEY = "numu.order-sound-enabled";

export function isOrderSoundEnabled(): boolean {
  try {
    // Opt-OUT: a merchant who wants to hear orders shouldn't have to find a
    // setting first. The Settings toggle exists to silence it.
    return localStorage.getItem(SOUND_ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setOrderSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* private mode — reverts to the default next session */
  }
}

export function useNewOrderSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  // Built once and reused. Constructing an Audio per order would re-download
  // on a cold HTTP cache and add latency to the very thing meant to be instant.
  useEffect(() => {
    const el = new Audio();
    // Prefer ogg/opus where supported, else mp3 — between them every browser
    // NUMU targets is covered.
    el.src = el.canPlayType("audio/ogg; codecs=opus")
      ? "/sounds/new-order.ogg"
      : "/sounds/new-order.mp3";
    el.preload = "auto";
    el.volume = 0.6; // a full-volume chime in a quiet shop is startling
    audioRef.current = el;

    // Unlock on the first genuine interaction anywhere in the app.
    const unlock = () => {
      if (unlockedRef.current || !audioRef.current) return;
      const a = audioRef.current;
      const previous = a.muted;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = previous;
          unlockedRef.current = true;
        })
        .catch(() => {
          a.muted = previous;
        });
    };

    // `once` per event: one successful gesture is enough for the page's life.
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return useCallback(() => {
    if (!isOrderSoundEnabled()) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      // Rewind so two orders in quick succession both chime instead of the
      // second being swallowed by the first still playing.
      a.currentTime = 0;
      void a.play().catch(() => {
        /* still gated, or the tab is muted — the visual toast already fired */
      });
    } catch {
      /* never let a sound failure break order handling */
    }
  }, []);
}
