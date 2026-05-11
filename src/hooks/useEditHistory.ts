import { useState, useCallback, useRef } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseEditHistoryReturn<T> {
  state: T;
  setState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  commit: () => void;
}

const MAX_HISTORY = 50;

export function useEditHistory<T>(initialState: T): UseEditHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const pendingRef = useRef<T | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setState = useCallback((newState: T) => {
    pendingRef.current = newState;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setHistory((prev) => ({
        past: [...prev.past.slice(-MAX_HISTORY + 1), prev.present],
        present: pendingRef.current as T,
        future: [],
      }));
      pendingRef.current = null;
    }, 500);
    setHistory((prev) => ({ ...prev, present: newState }));
  }, []);

  const commit = useCallback(() => {
    clearTimeout(debounceRef.current);
    if (pendingRef.current !== null) {
      setHistory((prev) => ({
        past: [...prev.past.slice(-MAX_HISTORY + 1), prev.present],
        present: pendingRef.current as T,
        future: [],
      }));
      pendingRef.current = null;
    }
  }, []);

  const undo = useCallback(() => {
    clearTimeout(debounceRef.current);
    pendingRef.current = null;
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      return { past: newPast, present: previous, future: [prev.present, ...prev.future] };
    });
  }, []);

  const redo = useCallback(() => {
    clearTimeout(debounceRef.current);
    pendingRef.current = null;
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const next = newFuture.shift()!;
      return { past: [...prev.past, prev.present], present: next, future: newFuture };
    });
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
  };
}