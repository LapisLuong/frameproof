"use client";

import { useEffect, useMemo, useState } from "react";
import { getBuiltinArt } from "@/lib/design/art";
import { cssFamily, loadDocFonts, measureText } from "@/lib/design/browser";
import { artUrl } from "@/lib/design/exporters";
import { renderSvg } from "@/lib/design/render";
import type { DesignDoc } from "@/lib/design/schema";

/** A small, static rendering of a document for cards. Placeholders show where the user's pictures go. */
export function DesignPreview({ doc, urls, fontsVersion }: { doc: DesignDoc; urls?: Map<string, string>; fontsVersion: number }) {
  // Rendered only in the browser, once fonts have loaded, so line breaks use real metrics (and match hydration).
  const svg = useMemo(
    () =>
      fontsVersion === 0
        ? ""
        : renderSvg(doc, { measure: measureText, fontFamily: cssFamily, image: (id) => urls?.get(id) ?? (getBuiltinArt(id) ? artUrl(getBuiltinArt(id)!) : null), placeholders: true, idPrefix: `pv-${doc.id}` }).replace(
        "<svg ",
        '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" ',
      ),
    [doc, urls, fontsVersion],
  );
  return <span className={`design-card-preview${doc.transparent ? " checker" : ""}`} style={{ aspectRatio: `${doc.width} / ${doc.height}` }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function useDesignFonts(docs: DesignDoc[]): number {
  const [v, setV] = useState(0);
  const key = docs.map((d) => d.id + d.updatedAt).join(",");
  useEffect(() => {
    let live = true;
    Promise.all(docs.map((d) => loadDocFonts(d))).then(() => live && setV((x) => x + 1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return v;
}

