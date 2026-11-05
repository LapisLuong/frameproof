"use client";

import { Dialog } from "radix-ui";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { STATIC_EXPORT, withBase } from "@/lib/base-path";
import { toast } from "./Toast";

type Download = () => void | Promise<void>;
const ExportAccess = createContext<((download: Download) => Promise<void>) | null>(null);

export function ExportAccessProvider({ children }: { children: ReactNode }) {
  const [retry, setRetry] = useState<Download | null>(null);
  const [checking, setChecking] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const run = async (download: Download) => {
    if (STATIC_EXPORT) {
      toast("This demo lets you edit. Downloads require the server version with Google sign-in.");
      return;
    }
    let response: Response;
    try {
      response = await fetch(withBase("/api/export-access"), { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(8000) });
    } catch {
      toast("Couldn't check download access. Check your connection and try again.");
      return;
    }
    if (response.status === 401) {
      if (!retry) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRetry(() => download);
      return;
    }
    if (response.status !== 204) {
      toast("Downloads are unavailable. Google sign-in may not be configured on this server.");
      return;
    }
    setRetry(null);
    await download();
  };

  return (
    <ExportAccess.Provider value={run}>
      {children}
      <Dialog.Root open={retry !== null} onOpenChange={(open) => { if (!open) setRetry(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog" style={{ width: "min(30rem, calc(100vw - 2rem))" }} onCloseAutoFocus={(event) => {
            if (!returnFocus.current?.isConnected) return;
            event.preventDefault();
            returnFocus.current.focus();
            returnFocus.current = null;
          }}>
            <Dialog.Title className="t-heading">Sign in to download</Dialog.Title>
            <Dialog.Description className="t-meta">
              Sign in with Google in a new tab. Your design and unsaved edits stay here. Then return to this tab and retry the download.
            </Dialog.Description>
            <div className="design-row" style={{ flexWrap: "wrap", gap: ".75rem", marginTop: "1rem" }}>
              <a className="btn btn-primary" href={withBase("/api/auth/signin?callbackUrl=%2F")} target="_blank" rel="noopener noreferrer">Sign in with Google</a>
              <button type="button" className="btn" disabled={checking} onClick={async () => {
                if (!retry) return;
                setChecking(true);
                try { await run(retry); }
                catch { toast("The download couldn't be created. Try again."); }
                finally { setChecking(false); }
              }}>{checking ? "Checking…" : "Retry download"}</button>
              <Dialog.Close asChild><button className="btn btn-quiet" type="button">Cancel</button></Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ExportAccess.Provider>
  );
}

export function useExportAccess() {
  const run = useContext(ExportAccess);
  if (!run) throw new Error("Export access provider is missing.");
  return run;
}
