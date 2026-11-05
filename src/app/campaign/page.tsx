import type { Metadata } from "next";
import { Suspense } from "react";
import { Campaign } from "./Campaign";

export const metadata: Metadata = { title: "Campaign formats" };

/** /campaign?id=… recomposes one design for other formats (query, not path, so the app can export statically). */
export default function CampaignPage() {
  return (
    <Suspense>
      <Campaign />
    </Suspense>
  );
}
