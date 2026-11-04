"use client";

import { useId, useState } from "react";
import { adjustPalette, hexToHsl, hslToHex } from "@/lib/design/palette";

export type PaletteEntry = {
  hex: string;
  /** Small label under the swatch, e.g. a role or "3 layers". */
  label: string;
  /** Extra line for screen readers and the title tooltip, e.g. "measured, 41% of the reference". */
  detail?: string;
  /** Locked colours (brand, logo) can't be changed here and are skipped by whole-palette changes. */
  locked?: boolean;
};

type Props = {
  entries: PaletteEntry[];
  /** New colours, same order as `entries`. `key` lets the caller merge a slider drag into one undo step. */
  onChange: (hexes: string[], key: string) => void;
  /** Called when a slider gesture ends (pointer up / key up), to close an undo step. */
  onCommitEnd?: () => void;
  heading?: string;
  /** Extra controls for the selected swatch (role menu, remove…). */
  renderExtra?: (index: number) => React.ReactNode;
};

function Slider({ label, value, min, max, onChange, onEnd, suffix, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; onEnd?: () => void; suffix: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="palette-slider">
      <label htmlFor={id} className="t-small">
        {label}
      </label>
      <input id={id} type="range" className="slider" min={min} max={max} step={1} value={Math.round(value)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={onEnd} onKeyUp={onEnd} />
      <span className="t-value">
        {Math.round(value)}
        {suffix}
      </span>
    </div>
  );
}

/**
 * Palette swatches you can open and tune in HSL, one at a time or all together. Whole-palette sliders are relative
 * (shift hue, add saturation or lightness) from the colours as they were when the drag began, so dragging back to
 * zero restores them exactly.
 */
export function PaletteEditor({ entries, onChange, onCommitEnd, heading = "Palette", renderExtra }: Props) {
  const [open, setOpen] = useState<number | null>(entries.length ? 0 : null);
  const [base, setBase] = useState<string[] | null>(null);
  const [delta, setDelta] = useState({ h: 0, s: 0, l: 0 });
  const hexes = entries.map((e) => e.hex);
  const selected = open !== null && open < entries.length ? open : null;
  const hsl = selected !== null ? hexToHsl(hexes[selected]!) : null;

  const setOne = (patch: Partial<{ h: number; s: number; l: number }>) => {
    if (selected === null || !hsl || entries[selected]?.locked) return;
    const next = [...hexes];
    next[selected] = hslToHex({ ...hsl, ...patch });
    onChange(next, `palette:${selected}`);
  };
  const setAll = (patch: Partial<typeof delta>) => {
    const from = base ?? hexes;
    if (!base) setBase(hexes);
    const d = { ...delta, ...patch };
    setDelta(d);
    const adjusted = adjustPalette(from, d);
    onChange(adjusted.map((hex, i) => (entries[i]?.locked ? from[i]! : hex)), "palette:all");
  };
  const endAll = () => {
    setBase(null);
    setDelta({ h: 0, s: 0, l: 0 });
    onCommitEnd?.();
  };

  return (
    <section className="palette-editor" aria-label={heading}>
      <h3 className="t-meta">{heading}</h3>
      <ul className="palette-swatches" role="list">
        {entries.map((e, i) => (
          <li key={`${i}-${e.hex}`}>
            <button
              type="button"
              className="palette-swatch"
              aria-pressed={selected === i}
              aria-label={`${e.label}, ${e.hex}${e.detail ? `, ${e.detail}` : ""}${e.locked ? ", locked" : ""}. Edit this colour`}
              data-locked={e.locked || undefined}
              title={e.detail}
              onClick={() => setOpen(selected === i ? null : i)}
            >
              <span style={{ background: e.hex }} />
            </button>
            <span className="t-small palette-label">
              {e.label}
              {e.locked ? " · locked" : ""}
            </span>
            <span className="t-value palette-hex">{e.hex}</span>
          </li>
        ))}
      </ul>

      {selected !== null && hsl ? (
        <div className="palette-detail" data-testid="swatch-editor">
          <p className="t-small">
            Colour {selected + 1}: <span className="t-value">{hexes[selected]}</span>
          </p>
          <Slider label="Hue" value={hsl.h} min={0} max={360} suffix="°" disabled={entries[selected]?.locked} onChange={(h) => setOne({ h })} onEnd={onCommitEnd} />
          <Slider label="Saturation" value={hsl.s} min={0} max={100} suffix="%" disabled={entries[selected]?.locked} onChange={(s) => setOne({ s })} onEnd={onCommitEnd} />
          <Slider label="Lightness" value={hsl.l} min={0} max={100} suffix="%" disabled={entries[selected]?.locked} onChange={(l) => setOne({ l })} onEnd={onCommitEnd} />
          {renderExtra?.(selected)}
        </div>
      ) : null}

      {entries.length > 1 ? (
        <details className="palette-all">
          <summary className="t-small">Adjust the whole palette</summary>
          <Slider label="Hue shift" value={delta.h} min={-180} max={180} suffix="°" onChange={(h) => setAll({ h })} onEnd={endAll} />
          <Slider label="Saturation" value={delta.s} min={-100} max={100} suffix="" onChange={(s) => setAll({ s })} onEnd={endAll} />
          <Slider label="Lightness" value={delta.l} min={-100} max={100} suffix="" onChange={(l) => setAll({ l })} onEnd={endAll} />
        </details>
      ) : null}
    </section>
  );
}
