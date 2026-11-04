"use client";

import { useCallback, useRef, useState } from "react";

export type View = { scale: number; x: number; y: number };
export const FIT: View = { scale: 1, x: 0, y: 0 };
const MIN = 0.25;
const MAX = 8;

/**
 * Zoom and pan expressed relative to "fit to stage" (scale 1 = fitted).
 * Wheel zooms around the cursor; drag pans; keys + − 0 work when the stage has focus.
 * Pass `view`/`onView` to share one view between two stages (synchronised zoom).
 */
export function useZoomPan(shared?: { view: View; onView: (v: View) => void }) {
  const [local, setLocal] = useState<View>(FIT);
  const view = shared?.view ?? local;
  const setView = useCallback((v: View | ((prev: View) => View)) => {
    if (shared) shared.onView(typeof v === "function" ? v(shared.view) : v);
    else setLocal(v);
  }, [shared]);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const zoomAt = useCallback(
    (factor: number, cx = 0, cy = 0) =>
      setView((v) => {
        const scale = Math.min(MAX, Math.max(MIN, v.scale * factor));
        const k = scale / v.scale;
        // keep the point under the cursor fixed (cx, cy relative to stage centre)
        return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
      }),
    [setView],
  );

  const handlers = {
    onWheel: (e: React.WheelEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      const step = 40;
      if (e.key === "+" || e.key === "=") zoomAt(1.25);
      else if (e.key === "-" || e.key === "_") zoomAt(0.8);
      else if (e.key === "0") setView(FIT);
      else if (e.key === "ArrowLeft") setView((v) => ({ ...v, x: v.x + step }));
      else if (e.key === "ArrowRight") setView((v) => ({ ...v, x: v.x - step }));
      else if (e.key === "ArrowUp") setView((v) => ({ ...v, y: v.y + step }));
      else if (e.key === "ArrowDown") setView((v) => ({ ...v, y: v.y - step }));
      else return;
      e.preventDefault();
    },
  };

  return {
    view,
    setView,
    handlers,
    zoomIn: () => zoomAt(1.25),
    zoomOut: () => zoomAt(0.8),
    fit: () => setView(FIT),
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
  };
}
