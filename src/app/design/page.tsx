import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignFromQuery } from "./DesignFromQuery";

export const metadata: Metadata = { title: "Design" };

/** /design lists designs; /design?id=… opens one in the editor (query, not path, so the app can export statically). */
export default function DesignPage() {
  return (
    <Suspense>
      <DesignFromQuery />
    </Suspense>
  );
}
