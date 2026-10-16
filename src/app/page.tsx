import { storageMode } from "@/lib/supabase/config";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Sparkles,
  NotebookPen,
  Map,
  Heart,
  Check,
  Leaf,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { JourneyArt } from "@/components/journey-art";
import { Button } from "@/components/ui/button";
export default function Home() {
  const account = storageMode() === "supabase";
  return (
    <div className="landing">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="landing-nav">
        <Logo />
        <nav aria-label="Landing navigation">
          <a href="#the-journey">The journey</a>
          <a href="#features">Why FaithQuest?</a>
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">
              Get started <ArrowRight size={15} />
            </Link>
          </Button>
        </nav>
      </header>
      <main id="main-content">
        <section className="landing-hero">
          <div>
            <span className="landing-kicker">
              <Leaf size={15} />A LITTLE CLOSER, EVERY DAY
            </span>
            <h1>
              A year in the Word.
              <br />
              <em>
                A journey that
                <br />
                changes you.
              </em>
            </h1>
            <p>
              Discover the Bible one day at a time. Find a gentle rhythm,
              celebrate small steps, and make space for what God is teaching
              you.
            </p>
            <div className="landing-actions">
              <Button asChild>
                <Link href="/dashboard">
                  Begin your journey <ArrowRight size={18} />
                </Link>
              </Button>
              <Link href="/reading-plan" className="text-link">
                Explore the reading plan <ArrowRight size={15} />
              </Link>
            </div>
            <span className="landing-note">
              <Check size={14} />
              {account
                ? "Your private journey · Progress across devices"
                : "Free local demo · No account required"}
            </span>
          </div>
          <div className="landing-visual">
            <div className="visual-top">
              <span>
                <Sparkles size={14} />
                YOUR ADVENTURE STARTS HERE
              </span>
              <span>001 / 365</span>
            </div>
            <JourneyArt />
            <div className="visual-card">
              <span className="icon-tile">
                <BookOpen size={22} />
              </span>
              <div>
                <span className="eyebrow">YOUR FIRST CHAPTER</span>
                <strong>In the beginning…</strong>
                <small>Genesis 1–3 · Canonical Journey</small>
              </div>
              <span className="visual-xp">+50 XP</span>
            </div>
          </div>
        </section>
        <section className="landing-strip" id="the-journey">
          <span>
            <strong>365</strong>daily moments
          </span>
          <span>
            <strong>66</strong>books to discover
          </span>
          <span>
            <strong>1</strong>meaningful journey
          </span>
          <p>
            Read. Discover.
            <br />
            <em>Grow in Faith.</em>
          </p>
        </section>
        <section className="landing-features" id="features">
          <p className="eyebrow">MORE THAN A READING CHECKLIST</p>
          <h2>Build a rhythm. Let your faith take root.</h2>
          <div className="feature-grid">
            {[
              {
                icon: Map,
                title: "A path for every day",
                text: "Follow a complete Genesis-to-Revelation reading plan, with clear daily missions and room to catch up.",
              },
              {
                icon: Sparkles,
                title: "Small steps, celebrated",
                text: "Earn participation XP and discover milestones as your reading habit grows. Every step matters.",
              },
              {
                icon: NotebookPen,
                title: "Room to pause and reflect",
                text: "Capture what stands out, explore a thoughtful question, and make the words part of your day.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span className="feature-icon">
                  <Icon size={25} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-invite">
          <Heart size={24} />
          <h2>
            You don’t need a perfect streak.
            <br />
            Just a willing heart.
          </h2>
          <p>
            Start where you are. Come back when you can. Your journey is
            waiting.
          </p>
          <Button asChild>
            <Link href="/dashboard">
              Try FaithQuest365 <ArrowRight size={17} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>Made for a daily walk, at your own pace.</span>
        <Link href="/login">
          {account ? "About your account" : "About this demo"}{" "}
          <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
