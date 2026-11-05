"use client";

import { useId, useState } from "react";
import { hasItalic, nearestWeight } from "@/lib/design/fonts";
import { BLEND_LABEL, EFFECT_LABEL, SPREAD_LABEL, layerKind } from "@/lib/design/labels";
import { BLEND_MODES, BUILTIN_FONT_IDS, BUILTIN_FONTS, EFFECTS, FORMATS, isBuiltinFont, type DesignDoc, type FontRef, type Layer, type TextLayer } from "@/lib/design/schema";

export type FontOption = { id: FontRef; label: string };
export type ImageOption = { id: string; label: string };

type Props = {
  doc: DesignDoc;
  layer: Layer | null;
  /** Record a change; `key` merges quick successive edits of one field into one undo step. */
  onLayer: (patch: Partial<Layer>, key: string) => void;
  onDoc: (patch: Partial<Pick<DesignDoc, "name" | "width" | "height" | "background" | "transparent">>, key: string) => void;
  userFonts: FontOption[];
  images: ImageOption[];
  textRef?: React.Ref<HTMLTextAreaElement>;
  onNudge: (dx: number, dy: number) => void;
  /** Open background removal for the selected picture (absent when the tool isn't offered). */
  onCutout?: () => void;
  /** Open "fill an area" (inpainting) for the selected picture. */
  onInpaint?: () => void;
};

