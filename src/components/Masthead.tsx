"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAiStatus } from "@/hooks/useAiStatus";

const NAV = [
  { href: "/", label: "Desk" },
  { href: "/design", label: "Design" },
  { href: "/analyze", label: "Analyzer" },
  { href: "/library", label: "Library" },
  { href: "/styles", label: "Styles" },
];

export function Masthead() {
  const path = usePathname();
  const ai = useAiStatus();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/projects") : path.startsWith(href));
  return (
    <header className="masthead">
      <Link href="/" className="wordmark" aria-label="FrameProof, go to the desk">
        Frame<span>Proof</span>
      </Link>
      <nav aria-label="Main" className="nav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <p className="masthead-status" title={ai.state === "off" ? ai.reason : undefined}>
        Work is saved in this browser. {ai.state === "loading" ? "" : ai.state === "on" ? `AI review on (${ai.provider}).` : "AI review off."}
      </p>
    </header>
  );
}
