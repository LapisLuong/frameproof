"use client";

import { useId, useRef, useState } from "react";

type Props = {
  label: string;
  hint?: string;
  busy?: boolean;
  error?: string | null;
  onFile: (file: File) => void;
  testId?: string;
  compact?: boolean;
};

/** File picker that also accepts drag and drop. The native input keeps it keyboard- and screen-reader-friendly. */
export function Dropzone({ label, hint, busy, error, onFile, testId, compact }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f && !busy) onFile(f);
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="dropzone"
        style={compact ? { minHeight: "7rem" } : undefined}
        data-over={over}
        data-busy={busy}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
      >
        <span className="t-subhead">{busy ? "Measuring…" : over ? "Drop to add" : label}</span>
        <span className="t-meta">{hint ?? "Drop an image here or choose a file. PNG, JPEG, WebP or GIF, up to 15 MB."}</span>
        <input
          ref={input}
          id={id}
          data-testid={testId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {busy ? <div className="busy-line" aria-hidden="true" /> : null}
      {error ? (
        <p className="error-text" role="alert" style={{ marginTop: "0.5rem" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
