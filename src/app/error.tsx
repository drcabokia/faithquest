"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="empty-state full-page">
      <h1>A pause along the path.</h1>
      <p>
        Something went wrong while opening this page. Your saved demo data has
        not been cleared.
      </p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
      <a href="/dashboard" className="text-link">
        Back to the dashboard
      </a>
    </main>
  );
}
