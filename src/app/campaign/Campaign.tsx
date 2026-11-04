"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/Toast";
import { DesignPreview, useDesignFonts } from "@/components/design/DesignPreview";
import { useStore } from "@/hooks/useStore";
import { measureText } from "@/lib/design/browser";
import { CAMPAIGN_FORMATS, campaignVariants, printDpi, type Recomposed } from "@/lib/design/campaign";
import { newId } from "@/lib/store/db";
import { getDesign, listResources, saveDesign } from "@/lib/store/repo";
import type { DesignDoc } from "@/lib/design/schema";

const STRATEGY: Record<Recomposed["strategy"], string> = { anchor: "Same arrangement", split: "Pictures and type side by side", "split-mirrored": "Sides swapped" };

function Variants({ source, urls }: { source: DesignDoc; urls: Map<string, string> }) {
  const router = useRouter();
  const [formatId, setFormatId] = useState(CAMPAIGN_FORMATS[0]!.id);
  const format = CAMPAIGN_FORMATS.find((f) => f.id === formatId)!;
  // Same fonts as every variant; once loaded, notes about overflowing text use real metrics.
  const sources = useMemo(() => [source], [source]);
  const fontsVersion = useDesignFonts(sources);
  // Previews use stable ids; saving gives each a fresh one.
  const variants = useMemo(() => {
    let i = 0;
    return campaignVariants(source, format, () => `campaign-${format.id}-${fontsVersion}-${++i}`, source.updatedAt, measureText, 3);
  }, [source, format, fontsVersion]);
  const [busy, setBusy] = useState(false);

  const save = async (picked: Recomposed[], openFirst: boolean) => {
    setBusy(true);
    try {
      const saved: DesignDoc[] = [];
      for (const v of picked) saved.push(await saveDesign({ ...v.doc, id: newId("design") }));
      toast(saved.length === 1 ? `Saved ${saved[0]!.name}.` : `Saved ${saved.length} designs.`);
      if (openFirst) router.push(`/design?id=${encodeURIComponent(saved[0]!.id)}`);
      else setBusy(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "The design couldn't be saved.");
      setBusy(false);
    }
  };

  const dpi = printDpi(format);
  return (
    <>
      <nav className="modes campaign-formats" aria-label="Formats">
        {CAMPAIGN_FORMATS.map((f) => (
          <button key={f.id} type="button" aria-pressed={f.id === formatId} onClick={() => setFormatId(f.id)}>
            {f.label}
          </button>
        ))}
      </nav>
      <p className="t-meta">
        <span className="t-value">
          {format.width} × {format.height} px
        </span>
        {format.physical ? (
          <>
            {" "}
            for {format.physical.widthCm} × {format.physical.heightCm} cm, about <span className="t-value">{dpi} DPI</span> as a picture. Export SVG for print: type and shapes stay
            sharp at any size.
          </>
        ) : null}
        {format.circleSafe ? " The circle shows what a round profile picture keeps." : null}
      </p>
      <ul className="campaign-variants" data-testid="campaign-variants">
        {variants.map((v, i) => (
          <li key={v.doc.id} className="campaign-variant">
            <div className="campaign-preview" data-circle={format.circleSafe ? "" : undefined} style={{ ["--safe" as string]: format.circleSafe ?? 0 }}>
              <DesignPreview doc={v.doc} urls={urls} fontsVersion={fontsVersion} />
            </div>
            <h3 className="t-subhead">
              {i + 1}. {STRATEGY[v.strategy]}
            </h3>
            <p className="evidence" data-type="estimated">Recomposed by rule</p>
            <ul className="t-small compose-notes">
              {v.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save([v], true)}>
              Save and edit
            </button>
          </li>
        ))}
      </ul>
      {variants.length > 1 ? (
        <button type="button" className="btn" disabled={busy} onClick={() => void save(variants, false)}>
          Save all {variants.length} as designs
        </button>
      ) : null}
    </>
  );
}

export function Campaign() {
  const id = useSearchParams().get("id") ?? "";
  const data = useStore(async () => ({ doc: await getDesign(id), images: await listResources("image") }), ["designs", "resources"]);
  const urls = useMemo(() => new Map(data.status === "ready" ? data.data.images.map((r) => [r.id, URL.createObjectURL(r.blob)]) : []), [data]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <div className="page">
      <header className="folio">
        <h1 className="t-title">Campaign formats</h1>
        <p className="t-meta">Each format is a new design you can edit on its own; the original stays as it is.</p>
      </header>
      {data.status === "loading" ? <div className="busy-line" aria-label="Loading the design" /> : null}
      {data.status === "error" ? <p className="notice" data-tone="error">{data.message}</p> : null}
      {data.status === "ready" && !data.data.doc ? (
        <p className="notice">
          This design isn&apos;t in this browser. <Link className="link" href="/design">Back to designs</Link>
        </p>
      ) : null}
      {data.status === "ready" && data.data.doc ? (
        <section aria-label={`Formats for ${data.data.doc.name}`} className="campaign">
          <p className="t-meta">
            From <Link className="link" href={`/design?id=${encodeURIComponent(data.data.doc.id)}`}>{data.data.doc.name}</Link>, {data.data.doc.width} × {data.data.doc.height}. Words, fonts, colours,
            pictures and logo are kept; only placement and scale change.
          </p>
          <Variants source={data.data.doc} urls={urls} />
        </section>
      ) : null}
    </div>
  );
}
