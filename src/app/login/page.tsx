import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { accountsEnabled, storageMode } from "@/lib/supabase/config";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const account = storageMode() === "supabase",
    enabled = accountsEnabled(),
    query = await searchParams;
  return (
    <main className="login-page">
      <Logo />
      <section className="card login-card">
        <ShieldCheck size={34} />
        <p className="eyebrow">WELCOME TO FAITHQUEST365</p>
        <h1>Your journey starts with one step.</h1>
        {query.error && (
          <div className="error-banner" role="alert">
            Sign-in could not be completed. Please try again.
          </div>
        )}
        {account ? (
          <>
            <p>
              Sign in to keep your reading progress and private reflections with
              your account across devices.
            </p>
            {enabled ? (
              <form action="/auth/google" method="post">
                <Button type="submit">
                  Continue with Google <ArrowRight size={17} />
                </Button>
              </form>
            ) : (
              <div className="info-box">
                Account access is being prepared and verified. Sign-in will open
                after the development checks are complete.
              </div>
            )}
            <p className="muted small">
              Your personal reflections are private to your account. Local demo
              entries are never imported automatically.
            </p>
          </>
        ) : (
          <>
            <p>
              Explore the complete reading journey with a demo profile. No
              email, password, or external service is needed.
            </p>
            <Button asChild>
              <Link href="/dashboard">
                Enter the local demo <ArrowRight size={17} />
              </Link>
            </Button>
            <div className="info-box">
              Progress and reflections stay in this browser’s local storage.
              They are not encrypted, backed up, or synced. Avoid sensitive
              personal details on shared devices.
            </div>
            <p className="muted small">
              You’re using the local demo. Account access is enabled separately
              after development validation.
            </p>
          </>
        )}
      </section>
      <Link href="/" className="text-link">
        Back to FaithQuest365
      </Link>
    </main>
  );
}
