"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog, useDraftGuard, withDraftGuard } from "@/components/ConfirmDialog";
import { Thumb } from "@/components/Thumb";
import { textToTokens } from "@/lib/store/validation";
import { toast } from "@/components/Toast";
import { useStore } from "@/hooks/useStore";
import { hexToRgb, rgbToHex } from "@/lib/color/convert";
import { newId } from "@/lib/store/db";
import { download, fileSlug, styleToCss, styleToJson } from "@/lib/review/report";
import { deleteStyle, listAssets, listReferences, listStyles, saveStyle } from "@/lib/store/repo";
import type { Asset, InspirationRef, StyleSystem, StyleToken } from "@/lib/store/models";

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const tokensToText = (t: StyleToken[]) => t.map((x) => `${x.name}: ${x.value}`).join("\n");

function parseTokens(label: string, text: string): StyleToken[] {
  try {
    return textToTokens(text);
  } catch (error) {
    throw new Error(`${label}, ${(error as Error).message}`);
  }
}

function blank(): StyleSystem {
  const now = Date.now();
  return {
    id: newId("sty"),
    name: "Untitled style",
    palette: [
      { name: "Paper", hex: "#F6F4EF", origin: "manual" },
      { name: "Ink", hex: "#202323", origin: "manual" },
    ],
    typography: { display: "", body: "", mono: "", notes: "" },
    layoutPrinciples: [],
    spacing: [],
    radius: [],
    motion: [],
    referenceIds: [],
    sourceAssetId: null,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function Editor({ style, refs, assets }: { style: StyleSystem; refs: InspirationRef[]; assets: Asset[] }) {
  const router = useRouter();
  const [s, setS] = useState(style);
  const [layout, setLayout] = useState(style.layoutPrinciples.join("\n"));
  const [spacing, setSpacing] = useState(tokensToText(style.spacing));
  const [radius, setRadius] = useState(tokensToText(style.radius));
  const [motion, setMotion] = useState(style.motion.join("\n"));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useDraftGuard(dirty);
  const touch = () => setDirty(true);

  const compose = (): StyleSystem => ({
    ...s,
    layoutPrinciples: lines(layout),
    spacing: parseTokens("Spacing tokens", spacing),
    radius: parseTokens("Radius tokens", radius),
    motion: lines(motion),
  });

  const save = async () => {
    const bad = s.palette.find((c) => !hexToRgb(c.hex));
    if (bad) return setError(`"${bad.hex}" isn't a hex colour. Use a value like #C65A42.`);
    setError(null);
    try {
      const saved = await saveStyle({ ...compose(), palette: s.palette.map((c) => ({ ...c, hex: rgbToHex(hexToRgb(c.hex)!) })) });
      setS(saved);
      setDirty(false);
      toast("Style saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The style couldn’t be saved.");
    }
  };

  const setColor = (i: number, patch: Partial<StyleSystem["palette"][number]>) => {
    touch();
    setS((x) => ({
      ...x,
      palette: x.palette.map((c, j) => (j === i ? { ...c, ...patch, ...(patch.hex ? { origin: "manual" as const, share: undefined } : {}) } : c)),
    }));
  };

  return (
    <div style={{ display: "grid", gap: "2rem" }}>
      {guard.dialog}
      <div className="field" style={{ maxWidth: "32rem" }}>
        <label htmlFor="s-name">Name</label>
        <input id="s-name" className="input" value={s.name} onChange={(e) => (touch(), setS({ ...s, name: e.target.value.slice(0, 120) }))} />
      </div>

      <section aria-labelledby="pal-h">
        <h2 id="pal-h" className="t-heading">
          Palette
        </h2>
        <p className="t-small" style={{ margin: "0.25rem 0 0.75rem" }}>
          Colours marked measured came from an image&apos;s pixels. Editing a colour makes it manual.
        </p>
        <table className="ptable" style={{ maxWidth: "40rem" }}>
          <thead>
            <tr>
              <th scope="col">Colour</th>
              <th scope="col">Name</th>
              <th scope="col">Hex</th>
              <th scope="col">Origin</th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {s.palette.map((c, i) => (
              <tr key={i}>
                <td>
                  <span className="chip" style={{ background: hexToRgb(c.hex) ? c.hex : "transparent" }} aria-hidden="true" />
                </td>
                <td>
                  <input
                    className="input"
                    aria-label={`Name of colour ${i + 1}`}
                    value={c.name}
                    onChange={(e) => setColor(i, { name: e.target.value.slice(0, 40) })}
                    style={{ padding: "0.3rem 0.5rem" }}
                  />
                </td>
                <td>
                  <input
                    className="input t-value"
                    aria-label={`Hex of colour ${i + 1}`}
                    value={c.hex}
                    onChange={(e) => setColor(i, { hex: e.target.value.slice(0, 7) })}
                    style={{ padding: "0.3rem 0.5rem", width: "7rem" }}
                  />
                </td>
                <td className="t-meta">
                  {c.origin === "measured"
                    ? `Measured${c.share != null ? `, ${c.share < 0.01 ? "under 1" : (c.share * 100).toFixed(0)}% of pixels` : ""}`
                    : "Manual"}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    aria-label={`Remove ${c.name}`}
                    onClick={() => (touch(), setS({ ...s, palette: s.palette.filter((_, j) => j !== i) }))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn btn-sm"
          style={{ marginTop: "0.75rem" }}
          onClick={() => (touch(), setS({ ...s, palette: [...s.palette, { name: `Colour ${s.palette.length + 1}`, hex: "#777972", origin: "manual" }] }))}
          disabled={s.palette.length >= 16}
        >
          Add colour
        </button>
      </section>

      <section aria-labelledby="type-h" style={{ display: "grid", gap: "0.9rem", maxWidth: "40rem" }}>
        <h2 id="type-h" className="t-heading">
          Typography
        </h2>
        <p className="t-small">Typefaces can&apos;t be identified reliably from a screenshot, so these are yours to set.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))", gap: "0.9rem" }}>
          {(["display", "body", "mono"] as const).map((k) => (
            <div className="field" key={k}>
              <label htmlFor={`t-${k}`}>{k === "display" ? "Display" : k === "body" ? "Body" : "Monospace"}</label>
              <input
                id={`t-${k}`}
                className="input"
                value={s.typography[k]}
                onChange={(e) => (touch(), setS({ ...s, typography: { ...s.typography, [k]: e.target.value.slice(0, 80) } }))}
              />
            </div>
          ))}
        </div>
        <div className="field">
          <label htmlFor="t-notes">Type notes</label>
          <textarea
            id="t-notes"
            className="textarea"
            value={s.typography.notes}
            onChange={(e) => (touch(), setS({ ...s, typography: { ...s.typography, notes: e.target.value.slice(0, 1000) } }))}
          />
        </div>
      </section>

      <section aria-labelledby="sys-h" style={{ display: "grid", gap: "0.9rem" }}>
        <h2 id="sys-h" className="t-heading">
          Layout, spacing and motion
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))", gap: "1rem" }}>
          <div className="field">
            <label htmlFor="s-layout">Layout principles</label>
            <textarea
              id="s-layout"
              className="textarea"
              value={layout}
              onChange={(e) => (touch(), setLayout(e.target.value))}
              placeholder={"One per line\nTitle sits in the top third\nOne accent block, never two"}
            />
          </div>
          <div className="field">
            <label htmlFor="s-motion">Motion</label>
            <textarea
              id="s-motion"
              className="textarea"
              value={motion}
              onChange={(e) => (touch(), setMotion(e.target.value))}
              placeholder={"One per line\n160 ms ease-out for state changes"}
            />
          </div>
          <div className="field">
            <label htmlFor="s-spacing">Spacing tokens</label>
            <textarea
              id="s-spacing"
              className="textarea t-value"
              value={spacing}
              onChange={(e) => (touch(), setSpacing(e.target.value))}
              placeholder={"name: value, one per line\nsm: 8px\nmd: 16px"}
            />
          </div>
          <div className="field">
            <label htmlFor="s-radius">Radius tokens</label>
            <textarea
              id="s-radius"
              className="textarea t-value"
              value={radius}
              onChange={(e) => (touch(), setRadius(e.target.value))}
              placeholder={"name: value, one per line\ncontrol: 2px"}
            />
          </div>
        </div>
        <p className="t-small">Token values accept letters, numbers, %, dots, brackets and dashes; correct invalid lines before saving.</p>
      </section>

      {s.sourceAssetId ? <ReferenceAsset asset={assets.find((a) => a.id === s.sourceAssetId)} /> : null}
      <section aria-labelledby="refs-h" style={{ display: "grid", gap: "0.6rem" }}>
        <h2 id="refs-h" className="t-heading">
          References
        </h2>
        {refs.length === 0 ? (
          <p className="t-meta">
            Add references in the{" "}
            <Link className="link" href="/library">
              library
            </Link>{" "}
            to link them here.
          </p>
        ) : (
          <ul
            style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.35rem", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))" }}
          >
            {refs.map((r) => (
              <li key={r.id}>
                {s.referenceIds.includes(r.id) ? (
                  r.assetId ? (
                    <ReferenceAsset asset={assets.find((a) => a.id === r.assetId)} />
                  ) : /^https?:\/\//i.test(r.url) ? (
                    <a className="link" href={r.url} target="_blank" rel="noopener noreferrer">
                      Open {r.title}
                    </a>
                  ) : null
                ) : null}
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                  <input
                    type="checkbox"
                    checked={s.referenceIds.includes(r.id)}
                    onChange={(e) => (
                      touch(),
                      setS({ ...s, referenceIds: e.target.checked ? [...s.referenceIds, r.id] : s.referenceIds.filter((x) => x !== r.id) })
                    )}
                  />
                  <span>{r.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="field" style={{ maxWidth: "40rem" }}>
        <label htmlFor="s-notes">Design notes</label>
        <textarea id="s-notes" className="textarea" value={s.notes} onChange={(e) => (touch(), setS({ ...s, notes: e.target.value.slice(0, 3000) }))} />
      </div>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--color-ink)", paddingTop: "1rem" }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty}>
          Save style
        </button>
        <span className="t-small" aria-live="polite">
          {dirty ? "Unsaved changes" : "Saved"}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            try {
              download(`${fileSlug(s.name)}.tokens.json`, styleToJson(compose()), "application/json");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Export JSON
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            try {
              download(`${fileSlug(s.name)}.css`, styleToCss(compose()), "text/css");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Export CSS variables
        </button>
        <ConfirmDialog
          trigger={
            <button type="button" className="btn btn-sm btn-danger">
              Delete
            </button>
          }
          title="Delete this style?"
          body="It's removed from this browser. Exported files are not affected."
          confirm="Delete style"
          onConfirm={async () => {
            await deleteStyle(s.id);
            toast("Style deleted");
            setDirty(false);
            router.push("/styles");
          }}
        />
      </div>
    </div>
  );
}

export function Styles() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [error, setError] = useState<string | null>(null);
  const data = useStore(
    async () => ({ styles: await listStyles(), refs: await listReferences(), assets: await listAssets() }),
    ["styles", "references", "assets"],
  );
  const styles = data.status === "ready" ? data.data.styles : [];
  const selected = styles.find((s) => s.id === id) ?? null;

  return (
    <div className="page">
      <div className="folio">
        <h1 className="t-display">Styles</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            withDraftGuard(() => {
              void (async () => {
                try {
                  const s = await saveStyle(blank());
                  router.push(`/styles?id=${s.id}`);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "The style couldn’t be saved.");
                }
              })();
            })
          }
        >
          New style
        </button>
      </div>
      {error || data.status === "error" ? (
        <p role="alert" className="error-text">
          {error ?? (data.status === "error" ? data.message : "")}
        </p>
      ) : null}
      <div className="spread" style={{ gridTemplateColumns: "minmax(0,1fr) 18rem" }}>
        <div style={{ minWidth: 0 }}>
          {selected && data.status === "ready" ? (
            <Editor key={selected.id} style={selected} refs={data.data.refs} assets={data.data.assets} />
          ) : data.status === "ready" ? (
            <div style={{ display: "grid", gap: "1rem", maxWidth: "40rem" }}>
              <p className="prose-serif">A style records the decisions behind a look — palette, type, spacing, motion — so the next piece starts from them.</p>
              <p className="t-meta">
                Start from a measured palette in the{" "}
                <Link className="link" href="/analyze">
                  analyzer
                </Link>
                , or create a blank style and fill it in.
              </p>
              {id ? <p className="notice">That style isn&apos;t in this browser.</p> : null}
            </div>
          ) : (
            <p className="t-meta">Opening styles…</p>
          )}
        </div>
        <aside className="margin" aria-label="Saved styles">
          <h2 className="t-subhead">Saved styles</h2>
          {styles.length === 0 ? (
            <p className="t-meta" style={{ marginTop: "0.4rem" }}>
              None yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "0.6rem 0 0", display: "grid", gap: "0.9rem" }}>
              {styles.map((s) => (
                <li key={s.id}>
                  <Link
                    className="link"
                    href={`/styles?id=${s.id}`}
                    aria-current={s.id === id ? "page" : undefined}
                    style={s.id === id ? { fontWeight: 600 } : undefined}
                  >
                    {s.name}
                  </Link>
                  <div className="palette-strip" style={{ height: "0.6rem", marginTop: "0.3rem" }} aria-hidden="true">
                    {s.palette.map((c, i) => (
                      <span key={i} style={{ flex: 1, background: c.hex }} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function ReferenceAsset({ asset }: { asset?: Asset }) {
  return asset ? (
    <Link className="link" href={`/analyze?asset=${asset.id}`} style={{ display: "grid", gap: "0.5rem" }}>
      <Thumb blob={asset.thumb} alt={asset.name} style={{ maxWidth: "12rem", maxHeight: "10rem", objectFit: "contain" }} />
      Open {asset.name}
    </Link>
  ) : (
    <p className="t-small">The linked image is unavailable in this browser.</p>
  );
}
