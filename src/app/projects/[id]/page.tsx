import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectWorkspace } from "./ProjectWorkspace";

export const metadata: Metadata = { title: "Review" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ProjectWorkspace id={id} />
    </Suspense>
  );
}
