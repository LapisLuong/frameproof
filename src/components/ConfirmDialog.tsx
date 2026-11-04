"use client";

import { AlertDialog } from "radix-ui";

/** Confirmation for destructive actions. The confirm button names the action ("Delete project"). */
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirm,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="overlay" />
        <AlertDialog.Content className="dialog" style={{ width: "min(28rem, calc(100vw - 2rem))" }}>
          <AlertDialog.Title className="t-heading">{title}</AlertDialog.Title>
          <AlertDialog.Description className="t-meta" style={{ marginTop: "0.5rem" }}>
            {body}
          </AlertDialog.Description>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <AlertDialog.Cancel asChild>
              <button type="button" className="btn">
                Keep it
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" className="btn btn-danger" onClick={onConfirm}>
                {confirm}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
