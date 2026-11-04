"use client";

import { useObjectUrl } from "@/hooks/useStore";

/** Thumbnail at its own aspect ratio (never cropped to a square). */
export function Thumb({ blob, alt, style, className }: { blob: Blob | null | undefined; alt: string; style?: React.CSSProperties; className?: string }) {
  const url = useObjectUrl(blob);
  if (!url) return <span className="ph" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} style={style} className={className} />;
}
