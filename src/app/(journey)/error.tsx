"use client";
import Link from "next/link";

export default function JourneyError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <section className="card journey-render-error">
      <h1>A pause along the path.</h1>
      <p>We couldn’t show this page. Please try opening it again.</p>
      <button className="button button-primary" onClick={() => retry()}>
        Try again
      </button>
      <Link href="/dashboard" className="text-link">
        Back to the dashboard
      </Link>
    </section>
  );
}
