"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkAccountConnection } from "@/lib/account-client";
import { useRequestCooldown } from "@/components/use-request-cooldown";
export function AccountConnection() {
  const cooldown = useRequestCooldown();
  const [checking, setChecking] = useState(false),
    [result, setResult] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <section className="card backup-card account-connection">
      <ShieldCheck size={23} />
      <h2>Account connection</h2>
      <p>Check that your sign-in and account service are responding.</p>
      <Button
        variant="secondary"
        disabled={checking || cooldown.seconds > 0}
        onClick={async () => {
          setChecking(true);
          setResult(false);
          setError(null);
          try {
            await checkAccountConnection();
            setResult(true);
          } catch (failure) {
            cooldown.pause(failure);
            setError(
              failure instanceof Error
                ? failure.message
                : "Your connection could not be checked. Please retry.",
            );
          } finally {
            setChecking(false);
          }
        }}
      >
        {cooldown.seconds > 0
          ? `Try connection check in ${cooldown.seconds}s`
          : checking
            ? "Checking connection…"
            : "Check account connection"}
      </Button>
      {result && <p role="status">Your account connection is working.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
