"use client";

import { useCallback, useRef, useState } from "react";
import { historyCommit, historyEnd, historyLive, historyRedo, historyUndo, type HistoryState } from "@/lib/design/history";

function resolve<T>(present: T, next: T | ((prev: T) => T)): T {
  return typeof next === "function" ? (next as (prev: T) => T)(present) : next;
}

/**
 * Undo/redo over immutable snapshots (logic in src/lib/design/history.ts, unit-tested).
 *
 * Every transition runs once, in the event handler, never inside a React updater function, so Strict Mode's
 * double-invoked updaters can't record or merge a step twice.
 *
 * - `commit(next, key?)` records one step; the same key within a second merges into the last step (typing a word or
 *   scrubbing a number is one undo).
 * - `live(next)` changes the present during a drag; `end()` records the whole gesture as one step.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<HistoryState<T>>(() => ({ past: [], present: initial, future: [], gestureBase: null, lastKey: null }));
  // Handlers read the latest state from the ref (several can run before a re-render) and set it directly, never
  // through an updater function.
  const ref = useRef(state);
  const set = useCallback((next: HistoryState<T>) => {
    if (next === ref.current) return;
    ref.current = next;
    setState(next);
  }, []);

  const commit = useCallback((next: T | ((prev: T) => T), key?: string) => set(historyCommit(ref.current, resolve(ref.current.present, next), key, Date.now())), [set]);
  const live = useCallback((next: T | ((prev: T) => T)) => set(historyLive(ref.current, resolve(ref.current.present, next))), [set]);
  const end = useCallback(() => set(historyEnd(ref.current)), [set]);
  const undo = useCallback(() => set(historyUndo(ref.current)), [set]);
  const redo = useCallback(() => set(historyRedo(ref.current)), [set]);

  return { present: state.present, canUndo: state.past.length > 0, canRedo: state.future.length > 0, commit, live, end, undo, redo };
}
