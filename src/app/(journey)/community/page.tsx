import Link from "next/link";
import {
  Users,
  HeartHandshake,
  ShieldCheck,
  ArrowRight,
  Sprout,
} from "lucide-react";
import { PageHeading } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
export default function Community() {
  return (
    <>
      <PageHeading
        eyebrow="FAITH GROWS IN FELLOWSHIP"
        title="A journey we’ll share."
        description="Encouragement, shared rhythms, and a place to grow together."
      />
      <section className="card community-hero">
        <span className="community-icon">
          <Users size={47} strokeWidth={1.3} />
        </span>
        <span className="eyebrow">A FUTURE CHAPTER</span>
        <h2>
          Side by side.
          <br />
          One faithful step at a time.
        </h2>
        <p>
          Fellowship groups are planned for a future release. The current demo
          is a personal reading space. There are no live groups, shared
          activity, or leaderboards.
        </p>
        <Button asChild>
          <Link href="/reading-plan">
            Continue your personal journey
            <ArrowRight size={17} />
          </Link>
        </Button>
      </section>
      <div className="community-values">
        {[
          {
            icon: HeartHandshake,
            title: "Encouragement first",
            text: "Shared challenges will celebrate participation, with room for different rhythms and seasons of life.",
          },
          {
            icon: ShieldCheck,
            title: "Your reflections stay yours",
            text: "Joining a future group will never automatically share your journal, prayer notes, or private highlights.",
          },
          {
            icon: Sprout,
            title: "Room for everyone",
            text: "Future participation summaries will encourage consistency, without ranking anyone’s spiritual maturity.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <article className="card" key={title}>
            <Icon size={25} />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </>
  );
}
