"use client";

import { useState } from "react";
import { CATEGORY_LABEL, EVIDENCE_HELP, EVIDENCE_LABEL, type ReviewIssue } from "@/lib/review/types";

type Props = {
  issues: ReviewIssue[];
  onToggle: (issue: ReviewIssue, resolved: boolean) => void;
  busyId?: string | null;
};

const LEVEL_WORD = { high: "High", medium: "Medium", low: "Low" } as const;

export function EvidenceLabel({ type }: { type: ReviewIssue["evidenceType"] }) {
  return (
    <span className="evidence" data-type={type} title={EVIDENCE_HELP[type]}>
      {EVIDENCE_LABEL[type]}
    </span>
  );
}

/** Margin notes, numbered by priority order like proof marks. */
export function ProofNotes({ issues, onToggle, busyId }: Props) {
  const [show, setShow] = useState<"open" | "all">("open");
  const open = issues.filter((i) => !i.resolved);
  const list = show === "open" ? open : issues;

  return (
    <section aria-labelledby="notes-h">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
        <h2 id="notes-h" className="t-heading">
          Margin notes
        </h2>
        <p className="t-meta" data-testid="issue-count">
          {open.length} open of {issues.length}
        </p>
      </div>
      <div className="modes" role="toolbar" aria-label="Show notes" style={{ margin: "0.75rem 0 1rem" }}>
        <button type="button" aria-pressed={show === "open"} onClick={() => setShow("open")}>
          Open
        </button>
        <button type="button" aria-pressed={show === "all"} onClick={() => setShow("all")}>
          All
        </button>
      </div>

      {issues.length === 0 ? (
        <p className="t-meta t-measure">
          No measured difference crossed a threshold. That doesn&apos;t make the design finished — it means the pixels are close to the reference on palette,
          format, tone and density. Judge hierarchy and type yourself, or turn on AI review for a second opinion.
        </p>
      ) : list.length === 0 ? (
        <p className="t-meta">Every note is resolved. Show all to review them.</p>
      ) : (
        <ol className="proofnotes">
          {list.map((i) => {
            const n = issues.indexOf(i) + 1;
            return (
              <li key={i.id} className="proofnote" data-resolved={i.resolved} data-testid="proofnote">
                <span className="proofmark" aria-hidden="true">
                  {n}
                </span>
                <div>
                  <h3 className="proofnote-title">
                    <span className="sr-only">Note {n}: </span>
                    {i.title}
                  </h3>
                  <p className="proofnote-meta">
                    <span className={i.priority === "high" ? "priority-high" : undefined}>{LEVEL_WORD[i.priority]} priority</span>
                    <span>{CATEGORY_LABEL[i.category]}</span>
                    <EvidenceLabel type={i.evidenceType} />
                  </p>
                  <p className="t-measure" style={{ fontSize: "var(--text-sm)" }}>
                    {i.observation}
                  </p>
                  <details className="disclose" style={{ marginTop: "0.5rem" }}>
                    <summary>How to fix it</summary>
                    <dl>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{LEVEL_WORD[i.confidence]}</dd>
                      </div>
                      <div>
                        <dt>Why it matters</dt>
                        <dd>{i.rationale}</dd>
                      </div>
                      <div>
                        <dt>What to change</dt>
                        <dd>{i.recommendation}</dd>
                      </div>
                      {i.preserve ? (
                        <div>
                          <dt>What to keep</dt>
                          <dd>{i.preserve}</dd>
                        </div>
                      ) : null}
                      {i.evidence.length ? (
                        <div>
                          <dt>Evidence</dt>
                          <dd>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                              {i.evidence.map((e) => (
                                <li key={e.label} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                                  <span className="t-meta">{e.label}</span>
                                  <span className="t-value">{e.value}</span>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginTop: "0.75rem" }}
                    disabled={busyId === i.id}
                    onClick={() => onToggle(i, !i.resolved)}
                    aria-label={`${i.resolved ? "Reopen" : "Mark resolved"}: ${i.title}`}
                  >
                    {i.resolved ? "Reopen" : "Mark resolved"}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
