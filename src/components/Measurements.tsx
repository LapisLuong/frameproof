"use client";

import { useMemo, useState } from "react";
import type { ImageAnalysis, StoredComparison } from "@/lib/analysis/analyze";
import { formatRatio, gradeContrast } from "@/lib/color/contrast";
import { hexToRgb } from "@/lib/color/convert";
import { EvidenceLabel } from "./ProofNotes";

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const kb = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function PaletteList({ analysis, title = "Palette" }: { analysis: ImageAnalysis; title?: string }) {
  const sw = analysis.palette.swatches;
  return (
    <section aria-label={title}>
      <div className="palette-strip" aria-hidden="true">
        {sw.map((s) => (
          <span key={s.hex} style={{ width: `${s.share * 100}%`, background: s.hex }} />
        ))}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}>
        {sw.map((s) => (
          <li key={s.hex} className="swatch-row">
            <span className="chip" style={{ background: s.hex }} aria-hidden="true" />
            <span className="t-value">{s.hex}</span>
            <span className="share-bar" aria-hidden="true">
              <span style={{ width: `${s.share * 100}%` }} />
            </span>
            <span className="t-value" style={{ textAlign: "right" }}>
              {s.share < 0.01 ? "<1%" : pct(s.share)}
            </span>
          </li>
        ))}
      </ul>
      <p className="t-small" style={{ marginTop: "0.5rem" }}>
        Share of opaque pixels. {analysis.palette.method}.
        {analysis.palette.transparentShare > 0.001 ? ` ${pct(analysis.palette.transparentShare, 1)} of the image is transparent and was left out.` : ""} Small
        accents can be missed — this is a frequency summary, not the designer&apos;s palette.
      </p>
    </section>
  );
}

export function ContrastPicker({ analysis }: { analysis: ImageAnalysis }) {
  const sw = analysis.palette.swatches;
  const [a, setA] = useState(sw[sw.length > 1 ? 1 : 0]?.hex ?? "#000000");
  const [b, setB] = useState(sw[0]?.hex ?? "#FFFFFF");
  const g = useMemo(() => {
    const ra = hexToRgb(a);
    const rb = hexToRgb(b);
    return ra && rb ? gradeContrast(ra, rb) : null;
  }, [a, b]);
  const opts = sw.map((s) => s.hex);
  const pass = (ok: boolean) => (ok ? "Pass" : "Fail");
  return (
    <section aria-labelledby="contrast-h">
      <h3 id="contrast-h" className="t-subhead">
        Contrast between two colours
      </h3>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <label className="field" style={{ minWidth: "9rem" }}>
          <span className="label">Text colour</span>
          <select className="select" value={a} onChange={(e) => setA(e.target.value)} data-testid="contrast-a">
            {opts.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ minWidth: "9rem" }}>
          <span className="label">Background</span>
          <select className="select" value={b} onChange={(e) => setB(e.target.value)} data-testid="contrast-b">
            {opts.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
      </div>
      {g ? (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1rem", alignItems: "center", marginTop: "1rem" }}>
          <div
            style={{
              background: b,
              color: a,
              padding: "0.6rem 0.9rem",
              border: "1px solid var(--color-rule)",
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-lg)",
            }}
            aria-hidden="true"
          >
            Aa
          </div>
          <div>
            <p className="t-value" style={{ fontSize: "var(--text-md)" }} data-testid="contrast-ratio">
              {formatRatio(g.ratio)}
            </p>
            <p className="t-meta">
              Body text AA {pass(g.aaNormal)}, AAA {pass(g.aaaNormal)}. Large text AA {pass(g.aaLarge)}. Interface shapes {pass(g.nonText)}.
            </p>
          </div>
        </div>
      ) : null}
      <p className="t-small" style={{ marginTop: "0.5rem" }}>
        WCAG 2.x ratio for this colour pair. It can&apos;t tell whether these colours actually sit on top of each other in the design.
      </p>
    </section>
  );
}

type Row = { label: string; ref?: string; cur?: string; single?: string; ev: "measured" | "estimated" };

