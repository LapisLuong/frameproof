"use client";

import type { View } from "./useZoomPan";
import { useZoomPan } from "./useZoomPan";

/** A numbered proof mark on the artwork. x/y are fractions of the image's width and height. */
export type ArtworkMark = { id: string; n: number; x: number; y: number; label: string; title: string };

type Props = {
  src: string;
  alt: string;
  label?: string;
  labelSide?: "left" | "right";
  height?: string;
  shared?: { view: View; onView: (v: View) => void };
  showControls?: boolean;
  dark?: boolean;
  marks?: ArtworkMark[];
  selectedId?: string | null;
  onMark?: (id: string) => void;
};

/** Single artwork on the stage with fit, zoom and pan. Crop marks show the image's true bounds. */
export function ImageViewer({
  src,
  alt,
  label,
  labelSide = "left",
  height = "min(70vh, 44rem)",
  shared,
  showControls = true,
  dark,
  marks = [],
  selectedId,
  onMark,
}: Props) {
  const zp = useZoomPan(shared);
  return (
    <div>
      <div
        className="stage"
        data-dark={dark ? "true" : undefined}
        style={{ height, cursor: "grab" }}
        tabIndex={0}
        role="group"
        aria-label={`${label ?? alt}. Use plus and minus to zoom, arrow keys to pan, 0 to fit.`}
        {...zp.handlers}
      >
        {label ? (
          <span className="stage-label" data-side={labelSide}>
            {label}
          </span>
        ) : null}
        <div style={{ position: "absolute", inset: "2.5rem", display: "grid", placeItems: "center" }}>
          <div
            style={{
              transform: zp.transform,
              transformOrigin: "center",
              transition: "transform 60ms linear",
              maxWidth: "100%",
              maxHeight: "100%",
              display: "grid",
            }}
          >
            <div style={{ position: "relative", display: "grid", maxWidth: "100%", maxHeight: "100%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URLs can't use next/image */}
              <img
                src={src}
                alt={alt}
                draggable={false}
                style={{ maxWidth: "100%", maxHeight: `calc(${height} - 5rem)`, objectFit: "contain", display: "block", userSelect: "none" }}
              />
              <span className="cropmarks" style={{ inset: 0 }} aria-hidden="true">
                <i />
              </span>
              {marks.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="artmark"
                  data-selected={selectedId === m.id ? "true" : undefined}
                  data-testid="artmark"
                  style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, transform: `translate(-50%, -50%) scale(${1 / zp.view.scale})` }}
                  aria-label={`Note ${m.n}: ${m.title}. ${m.label}.`}
                  aria-pressed={selectedId === m.id}
                  title={m.label}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onMark?.(m.id)}
                >
                  {m.n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {showControls ? (
        <div className="toolbar" aria-label="Zoom">
          <button type="button" className="btn btn-sm" onClick={zp.zoomOut} aria-label="Zoom out">
            −
          </button>
          <span className="t-value" aria-live="polite" style={{ minWidth: "3.5rem", textAlign: "center" }}>
            {Math.round(zp.view.scale * 100)}%
          </span>
          <button type="button" className="btn btn-sm" onClick={zp.zoomIn} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="btn btn-sm" onClick={zp.fit}>
            Fit
          </button>
          <span className="t-small">Percent of fitted size</span>
        </div>
      ) : null}
    </div>
  );
}
