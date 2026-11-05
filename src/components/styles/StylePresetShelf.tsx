"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { withDraftGuard } from "@/components/ConfirmDialog";
import { BUILTIN_FONTS } from "@/lib/design/fonts";
import { newId } from "@/lib/store/db";
import { saveStyle } from "@/lib/store/repo";
import { STYLE_PRESETS, styleFromPreset } from "@/lib/styles/presets";

export function StylePresetShelf() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <section aria-labelledby="ready-styles" style={{ marginBottom: "2rem" }}>
      <h2 id="ready-styles" className="t-heading">Ready art styles</h2>
      <p className="t-meta" style={{ margin: "0.5rem 0 1rem", maxWidth: "55rem" }}>Eight original starting points for posters and covers. Save a style to edit its palette, font pairing and layout principles. All font families are already included; reference links are for inspiration.</p>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,16rem),1fr))", gap: "1.5rem" }}>
        {STYLE_PRESETS.map((preset) => (
          <article key={preset.id} style={{ minWidth: 0, borderBottom: "1px solid var(--color-rule)", paddingBottom: "1rem" }}>
            <div style={{ background: preset.colours[0], color: preset.colours[1], minHeight: "13rem", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "1.25rem", overflow: "hidden" }}>
              <span style={{ fontSize: "0.8rem", fontFamily: `var(${BUILTIN_FONTS[preset.body].cssVar})` }}>{preset.category}</span>
              <span style={{ fontFamily: `var(${BUILTIN_FONTS[preset.display].cssVar})`, fontSize: "clamp(2rem,3vw,3rem)", lineHeight: 1.05, overflowWrap: "anywhere" }}>{preset.specimen}</span>
              <span style={{ display: "flex", gap: "0.3rem", marginTop: "1rem" }} aria-hidden="true">{preset.colours.map((hex) => <span key={hex} style={{ width: "1.5rem", height: "0.3rem", background: hex, border: "1px solid currentColor" }} />)}</span>
            </div>
            <h3 className="t-subhead" style={{ marginTop: "0.7rem" }}>{preset.name}</h3>
            <p className="t-small" style={{ margin: "0.4rem 0" }}>{preset.description}</p>
            <p className="t-meta">{BUILTIN_FONTS[preset.display].label} + {BUILTIN_FONTS[preset.body].label}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", margin: "0.6rem 0" }} aria-label={`${preset.name} palette`}>{preset.colours.map((hex) => <span key={hex} className="t-small"><span aria-hidden="true" style={{ display: "inline-block", width: "0.8rem", height: "0.8rem", background: hex, border: "1px solid #777", marginRight: "0.2rem" }} />{hex}</span>)}</div>
            <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => withDraftGuard(() => { void (async () => { setBusy(preset.id); setError(null); try { const saved = await saveStyle(styleFromPreset(preset, newId("sty"))); router.push(`/styles?id=${saved.id}`); } catch (e) { setError(e instanceof Error ? e.message : "The style couldn't be saved."); } finally { setBusy(null); } })(); })}>{busy === preset.id ? "Saving…" : `Use ${preset.name}`}</button>
              <a className="link t-small" href={preset.source} target="_blank" rel="noopener noreferrer">Inspiration source</a>
              <Link className="link t-small" href={`/compose?stylePreset=${preset.id}`}>Create a concept using this style</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
