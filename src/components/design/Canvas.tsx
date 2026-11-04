"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hitTest, resizeRotated, updateLayer, type Handle } from "@/lib/design/edit";
import { renderSvg } from "@/lib/design/render";
import { cssFamily, measureText } from "@/lib/design/browser";
import type { DesignDoc, Layer } from "@/lib/design/schema";

type Props = {
  doc: DesignDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Change during a gesture (not recorded); `onEnd` records the gesture as one undo step. */
  onLive: (fn: (d: DesignDoc) => DesignDoc) => void;
  onEnd: () => void;
  imageUrl: (resourceId: string) => string | null;
  onEditText?: (id: string) => void;
  /** Bumped when fonts finish loading, so text is re-measured. */
  fontsVersion: number;
};

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const SNAP_PX = 6;

type Drag =
  | { kind: "move"; id: string; start: { x: number; y: number }; origin: Layer }
  | { kind: "resize"; id: string; handle: Handle; start: { x: number; y: number }; origin: Layer }
  | { kind: "rotate"; id: string; origin: Layer };

export function Canvas({ doc, selectedId, onSelect, onLive, onEnd, imageUrl, onEditText, fontsVersion }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [box, setBox] = useState({ w: 600, h: 600 });
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.max(0.02, Math.min((box.w - 32) / doc.width, (box.h - 32) / doc.height));
  const svg = useMemo(
    () => renderSvg(doc, { measure: measureText, fontFamily: cssFamily, image: imageUrl, placeholders: true, idPrefix: "edit" }),
    // fontsVersion re-measures text once faces have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, imageUrl, fontsVersion],
  );
  const selected = doc.layers.find((l) => l.id === selectedId) ?? null;

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const begin = (e: React.PointerEvent, d: Drag) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = d;
  };

  const onStageDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = toCanvas(e);
    const hit = hitTest(doc, p.x, p.y, { slop: 4 / scale });
    onSelect(hit?.id ?? null);
    if (hit && !hit.locked) begin(e, { kind: "move", id: hit.id, start: p, origin: hit });
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e);
    if (d.kind === "move") {
      let x = d.origin.x + (p.x - d.start.x);
      let y = d.origin.y + (p.y - d.start.y);
      const g: { x: number | null; y: number | null } = { x: null, y: null };
      if (!e.altKey) {
        const tol = SNAP_PX / scale;
        // Snap the layer's left, centre or right to the canvas edges and centre line (Alt turns snapping off).
        for (const [edge, off] of [
          [0, 0],
          [doc.width / 2, d.origin.w / 2],
          [doc.width, d.origin.w],
        ] as const) {
          if (Math.abs(x + off - edge) < tol) {
            x = edge - off;
            g.x = edge;
            break;
          }
        }
        for (const [edge, off] of [
          [0, 0],
          [doc.height / 2, d.origin.h / 2],
          [doc.height, d.origin.h],
        ] as const) {
          if (Math.abs(y + off - edge) < tol) {
            y = edge - off;
            g.y = edge;
            break;
          }
        }
      }
      setGuides(g);
      onLive((doc) => updateLayer(doc, d.id, { x: Math.round(x), y: Math.round(y) }));
    } else if (d.kind === "resize") {
      // Work in the layer's own axes so handles behave on rotated layers.
      const a = (-d.origin.rotation * Math.PI) / 180;
      const dx0 = p.x - d.start.x;
      const dy0 = p.y - d.start.y;
      const dx = dx0 * Math.cos(a) - dy0 * Math.sin(a);
      const dy = dx0 * Math.sin(a) + dy0 * Math.cos(a);
      const keep = e.shiftKey || d.origin.type === "image";
      const next = resizeRotated(d.origin, d.handle, dx, dy, keep);
      onLive((doc) => updateLayer(doc, d.id, { x: Math.round(next.x), y: Math.round(next.y), w: Math.round(next.w), h: Math.round(next.h) }));
    } else {
      const cx = d.origin.x + d.origin.w / 2;
      const cy = d.origin.y + d.origin.h / 2;
      let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      // Shift steps by 15°; without it, angles near a right angle settle on it.
      deg = e.shiftKey ? Math.round(deg / 15) * 15 : Math.abs(deg % 90) < 2 || Math.abs(deg % 90) > 88 ? Math.round(deg / 90) * 90 : Math.round(deg);
      onLive((doc) => updateLayer(doc, d.id, { rotation: deg }));
    }
  };

  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setGuides({ x: null, y: null });
    onEnd();
  };

  const w = doc.width * scale;
  const h = doc.height * scale;

  return (
    <div ref={wrap} className="design-canvas" data-testid="design-canvas">
      <div className={`design-stage-frame${doc.transparent ? " checker" : ""}`} style={{ width: w, height: h }}>
        <div
          className="design-svg"
          style={{ width: doc.width, height: doc.height, transform: `scale(${scale})` }}
          aria-label={`${doc.name}, ${doc.width}×${doc.height} px`}
          role="img"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div
          ref={stage}
          className="design-overlay"
          onPointerDown={onStageDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={(e) => {
            const p = toCanvas(e);
            const hit = hitTest(doc, p.x, p.y);
            if (hit?.type === "text") onEditText?.(hit.id);
          }}
        >
          {guides.x !== null ? <i className="design-guide" data-axis="x" style={{ left: guides.x * scale }} /> : null}
          {guides.y !== null ? <i className="design-guide" data-axis="y" style={{ top: guides.y * scale }} /> : null}
          {selected && !selected.hidden ? (
            <div
              className="design-selection"
              data-locked={selected.locked || undefined}
              data-testid="selection"
              style={{
                left: selected.x * scale,
                top: selected.y * scale,
                width: selected.w * scale,
                height: selected.h * scale,
                transform: selected.rotation ? `rotate(${selected.rotation}deg)` : undefined,
              }}
              onPointerDown={(e) => {
                if (e.button !== 0 || selected.locked) return;
                begin(e, { kind: "move", id: selected.id, start: toCanvas(e), origin: selected });
              }}
            >
              {selected.locked
                ? null
                : HANDLES.map((hd) => (
                    <span
                      key={hd}
                      className="design-handle"
                      data-handle={hd}
                      aria-hidden="true"
                      onPointerDown={(e) => begin(e, { kind: "resize", id: selected.id, handle: hd, start: toCanvas(e), origin: selected })}
                    />
                  ))}
              {selected.locked ? null : (
                <span className="design-rotate" aria-hidden="true" title="Drag to rotate" onPointerDown={(e) => begin(e, { kind: "rotate", id: selected.id, origin: selected })} />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
