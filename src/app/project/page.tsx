import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectFromQuery } from "./ProjectFromQuery";

export const metadata: Metadata = { title: "Review" };

/** /project?id=… — a query parameter rather than a path segment so the app can also be exported as static files. */
export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectFromQuery />
    </Suspense>
  );
}
