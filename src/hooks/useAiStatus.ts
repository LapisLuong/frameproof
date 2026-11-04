"use client";

import { useEffect, useState } from "react";

export type AiAvailability =
  | { state: "loading" }
  | { state: "on"; provider: string; model: string }
  | { state: "off"; reason: string };

let cache: Promise<AiAvailability> | null = null;

function load(): Promise<AiAvailability> {
  cache ??= fetch("/api/review", { cache: "no-store" })
    .then((r) => r.json())
    .then((d: { configured: boolean; provider?: string; model?: string; reason?: string }) =>
      d.configured ? { state: "on" as const, provider: d.provider ?? "", model: d.model ?? "" } : { state: "off" as const, reason: d.reason ?? "AI review is off." },
    )
    .catch(() => ({ state: "off" as const, reason: "Couldn't check the AI configuration." }));
  return cache;
}

export function useAiStatus(): AiAvailability {
  const [s, setS] = useState<AiAvailability>({ state: "loading" });
  useEffect(() => {
    let live = true;
    load().then((v) => live && setS(v));
    return () => {
      live = false;
    };
  }, []);
  return s;
}
