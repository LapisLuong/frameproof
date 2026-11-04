"use client";

import { useEffect, useState } from "react";
import { STATIC_EXPORT, withBase } from "@/lib/base-path";

export type AiAvailability = { state: "loading" } | { state: "on"; provider: string; model: string } | { state: "off"; reason: string };

let cache: Promise<AiAvailability> | null = null;

function load(): Promise<AiAvailability> {
  if (STATIC_EXPORT)
    return Promise.resolve({
      state: "off" as const,
      reason: "This hosted demo has no server, so AI review is off. Run FrameProof on your own machine with an API key to use it.",
    });
  cache ??= fetch(withBase("/api/review"), { cache: "no-store" })
    .then((r) => r.json())
    .then((d: { configured: boolean; provider?: string; model?: string; reason?: string }) =>
      d.configured
        ? { state: "on" as const, provider: d.provider ?? "", model: d.model ?? "" }
        : { state: "off" as const, reason: d.reason ?? "AI review is off." },
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
