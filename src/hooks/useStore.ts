"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribe } from "@/lib/store/repo";
import type { StoreName } from "@/lib/store/db";

export type Loadable<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

/** Load data from IndexedDB and reload whenever one of the given stores changes. */
export function useStore<T>(loader: () => Promise<T>, stores: StoreName[], deps: unknown[] = []): Loadable<T> & { reload: () => void } {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" });
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const storesKey = stores.join(",");

  const reload = useCallback(() => {
    loaderRef
      .current()
      .then((data) => setState({ status: "ready", data }))
      .catch((e: unknown) => setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't read saved work." }));
  }, []);

  useEffect(() => {
    reload();
    const watched = new Set(storesKey.split(","));
    return subscribe((s) => {
      if (watched.has(s)) reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, storesKey, ...deps]);

  return { ...state, reload };
}

/** Object URL for a Blob, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    // An object URL is an external resource: create it in an effect so it can be revoked on cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return blob && entry?.blob === blob ? entry.url : null;
}