export function MeasurementTable({ reference, current, comparison }: { reference: ImageAnalysis; current?: ImageAnalysis; comparison?: StoredComparison }) {
  const rows: Row[] = [];
  const two = !!current;
  const add = (label: string, f: (a: ImageAnalysis) => string, ev: Row["ev"] = "measured") =>
    rows.push(two ? { label, ref: f(reference), cur: f(current!), ev } : { label, single: f(reference), ev });
  add("Size", (a) => `${a.width}×${a.height} px`);
  add("Aspect ratio", (a) => a.aspect.label);
  add("File size", (a) => `${kb(a.bytes)} ${a.kind.toUpperCase()}`);
  add("Mean lightness", (a) => a.structure.meanLuma.toFixed(3));
  add("RMS contrast", (a) => a.structure.lumaStdDev.toFixed(3));
  add("Edge density", (a) => pct(a.structure.edgeDensity, 1));
  add("Detail centre", (a) => `${pct(a.structure.detailCentroid.x)}, ${pct(a.structure.detailCentroid.y)}`);
  add("Quiet area", (a) => pct(a.structure.quietShare), "estimated");

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ptable">
        <caption>Measurements</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            {two ? (
              <>
                <th scope="col">Reference</th>
                <th scope="col">Current</th>
              </>
            ) : (
              <th scope="col">Value</th>
            )}
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" style={{ fontWeight: 500 }}>
                {r.label}
              </th>
              {two ? (
                <>
                  <td className="num">{r.ref}</td>
                  <td className="num">{r.cur}</td>
                </>
              ) : (
                <td className="num">{r.single}</td>
              )}
              <td>
                <EvidenceLabel type={r.ev} />
              </td>
            </tr>
          ))}
          {comparison ? (
            <>
              <tr>
                <th scope="row" style={{ fontWeight: 500 }}>
                  Structural similarity (SSIM)
                </th>
                <td className="num" colSpan={2}>
                  {comparison.ssim.toFixed(3)}
                </td>
                <td>
                  <EvidenceLabel type="measured" />
                </td>
              </tr>
              <tr>
                <th scope="row" style={{ fontWeight: 500 }}>
                  Layout hash distance
                </th>
                <td className="num" colSpan={2}>
                  {comparison.dHashDistance} of 64 bits
                </td>
                <td>
                  <EvidenceLabel type="measured" />
                </td>
              </tr>
              <tr>
                <th scope="row" style={{ fontWeight: 500 }}>
                  Colour distribution overlap
                </th>
                <td className="num" colSpan={2}>
                  {pct(comparison.histogramIntersection)}
                </td>
                <td>
                  <EvidenceLabel type="measured" />
                </td>
              </tr>
              <tr>
                <th scope="row" style={{ fontWeight: 500 }}>
                  Area that changed
                </th>
                <td className="num" colSpan={2}>
                  {pct(comparison.changedShare, 1)}
                </td>
                <td>
                  <EvidenceLabel type="measured" />
                </td>
              </tr>
            </>
          ) : null}
        </tbody>
      </table>
      <details className="disclose" style={{ marginTop: "0.75rem" }}>
        <summary>How these are measured, and what they can&apos;t tell you</summary>
        <ul className="t-meta t-measure" style={{ paddingLeft: "1.1rem", marginTop: "0.5rem", display: "grid", gap: "0.35rem" }}>
          <li>
            Measures run on a copy at most{" "}
            {reference.analysisSize.width >= reference.analysisSize.height ? reference.analysisSize.width : reference.analysisSize.height} px on its long side.
            Size and aspect come from the original file.
          </li>
          <li>RMS contrast is the spread of lightness values. Higher means stronger lights and darks; it says nothing about which element is emphasised.</li>
          <li>Edge density is the share of pixels on a hard edge (Sobel, threshold 0.25). It approximates visual busyness, not clutter or legibility.</li>
          <li>Detail centre is where hard edges concentrate. It points to where detail sits, not to what matters.</li>
          <li>Quiet area counts flat cells on a 16×16 grid. It is estimated because it can&apos;t tell intended negative space from an unfinished area.</li>
          {comparison ? (
            <>
              <li>{comparison.canvas.note} SSIM is sensitive to small shifts: a 2% move can drop it sharply. It is not a quality score.</li>
              <li>
                The layout hash compares coarse light-dark structure and ignores colour. 0 means the same arrangement; above about 20 means a different one.
              </li>
              <li>Colour distribution overlap ignores where colours are placed.</li>
            </>
          ) : null}
          <li>Not measurable from pixels: font family or size, spacing in CSS units, reading order, semantic hierarchy, brand compliance, or quality.</li>
        </ul>
      </details>
    </div>
  );
}
