"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { getBuiltinArt } from "@/lib/design/art";
import { cssFamily, loadDocFonts, measureText } from "@/lib/design/browser";
import { artUrl } from "@/lib/design/exporters";
import { renderSvg } from "@/lib/design/render";
import type { DesignDoc } from "@/lib/design/schema";

/** A small, static rendering of a document for cards. Placeholders show where the user's pictures go. */
export const DesignPreview = memo(function DesignPreview({ doc, urls, fontsVersion }: { doc: DesignDoc; urls?: Map<string, string>; fontsVersion?: number }) {
  const preview = useRef<HTMLSpanElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [loadedDoc, setLoadedDoc] = useState<DesignDoc | null>(null);
  useEffect(() => {
    const el = preview.current;
    if (!el || nearViewport || fontsVersion !== undefined) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        observer.disconnect();
        setNearViewport(true);
      }
    }, { rootMargin: "160px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [nearViewport, fontsVersion]);
  useEffect(() => {
    if (!nearViewport || fontsVersion !== undefined) return;
    let active = true;
    void loadDocFonts(doc).then(() => { if (active) setLoadedDoc(doc); });
    return () => { active = false; };
  }, [doc, nearViewport, fontsVersion]);
  const readyVersion = fontsVersion ?? (loadedDoc === doc ? 1 : 0);
  // Rendered only in the browser, once fonts have loaded, so line breaks use real metrics (and match hydration).
  const svg = useMemo(
    () =>
      readyVersion === 0
        ? ""
        : renderSvg(doc, { measure: measureText, fontFamily: cssFamily, image: (id) => urls?.get(id) ?? (getBuiltinArt(id) ? artUrl(getBuiltinArt(id)!) : null), placeholders: true, idPrefix: `pv-${doc.id}` }).replace(
        "<svg ",
        '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" ',
      ),
    [doc, urls, readyVersion],
  );
  return <span ref={preview} className={`design-card-preview${doc.transparent ? " checker" : ""}`} style={{ aspectRatio: `${doc.width} / ${doc.height}`, backgroundColor: doc.transparent ? undefined : doc.background }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
});

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

