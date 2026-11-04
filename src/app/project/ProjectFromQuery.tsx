"use client";

import { useSearchParams } from "next/navigation";
import { ProjectWorkspace } from "./ProjectWorkspace";

export function ProjectFromQuery() {
  const id = useSearchParams().get("id") ?? "";
  return <ProjectWorkspace key={id} id={id} />;
}
