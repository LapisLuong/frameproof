import type { Metadata } from "next";
import { Suspense } from "react";
import { Analyzer } from "./Analyzer";

export const metadata: Metadata = { title: "Analyzer" };

export default function AnalyzePage() {
  return (
    <Suspense>
      <Analyzer />
    </Suspense>
  );
}
