"use client";

import { useRef, useState } from "react";
import { applyPaletteEdit, docSwatches, startSession, toggleLock, type PaletteSession } from "@/lib/design/doc-palette";
import type { DesignDoc } from "@/lib/design/schema";
import { PaletteEditor } from "./PaletteEditor";

type Props = {
  doc: DesignDoc;
  /** Live change during a slider drag (not yet an undo step). */
  onLive: (doc: DesignDoc) => void;
  /** The drag ended: record the whole change as one undo step. */
  onEnd: () => void;
  onCommit: (doc: DesignDoc) => void;
  comparing: boolean;
  onCompare: (on: boolean) => void;
  canCompare: boolean;
};

/**
 * The design's palette: every colour it uses, linked across layers. Changing a swatch recolours every layer that
 * uses it; the whole-palette sliders shift them all; locked brand colours stay put. One drag is one undo step.
 */
export function DocPalette({ doc, onLive, onEnd, onCommit, comparing, onCompare, canCompare }: Props) {
  const session = useRef<PaletteSession | null>(null);
  // While dragging, the list shows the session's colours in their original order (two may pass through each other).
  const [live, setLive] = useState<{ hexes: string[]; labels: string[]; locked: boolean[] } | null>(null);
  const swatches = docSwatches(doc);
  const entries = live
    ? live.hexes.map((hex, i) => ({ hex, label: live.labels[i] ?? "", locked: live.locked[i] }))
    : swatches.map((s) => ({ hex: s.hex, label: s.label, locked: s.locked }));

  const change = (hexes: string[]) => {
    if (!session.current) {
      session.current = startSession(doc);
      setLive({ hexes, labels: swatches.map((s) => s.label), locked: swatches.map((s) => s.locked) });
    } else setLive((v) => (v ? { ...v, hexes } : v));
    onLive(applyPaletteEdit(session.current, hexes));
  };
  const end = () => {
    if (!session.current) return;
    session.current = null;
    setLive(null);
    onEnd();
  };

  return (
    <div className="doc-palette" data-testid="doc-palette">
      <PaletteEditor
        heading="Palette"
        entries={entries}
        onChange={change}
        onCommitEnd={end}
        renderExtra={(i) => {
          const s = swatches[i];
          if (!s || live) return null;
          return (
            <label className="t-meta palette-lock" title="For a brand or logo colour: palette changes leave it alone.">
              <input type="checkbox" checked={s.locked} onChange={() => onCommit(toggleLock(doc, s.hex))} />
              Lock as a brand colour
            </label>
          );
        }}
      />
      <p className="hint">Colours inside pictures (photos, a logo image) aren&apos;t changed here; only layer colours are.</p>
      {canCompare ? (
        <button type="button" className="btn btn-sm" aria-pressed={comparing} onClick={() => onCompare(!comparing)}>
          {comparing ? "Back to current" : "Compare with before"}
        </button>
      ) : null}
    </div>
  );
}
