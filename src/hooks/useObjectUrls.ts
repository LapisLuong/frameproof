"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; blob: Blob; kind?: string };
const EMPTY = new Map<string, string>();

/** Acquire external URLs in an effect, never during render (Strict Mode may abandon a render). */
export function useObjectUrls(items?: readonly Entry[]): Map<string, string> {
  const [current, setCurrent] = useState<{ items: readonly Entry[]; urls: Map<string, string> } | null>(null);
  useEffect(() => {
    if (!items) return;
    const urls = new Map<string, string>();
    for (const item of items) {
      if (!item.kind || item.kind === "image") urls.set(item.id, URL.createObjectURL(item.blob));
    }
    // Object URLs are external resources; state exposes them after acquisition and cleanup owns each one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent({ items, urls });
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [items]);
  return items && current?.items === items ? current.urls : EMPTY;
}
