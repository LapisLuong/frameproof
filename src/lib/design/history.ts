/** Pure undo/redo transitions for the editor (see src/components/design/useHistory.ts). */

export const HISTORY_LIMIT = 100;
export const MERGE_MS = 1000;

export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Present value when a live gesture began, or null outside a gesture. */
  gestureBase: T | null;
  /** Key and time of the last keyed commit, for merging. */
  lastKey: { key: string; at: number } | null;
};

export function historyCommit<T>(s: HistoryState<T>, value: T, key: string | undefined, now: number): HistoryState<T> {
  // A commit during a gesture first closes the gesture, so neither change is lost.
  const base = s.gestureBase !== null ? historyEnd(s) : s;
  if (Object.is(value, base.present)) return base === s ? s : base;
  const merge = !!key && base.lastKey?.key === key && now - base.lastKey.at < MERGE_MS && base.past.length > 0;
  return {
    past: merge ? base.past : [...base.past, base.present].slice(-HISTORY_LIMIT),
    present: value,
    future: [],
    gestureBase: null,
    lastKey: key ? { key, at: now } : null,
  };
}

export function historyLive<T>(s: HistoryState<T>, value: T): HistoryState<T> {
  if (Object.is(value, s.present)) return s;
  return { ...s, present: value, gestureBase: s.gestureBase ?? s.present };
}

export function historyEnd<T>(s: HistoryState<T>): HistoryState<T> {
  if (s.gestureBase === null) return s;
  if (Object.is(s.gestureBase, s.present)) return { ...s, gestureBase: null, lastKey: null };
  return { past: [...s.past, s.gestureBase].slice(-HISTORY_LIMIT), present: s.present, future: [], gestureBase: null, lastKey: null };
}

export function historyUndo<T>(s: HistoryState<T>): HistoryState<T> {
  const ended = historyEnd(s);
  if (!ended.past.length) return ended;
  return { past: ended.past.slice(0, -1), present: ended.past[ended.past.length - 1]!, future: [ended.present, ...ended.future], gestureBase: null, lastKey: null };
}

export function historyRedo<T>(s: HistoryState<T>): HistoryState<T> {
  if (!s.future.length || s.gestureBase !== null) return s;
  return { past: [...s.past, s.present], present: s.future[0]!, future: s.future.slice(1), gestureBase: null, lastKey: null };
}
