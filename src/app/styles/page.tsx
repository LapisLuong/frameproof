import type { Metadata } from "next";
import { Suspense } from "react";
import { Styles } from "./Styles";

export const metadata: Metadata = { title: "Styles" };

export default function StylesPage() {
  return (
    <Suspense>
      <Styles />
    </Suspense>
  );
}
