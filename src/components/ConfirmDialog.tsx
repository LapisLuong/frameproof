"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "radix-ui";

/** Confirmation for destructive actions. The confirm button names the action ("Delete project"). */
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirm,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = (value: boolean) => { if (busy) return; setLocalOpen(value); onOpenChange?.(value); setError(null); };
  return (
    <AlertDialog.Root open={controlledOpen ?? localOpen} onOpenChange={change}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="overlay" />
        <AlertDialog.Content className="dialog" style={{ width: "min(28rem, calc(100vw - 2rem))" }}>
          <AlertDialog.Title className="t-heading">{title}</AlertDialog.Title>
          <AlertDialog.Description className="t-meta" style={{ marginTop: "0.5rem" }}>
            {body}
          </AlertDialog.Description>
          {error ? <p role="alert" className="error-text">{error}</p> : null}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <AlertDialog.Cancel asChild>
              <button type="button" className="btn" disabled={busy}>
                Keep it
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={async (event) => {
                event.preventDefault(); setBusy(true); setError(null);
                try { await onConfirm(); setLocalOpen(false); onOpenChange?.(false); }
                catch (e) { setError(e instanceof Error ? e.message : "The change couldn’t be saved. Try again."); }
                finally { setBusy(false); }
              }}>
                {confirm}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

let activeDraftRequest: ((action: () => void) => void) | null = null;
export function withDraftGuard(action: () => void) { if (activeDraftRequest) activeDraftRequest(action); else action(); }

/** Guard links, browser history and explicit draft-discard actions. */
export function useDraftGuard(dirty: boolean) {
  const router = useRouter();
  const bypass = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const request = (action: () => void) => { if (dirty) setPending(() => action); else action(); };
  useEffect(() => {
    if (!dirty) return;
    bypass.current = false;
    activeDraftRequest = (action) => setPending(() => action);
    const unload = (event: BeforeUnloadEvent) => { if (bypass.current) return; event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.download || anchor.href === location.href) return;
      event.preventDefault(); event.stopPropagation();
      setPending(() => () => { bypass.current = true; if (anchor.origin === location.origin) router.push(anchor.pathname + anchor.search + anchor.hash); else location.assign(anchor.href); });
    };
    // A duplicate entry lets Back ask before leaving the mounted draft.
    history.pushState(history.state, "", location.href);
    const pop = () => { if (bypass.current) return; history.pushState(history.state, "", location.href); setPending(() => () => { bypass.current = true; history.go(-2); }); };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop);
    return () => { activeDraftRequest = null; window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); window.removeEventListener("popstate", pop); };
  }, [dirty, router]);
  const dialog = <ConfirmDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }} title="Discard unsaved changes?" body="Your draft has not been saved." confirm="Discard changes" onConfirm={() => { pending?.(); setPending(null); }} />;
  return { request, dialog };
}
