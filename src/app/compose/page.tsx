import type { Metadata } from "next";
import { Suspense } from "react";
import { Composer } from "./Composer";

export const metadata: Metadata = { title: "Compose" };

export default function ComposePage() {
  return <Suspense fallback={<p className="page t-meta">Opening the composer…</p>}><Composer /></Suspense>;
}
