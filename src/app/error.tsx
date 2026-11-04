"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page">
      <h1 className="t-title">Something broke on this page</h1>
      <p className="t-meta t-measure" style={{ marginTop: "0.5rem" }}>
        {error.message || "An unexpected error occurred."} Your saved work in this browser is not affected.
      </p>
      <button type="button" className="btn" style={{ marginTop: "1rem" }} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
