"use client";
import { Button } from "./ui/button";

export function JourneyLoadError({
  title,
  error,
  busy,
  onRetry,
}: {
  title: string;
  error: string;
  busy: boolean;
  onRetry: () => void | Promise<void>;
}) {
  return (
    <section className="journey-state">
      <h1>{title}</h1>
      <div className="card journey-load-error" aria-busy={busy}>
        <h2>Let’s reconnect your journey.</h2>
        <p className="error-banner" role="alert">
          {error}
        </p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void onRetry()}
        >
          {busy ? "Checking…" : "Check saved progress"}
        </Button>
      </div>
    </section>
  );
}
