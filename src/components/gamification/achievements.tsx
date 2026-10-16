"use client";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Check,
  Flame,
  Heart,
  Crown,
  Mountain,
  Sprout,
  Sparkles,
  Footprints,
  LockKeyhole,
} from "lucide-react";
import { BOOKS } from "@/data/books";
import { useJourney, JourneyLoading } from "@/components/journey-provider";
import {
  achievements,
  levelInfo,
  totalXp,
  LEVELS,
} from "@/services/gamification";
import { PageHeading, Progress } from "@/components/ui/shared";
const icons = {
  footsteps: Footprints,
  flame: Flame,
  tree: Sprout,
  heart: Heart,
  sparkles: Sparkles,
  book: BookOpen,
  mountain: Mountain,
  crown: Crown,
};
export function Achievements() {
  const { state } = useJourney();
  if (!state) return <JourneyLoading />;
  const badges = achievements(state),
    earned = badges.filter((b) => b.earned).length,
    xp = totalXp(state),
    level = levelInfo(xp);
  return (
    <>
      <PageHeading
        eyebrow="SMALL STEPS. MEANINGFUL MILESTONES."
        title="Look how your journey grows."
        description="A little encouragement for the time you’re spending in the Word."
        action={
          <span className="soft-label">
            <Award size={16} />
            {earned} of {badges.length} earned
          </span>
        }
      />
      <section className="card achievement-level">
        <span className="level-medallion">
          <Sprout size={33} />
        </span>
        <div>
          <span className="eyebrow">
            LEVEL {level.number} · {xp.toLocaleString()} XP
          </span>
          <h2>{level.name}</h2>
          <Progress label="Level progress" value={level.progress} />
          <p>
            {level.next
              ? `${level.next.xp - xp} XP until ${level.next.name}`
              : "Your learning journey continues."}
          </p>
        </div>
        <div className="level-ladder">
          {LEVELS.map((l, i) => (
            <span
              key={l.name}
              className={i < level.number ? "reached" : ""}
              title={`${l.name} · ${l.xp} XP`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </section>
      <div className="badge-grid">
        {badges.map((b) => {
          const Icon = icons[b.icon as keyof typeof icons];
          return (
            <article
              className={`card badge-card ${b.earned ? "earned" : "locked"}`}
              key={b.id}
            >
              <span className="badge-status">
                {b.earned ? (
                  <>
                    <Check size={13} />
                    EARNED
                  </>
                ) : (
                  <>
                    <LockKeyhole size={12} />
                    STILL TO DISCOVER
                  </>
                )}
              </span>
              <span className="badge-medallion">
                <Icon size={32} strokeWidth={1.4} />
              </span>
              <h2>{b.name}</h2>
              <p>{b.description}</p>
            </article>
          );
        })}
      </div>
      <section className="adventure-map">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE WHOLE STORY, ONE STEP AT A TIME</span>
            <h2>Your Bible adventure map</h2>
            <p className="muted">
              Every book is open to explore. Finish a book to earn 150 XP.
            </p>
          </div>
          <span className="soft-label">
            {Object.keys(state.chapters).length} / 1,189 chapters
          </span>
        </div>
        {["OT", "NT"].map((testament) => (
          <div className="testament" key={testament}>
            <h3>
              {testament === "OT" ? "The Old Testament" : "The New Testament"}
            </h3>
            <div className="map-grid">
              {BOOKS.filter((b) => b.testament === testament).map((book) => {
                const count = Object.keys(state.chapters).filter((k) =>
                  k.startsWith(book.id + "."),
                ).length;
                return (
                  <Link
                    href={`/bible?book=${book.id}&chapter=1`}
                    key={book.id}
                    className={`map-book ${count === book.chapters ? "complete" : count ? "started" : ""}`}
                  >
                    <span>
                      {count === book.chapters ? (
                        <Check size={18} />
                      ) : (
                        <BookOpen size={18} />
                      )}
                    </span>
                    <strong>{book.name}</strong>
                    <small>
                      {count} / {book.chapters}
                    </small>
                    <Progress
                      value={(count / book.chapters) * 100}
                      label={`${book.name} completion`}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <p className="gentle-reminder">
        <Heart size={17} />
        These milestones celebrate participation. They never measure spiritual
        maturity.
      </p>
    </>
  );
}
