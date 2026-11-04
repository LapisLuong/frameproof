"use client";

import type { StackMove } from "@/lib/design/edit";
import type { DesignDoc, Layer } from "@/lib/design/schema";

type Props = {
  doc: DesignDoc;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, key: "hidden" | "locked") => void;
  onMove: (id: string, move: StackMove) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

const kindLabel = (l: Layer) => (l.type === "text" ? "Text" : l.type === "image" ? (l.resourceId ? "Image" : "Image slot") : l.shape === "line" ? "Rule" : l.shape === "rect" ? "Rectangle" : "Ellipse");

/** The stack, top layer first (as designers read it), with buttons rather than drag so it works by touch and keyboard. */
export function LayersPanel({ doc, selectedId, onSelect, onToggle, onMove, onDuplicate, onDelete }: Props) {
  const top = [...doc.layers].reverse();
  const selected = doc.layers.find((l) => l.id === selectedId) ?? null;
  const index = selected ? doc.layers.indexOf(selected) : -1;
  return (
    <section className="design-panel" aria-labelledby="layers-h">
      <h2 id="layers-h" className="t-subhead">
        Layers <span className="hint">{doc.layers.length}</span>
      </h2>
      {selected ? (
        <div className="design-row design-stack-actions" role="group" aria-label={`Arrange ${selected.name}`}>
          <button type="button" className="btn btn-sm" onClick={() => onMove(selected.id, "forward")} disabled={index === doc.layers.length - 1}>
            Bring forward
          </button>
          <button type="button" className="btn btn-sm" onClick={() => onMove(selected.id, "backward")} disabled={index === 0}>
            Send backward
          </button>
          <button type="button" className="btn btn-sm" onClick={() => onMove(selected.id, "front")} disabled={index === doc.layers.length - 1}>
            To front
          </button>
          <button type="button" className="btn btn-sm" onClick={() => onMove(selected.id, "back")} disabled={index === 0}>
            To back
          </button>
          <button type="button" className="btn btn-sm" onClick={() => onDuplicate(selected.id)}>
            Duplicate
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(selected.id)}>
            Delete layer
          </button>
        </div>
      ) : null}
      {top.length ? (
        <ol className="design-layers" data-testid="layers">
          {top.map((l) => (
            <li key={l.id} data-selected={l.id === selectedId || undefined} data-hidden={l.hidden || undefined}>
              <button type="button" className="design-layer-name" aria-pressed={l.id === selectedId} onClick={() => onSelect(l.id)}>
                <span>{l.name}</span>
                <span className="hint">{kindLabel(l)}</span>
              </button>
              <button type="button" className="btn btn-sm btn-quiet" aria-pressed={l.hidden} aria-label={`${l.hidden ? "Show" : "Hide"} ${l.name}`} onClick={() => onToggle(l.id, "hidden")}>
                {l.hidden ? "Show" : "Hide"}
              </button>
              <button type="button" className="btn btn-sm btn-quiet" aria-pressed={l.locked} aria-label={`${l.locked ? "Unlock" : "Lock"} ${l.name}`} onClick={() => onToggle(l.id, "locked")}>
                {l.locked ? "Unlock" : "Lock"}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="hint">No layers yet. Add text, a shape or an item.</p>
      )}
    </section>
  );
}
