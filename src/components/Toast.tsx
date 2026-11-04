"use client";

import { useEffect, useState } from "react";

type Msg = { id: number; text: string };
let push: ((text: string) => void) | null = null;
let seq = 0;

/** Announce a short confirmation ("Review saved"). Also read out by screen readers. */
export function toast(text: string) {
  push?.(text);
}

export function ToastHost() {
  const [msg, setMsg] = useState<Msg | null>(null);
  useEffect(() => {
    push = (text) => setMsg({ id: ++seq, text });
    return () => {
      push = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <div role="status" aria-live="polite" className="sr-only-container">
      {msg ? (
        <p key={msg.id} className="toast" data-show="true">
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