/** Numeric field that only commits valid numbers, and shows what was typed until then. */
function NumberField({ label, value, onChange, min, max, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const id = useId();
  // What's typed while the field is being edited; otherwise it shows the current value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(round(value));
  return (
    <div className="field design-num">
      <label htmlFor={id}>
        {label}
        {suffix ? <span className="hint"> {suffix}</span> : null}
      </label>
      <input
        id={id}
        className="input"
        inputMode="decimal"
        type="number"
        step={step}
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) onChange(v);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}
const round = (v: number) => Math.round(v * 100) / 100;

function ColourField({ label, value, onChange, allowNone, swatches }: { label: string; value: string | null; onChange: (v: string | null) => void; allowNone?: boolean; swatches: string[] }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value ?? "";
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="design-colour">
        <input type="color" aria-label={`${label}, picker`} value={value ?? "#ffffff"} onChange={(e) => onChange(e.target.value)} />
        <input
          id={id}
          className="input t-value"
          value={text}
          placeholder={allowNone ? "None" : "#rrggbb"}
          maxLength={7}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          onBlur={() => setDraft(null)}
        />
        {allowNone && value ? (
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => onChange(null)}>
            Remove
          </button>
        ) : null}
      </div>
      {swatches.length ? (
        <div className="design-swatches" role="group" aria-label={`Colours in this design for ${label.toLowerCase()}`}>
          {swatches.map((s) => (
            <button key={s} type="button" title={s} aria-label={s} aria-pressed={s === value} style={{ background: s }} onClick={() => onChange(s)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function usedColours(doc: DesignDoc): string[] {
  const set = new Set<string>([doc.background]);
  for (const l of doc.layers) {
    if (l.type === "text" || l.type === "effect") set.add(l.color);
    if (l.type === "shape") {
      if (l.fill) set.add(l.fill);
      if (l.stroke) set.add(l.stroke);
    }
  }
  return [...set].slice(0, 12);
}

function TextFields({ layer, onLayer, userFonts, textRef }: { layer: TextLayer; onLayer: Props["onLayer"]; userFonts: FontOption[]; textRef?: Props["textRef"] }) {
  const id = useId();
  const builtin = isBuiltinFont(layer.font) ? BUILTIN_FONTS[layer.font] : null;
  const weights = builtin ? (builtin.weights as readonly number[]) : [400, 700];
  const fonts: Array<{ value: string; label: string }> = [
    ...BUILTIN_FONT_IDS.map((f) => ({ value: f, label: BUILTIN_FONTS[f].label })),
    ...userFonts.map((f) => ({ value: f.id, label: `${f.label} (yours)` })),
  ];
  return (
    <>
      <div className="field">
        <label htmlFor={id}>Text</label>
        <textarea id={id} ref={textRef} className="textarea" value={layer.text} onChange={(e) => onLayer({ text: e.target.value }, `${layer.id}:text`)} />
      </div>
      <Select
        label="Font"
        value={layer.font as string}
        options={fonts}
        onChange={(v) => {
          const font = v as FontRef;
          const patch: Partial<TextLayer> = { font };
          if (isBuiltinFont(font)) {
            patch.weight = nearestWeight(font, layer.weight);
            if (!hasItalic(font, patch.weight)) patch.italic = false;
          }
          onLayer(patch, `${layer.id}:font`);
        }}
      />
      <div className="design-row">
        <NumberField label="Size" suffix="px" value={layer.size} min={4} max={1000} onChange={(v) => onLayer({ size: v }, `${layer.id}:size`)} />
        <Select label="Weight" value={String(layer.weight)} options={weights.map((w) => ({ value: String(w), label: String(w) }))} onChange={(v) => {
            const weight = Number(v);
            onLayer(isBuiltinFont(layer.font) && !hasItalic(layer.font, weight) ? { weight, italic: false } : { weight }, `${layer.id}:weight`);
          }} />
      </div>
      <div className="design-row">
        <NumberField label="Line height" value={layer.lineHeight} min={0.6} max={4} step={0.05} onChange={(v) => onLayer({ lineHeight: v }, `${layer.id}:lh`)} />
        <NumberField label="Letter spacing" suffix="em" value={layer.letterSpacing} min={-0.2} max={1} step={0.01} onChange={(v) => onLayer({ letterSpacing: v }, `${layer.id}:ls`)} />
      </div>
      <div className="design-row">
        <Select label="Align" value={layer.align} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]} onChange={(v) => onLayer({ align: v }, `${layer.id}:align`)} />
        <Select label="Vertical" value={layer.valign} options={[{ value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" }]} onChange={(v) => onLayer({ valign: v }, `${layer.id}:valign`)} />
      </div>
      {!isBuiltinFont(layer.font) || hasItalic(layer.font, layer.weight) ? (
        <label className="design-check">
          <input type="checkbox" checked={layer.italic} onChange={(e) => onLayer({ italic: e.target.checked }, `${layer.id}:italic`)} /> Italic
        </label>
      ) : null}
    </>
  );
}

export function Inspector({ doc, layer, onLayer, onDoc, userFonts, images, textRef, onNudge, onCutout, onInpaint }: Props) {
  const swatches = usedColours(doc);
  if (!layer) {
    const format = FORMATS.find((f) => f.width === doc.width && f.height === doc.height)?.id ?? "custom";
    return (
      <section className="design-panel" aria-labelledby="insp-doc">
        <h2 id="insp-doc" className="t-subhead">
          Design
        </h2>
        <div className="field">
          <label htmlFor="doc-name">Name</label>
          <input id="doc-name" className="input" value={doc.name} maxLength={120} onChange={(e) => e.target.value.trim() && onDoc({ name: e.target.value }, "doc:name")} />
        </div>
        <Select
          label="Format"
          value={format}
          options={[...FORMATS.map((f) => ({ value: f.id as string, label: `${f.label}, ${f.width}×${f.height}` })), { value: "custom", label: "Custom size" }]}
          onChange={(v) => {
            const f = FORMATS.find((x) => x.id === v);
            if (f) onDoc({ width: f.width, height: f.height }, "doc:format");
          }}
        />
        <div className="design-row">
          <NumberField label="Width" suffix="px" value={doc.width} min={64} max={6000} onChange={(v) => onDoc({ width: Math.round(v) }, "doc:w")} />
          <NumberField label="Height" suffix="px" value={doc.height} min={64} max={6000} onChange={(v) => onDoc({ height: Math.round(v) }, "doc:h")} />
        </div>
        <label className="t-meta palette-lock">
          <input type="checkbox" checked={doc.transparent} onChange={(e) => onDoc({ transparent: e.target.checked }, "doc:transparent")} />
          Transparent background (for frames, logos and overlays)
        </label>
        {doc.transparent ? (
          <p className="hint">The checkerboard marks transparent areas; PNG and SVG exports keep them transparent.</p>
        ) : (
          <ColourField label="Background" value={doc.background} swatches={swatches} onChange={(v) => v && onDoc({ background: v }, "doc:bg")} />
        )}
        <p className="hint">Changing the size keeps layers where they are; move them to fit the new frame.</p>
      </section>
    );
  }

  const kind = layerKind(layer);
  return (
    <section className="design-panel" aria-labelledby="insp-layer">
      <h2 id="insp-layer" className="t-subhead">
        {kind}: {layer.name}
      </h2>
      {layer.locked ? <p className="notice">This layer is locked. Unlock it in Layers to move it on the canvas.</p> : null}
      <div className="field">
        <label htmlFor="layer-name">Layer name</label>
        <input id="layer-name" className="input" value={layer.name} maxLength={80} onChange={(e) => e.target.value.trim() && onLayer({ name: e.target.value }, `${layer.id}:name`)} />
      </div>

      {layer.type === "text" ? <TextFields layer={layer} onLayer={onLayer} userFonts={userFonts} textRef={textRef} /> : null}
      {layer.type === "text" ? <ColourField label="Colour" value={layer.color} swatches={swatches} onChange={(v) => v && onLayer({ color: v }, `${layer.id}:color`)} /> : null}

      {layer.type === "shape" ? (
        <>
          {layer.shape === "path" ? null : (
            <Select label="Shape" value={layer.shape} options={[{ value: "rect", label: "Rectangle" }, { value: "ellipse", label: "Ellipse" }, { value: "line", label: "Rule" }]} onChange={(v) => onLayer({ shape: v }, `${layer.id}:shape`)} />
          )}
          <ColourField label="Fill" value={layer.fill} allowNone swatches={swatches} onChange={(v) => onLayer({ fill: v }, `${layer.id}:fill`)} />
          <ColourField label="Outline" value={layer.stroke} allowNone swatches={swatches} onChange={(v) => onLayer({ stroke: v, strokeWidth: v && !layer.strokeWidth ? 4 : layer.strokeWidth }, `${layer.id}:stroke`)} />
          <div className="design-row">
            <NumberField label="Outline width" suffix="px" value={layer.strokeWidth} min={0} max={500} onChange={(v) => onLayer({ strokeWidth: v }, `${layer.id}:sw`)} />
            {layer.shape === "rect" ? <NumberField label="Corner radius" suffix="px" value={layer.radius} min={0} max={6000} onChange={(v) => onLayer({ radius: v }, `${layer.id}:radius`)} /> : null}
          </div>
        </>
      ) : null}

      {layer.type === "effect" ? (
        <>
          <Select label="Effect" value={layer.effect} options={EFFECTS.map((e) => ({ value: e, label: EFFECT_LABEL[e] }))} onChange={(v) => onLayer({ effect: v }, `${layer.id}:fx`)} />
          <ColourField label="Light colour" value={layer.color} swatches={swatches} onChange={(v) => v && onLayer({ color: v }, `${layer.id}:color`)} />
          <div className="design-row">
            <NumberField label="Intensity" suffix="%" value={Math.round(layer.intensity * 100)} min={0} max={100} onChange={(v) => onLayer({ intensity: v / 100 }, `${layer.id}:k`)} />
            <NumberField label={SPREAD_LABEL[layer.effect]} suffix="%" value={Math.round(layer.spread * 100)} min={0} max={100} onChange={(v) => onLayer({ spread: v / 100 }, `${layer.id}:s`)} />
          </div>
          <div className="design-row">
            <NumberField label="Blur" suffix="px" value={layer.blur} min={0} max={400} onChange={(v) => onLayer({ blur: v }, `${layer.id}:blur`)} />
            {layer.effect === "trail" ? <NumberField label="Bend" suffix="%" value={Math.round(layer.curve * 100)} min={-100} max={100} onChange={(v) => onLayer({ curve: v / 100 }, `${layer.id}:curve`)} /> : null}
            {layer.effect === "sparkle" || layer.effect === "grain" ? <NumberField label="Pattern" value={layer.seed} min={0} max={999999} onChange={(v) => onLayer({ seed: Math.round(v) }, `${layer.id}:seed`)} /> : null}
          </div>
          <Select label="Blend" value={layer.blend} options={BLEND_MODES.map((b) => ({ value: b, label: BLEND_LABEL[b] }))} onChange={(v) => onLayer({ blend: v }, `${layer.id}:blend`)} />
          <p className="hint">Light is drawn on its own layer over the layers beneath; your pictures aren&apos;t changed.</p>
        </>
      ) : null}

      {layer.type === "image" ? (
        <>
          <Select
            label="Picture"
            value={layer.resourceId ?? ""}
            options={[
              { value: "", label: "Empty slot" },
              // A picture saved a moment ago may not be in the list yet; keep it selected meanwhile.
              ...(layer.resourceId && !images.some((i) => i.id === layer.resourceId) ? [{ value: layer.resourceId, label: "New picture (loading)" }] : []),
              ...images.map((i) => ({ value: i.id, label: i.label })),
            ]}
            onChange={(v) => onLayer({ resourceId: v || null }, `${layer.id}:res`)}
          />
          {!images.length ? <p className="hint">Add your own pictures under Add → Your images. Nothing is generated.</p> : null}
          <label className="t-meta palette-lock">
            <input
              type="checkbox"
              checked={layer.role === "logo"}
              onChange={(e) => onLayer(e.target.checked ? { role: "logo", fit: "contain" } : { role: undefined }, `${layer.id}:role`)}
            />
            This picture is the logo (campaign formats and frames keep it whole)
          </label>
          {layer.resourceId && (onCutout || onInpaint) ? (
            <div className="design-row" role="group" aria-label="Picture tools">
              {onCutout ? (
                <button type="button" className="btn btn-sm" onClick={onCutout}>
                  Remove background…
                </button>
              ) : null}
              {onInpaint ? (
                <button type="button" className="btn btn-sm" onClick={onInpaint}>
                  Fill an area…
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="design-row">
            <Select label="Fit" value={layer.fit} options={[{ value: "cover", label: "Fill the frame" }, { value: "contain", label: "Show all" }]} onChange={(v) => onLayer({ fit: v }, `${layer.id}:fit`)} />
            <NumberField label="Corner radius" suffix="px" value={layer.radius} min={0} max={6000} onChange={(v) => onLayer({ radius: v }, `${layer.id}:radius`)} />
          </div>
        </>
      ) : null}

      <h3 className="t-meta design-sub">Position</h3>
      <div className="design-row">
        <NumberField label="X" value={layer.x} onChange={(v) => onLayer({ x: v }, `${layer.id}:x`)} />
        <NumberField label="Y" value={layer.y} onChange={(v) => onLayer({ y: v }, `${layer.id}:y`)} />
      </div>
      <div className="design-row">
        <NumberField label="Width" value={layer.w} min={1} onChange={(v) => onLayer({ w: v }, `${layer.id}:w`)} />
        <NumberField label="Height" value={layer.h} min={1} onChange={(v) => onLayer({ h: v }, `${layer.id}:h`)} />
      </div>
      <div className="design-row">
        <NumberField label="Rotation" suffix="°" value={layer.rotation} min={-360} max={360} onChange={(v) => onLayer({ rotation: v }, `${layer.id}:rot`)} />
        <NumberField label="Opacity" suffix="%" value={Math.round(layer.opacity * 100)} min={0} max={100} onChange={(v) => onLayer({ opacity: v / 100 }, `${layer.id}:op`)} />
      </div>
      <div className="design-nudge" role="group" aria-label="Nudge the layer by 10 px">
        <button type="button" className="btn btn-sm" onClick={() => onNudge(-10, 0)} disabled={layer.locked}>
          Left
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onNudge(0, -10)} disabled={layer.locked}>
          Up
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onNudge(0, 10)} disabled={layer.locked}>
          Down
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onNudge(10, 0)} disabled={layer.locked}>
          Right
        </button>
      </div>
      <div className="design-row">
        <button type="button" className="btn btn-sm" onClick={() => onLayer({ x: Math.round((doc.width - layer.w) / 2) }, `${layer.id}:x`)} disabled={layer.locked}>
          Centre across
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onLayer({ y: Math.round((doc.height - layer.h) / 2) }, `${layer.id}:y`)} disabled={layer.locked}>
          Centre down
        </button>
      </div>
    </section>
  );
}
