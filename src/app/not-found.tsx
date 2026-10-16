import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state full-page">
      <p className="eyebrow">A DIFFERENT TURN IN THE PATH</p>
      <h1>This page is still waiting to be discovered.</h1>
      <p>Let’s find your way back to the journey.</p>
      <Link href="/dashboard" className="button button-primary">
        Back to my dashboard
      </Link>
    </main>
  );
}
