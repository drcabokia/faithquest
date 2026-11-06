"use client";
export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="empty-state full-page">
      <h1>A pause along the path.</h1>
      <p>We couldn’t show this page. Please try opening it again.</p>
      <button className="button button-primary" onClick={() => retry()}>
        Try again
      </button>
      <a href="/dashboard" className="text-link">
        Back to the dashboard
      </a>
    </main>
  );
}
