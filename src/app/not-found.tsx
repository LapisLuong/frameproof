import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <h1 className="t-title">This page doesn&apos;t exist</h1>
      <p className="t-meta" style={{ marginTop: "0.5rem" }}>
        Check the address, or go back to your projects.
      </p>
      <p style={{ marginTop: "1rem" }}>
        <Link className="link" href="/">
          Back to the desk
        </Link>
      </p>
    </div>
  );
}
