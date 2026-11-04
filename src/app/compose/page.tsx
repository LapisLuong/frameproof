import type { Metadata } from "next";
import { Composer } from "./Composer";

export const metadata: Metadata = { title: "Compose" };

export default function ComposePage() {
  return <Composer />;
}
