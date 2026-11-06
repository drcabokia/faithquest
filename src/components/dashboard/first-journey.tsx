import Link from "next/link";
import { ArrowRight, BookOpen, CircleHelp, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  {
    icon: BookOpen,
    title: "Choose your path through Scripture",
    text: "Compare reading plans before your first saved activity.",
    href: "/reading-plan",
    label: "Start reading plan",
  },
  {
    icon: CircleHelp,
    title: "Discover something new",
    text: "Explore the first reading with a few thoughtful questions.",
    href: "/quiz?day=1",
    label: "Take first quiz",
  },
  {
    icon: NotebookPen,
    title: "Make space to reflect",
    text: "Write a reflection, prayer or moment of gratitude.",
    href: "/journal",
    label: "Write first journal entry",
  },
];

export function FirstJourney() {
  return (
    <section className="first-journey" aria-labelledby="first-journey-title">
      <p className="eyebrow">A LITTLE CLOSER, EVERY DAY</p>
      <h1 id="first-journey-title">Welcome to FaithQuest365.</h1>
      <p className="page-description">
        Choose your reading plan first, then explore at your own pace.
      </p>
      <div className="welcome-actions">
        {actions.map(({ icon: Icon, title, text, href, label }, index) => (
          <article className="card welcome-action" key={href}>
            <span className="eyebrow">STEP {index + 1}</span>
            <Icon size={28} aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
            <Button asChild variant={index === 0 ? "default" : "secondary"}>
              <Link href={href}>
                {label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
