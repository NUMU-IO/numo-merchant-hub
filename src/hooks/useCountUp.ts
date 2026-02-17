import { useState, useEffect, useRef } from "react";

export function useCountUp(end: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>();

  useEffect(() => {
    startTime.current = null;
    const step = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) {
        rafId.current = requestAnimationFrame(step);
      }
    };
    rafId.current = requestAnimationFrame(step);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [end, duration]);

  return count;
}
