import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function Login() {
  return (
    <main className="login-page">
      <Logo />
      <section className="card login-card">
        <ShieldCheck size={34} />
        <p className="eyebrow">WELCOME TO FAITHQUEST365</p>
        <h1>Your journey starts with one step.</h1>
        <p>
          Explore the complete reading journey with a demo profile. No email,
          password, or external service is needed.
        </p>
        <Button asChild>
          <Link href="/dashboard">
            Enter the local demo <ArrowRight size={17} />
          </Link>
        </Button>
        <div className="info-box">
          Progress and reflections stay in this browser’s local storage. They
          are not encrypted, backed up, or synced. Avoid sensitive personal
          details on shared devices.
        </div>
        <p className="muted small">
          Google sign-in and private Supabase accounts are planned for a future
          release. They are not connected in this demo.
        </p>
      </section>
      <Link href="/" className="text-link">
        Back to FaithQuest365
      </Link>
    </main>
  );
}
