"use client";

import { useSearchParams } from "next/navigation";
import { DesignEditor } from "./Editor";
import { DesignIndex } from "./DesignIndex";

/** `at=x,y` (0–1 across and down) selects the layer under that point, for links from a review's proof marks. */
function parseAt(v: string | null): { x: number; y: number } | null {
  const m = v ? /^(0(?:\.\d+)?|1(?:\.0+)?),(0(?:\.\d+)?|1(?:\.0+)?)$/.exec(v) : null;
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

export function DesignFromQuery() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) return <DesignIndex />;
  return <DesignEditor key={id} id={id} at={parseAt(params.get("at"))} />;
}
