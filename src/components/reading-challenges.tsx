"use client";
import { useState } from "react";
import Link from "next/link";
import { Flag, LockKeyhole } from "lucide-react";
import { useJourney, JourneyLoading } from "./journey-provider";
import { Button } from "./ui/button";
import { PageHeading, Progress } from "./ui/shared";
import { addDays, displayDate } from "@/lib/dates";
import { CHALLENGE_LIMIT, challengeProgress } from "@/lib/challenges";

const labels = {
  done: "Mission completed",
  missed: "No mission recorded",
  today: "Today · ready to read",
  upcoming: "Coming up",
};
export function ReadingChallenges() {
  const { state, today, busy, joinChallenge, mode } = useJourney();
  const [page, setPage] = useState(1);
  if (!state) return <JourneyLoading />;
  const starts = [...(state.challengeStarts ?? [])].sort().reverse();
  const completionDates = Object.values(state.days);
  const current = starts.find(
    (start) => start <= today && addDays(start, 6) >= today,
  );
  const history = starts.filter((start) => start !== current);
  const pages = Math.max(1, Math.ceil(history.length / 10));
  const currentPage = Math.min(page, pages);
  const capacity =
    365 -
    Object.keys(state.days).length +
    (completionDates.includes(today) ? 1 : 0);
  const progress = current
    ? challengeProgress(current, completionDates, today)
    : null;
  return (
    <>
      <PageHeading
        eyebrow="ONE DAY AT A TIME"
        title="Seven days in the Word."
        description="A small, personal commitment to make room for Scripture each day."
        action={
          <span className="soft-label">
            <LockKeyhole size={14} />
            {mode === "demo"
              ? "Private in this browser"
              : "Private to your account"}
          </span>
        }
      />
      <section className="card challenge-rules">
        <Flag size={25} />
        <h2>A steady rhythm, at your pace.</h2>
        <p>
          Complete an unfinished reading mission on each of your challenge’s
          seven calendar dates. A mission counts when all its assigned chapters
          are complete. Multiple missions on one date count as one challenge
          day.
        </p>
        <p>
          Your calendar uses <strong>{state.profile.timeZone}</strong>. Today’s
          completed mission counts even if you join afterward. All seven dates
          earn <strong>100 bonus XP, once</strong>, alongside your usual reading
          rewards.
        </p>
        <p className="muted">
          Missed dates stay visible. You can continue reading and start another
          challenge after this period ends. Streak grace days add no challenge
          credit. There are no resets, shared results or rankings.
        </p>
        {!current && (
          <>
            <p>
              Next challenge: {displayDate(today)} –{" "}
              {displayDate(addDays(today, 6))}.
            </p>
            <Button
              disabled={
                busy || capacity < 7 || starts.length >= CHALLENGE_LIMIT
              }
              onClick={() => {
                void joinChallenge();
              }}
            >
              {busy ? "Starting…" : "Start seven-day challenge"}
            </Button>
            {capacity < 7 && (
              <p role="status">
                There are not enough unfinished missions for a new seven-day
                challenge. You can still revisit Scripture in the Bible Reader.
              </p>
            )}
            {starts.length >= CHALLENGE_LIMIT && (
              <p role="status">
                Your challenge history has reached its 1,000-period limit.
              </p>
            )}
          </>
        )}
      </section>
      {progress && (
        <section
          className="card challenge-current"
          aria-label="Current reading challenge"
        >
          <span className="eyebrow">YOUR CURRENT CHALLENGE</span>
          <h2>
            {displayDate(progress.start)} – {displayDate(progress.end)}
          </h2>
          <p role="status">
            {progress.count} of 7 dates completed
            {progress.count === 7 ? " · Challenge complete!" : ""}
          </p>
          <Progress
            value={(progress.count / 7) * 100}
            label="Seven-day challenge progress"
          />
          <ol className="challenge-days">
            {progress.dates.map(({ date, status }, i) => (
              <li
                key={date}
                className={`challenge-date ${status}`}
                aria-current={date === today ? "date" : undefined}
              >
                <span className="eyebrow">DAY {i + 1}</span>
                <strong>{displayDate(date)}</strong>
                <span>{labels[status]}</span>
              </li>
            ))}
          </ol>
          {state.rewards[`challenge:${current}`] && (
            <p className="challenge-celebration">
              100 challenge XP awarded. Every day you made room for reading.
            </p>
          )}
          {progress.count < 7 && (
            <Button asChild>
              <Link href="/reading-plan">Choose an unfinished mission</Link>
            </Button>
          )}
          <p className="small muted">
            A mission completed on an earlier date cannot count again. Your
            timezone stays fixed after joining. Another challenge can start
            after {displayDate(progress.end)}.
          </p>
        </section>
      )}
      <section className="card challenge-history">
        <h2>Your challenge history</h2>
        {!history.length && (
          <p className="muted">
            Your past challenge periods will appear here. Every reading day is a
            step worth keeping.
          </p>
        )}
        <ul>
          {history
            .slice((currentPage - 1) * 10, currentPage * 10)
            .map((start) => {
              const p = challengeProgress(start, completionDates, today);
              return (
                <li key={start}>
                  <strong>
                    {displayDate(start)} – {displayDate(p.end)}
                  </strong>
                  <span>
                    {p.count} of 7 dates ·{" "}
                    {p.status === "completed" ? "Completed" : "Period ended"}
                    {state.rewards[`challenge:${start}`]
                      ? " · 100 XP awarded"
                      : ""}
                  </span>
                </li>
              );
            })}
        </ul>
        {pages > 1 && (
          <nav
            className="journal-pagination"
            aria-label="Challenge history pages"
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span>
              Page {currentPage} of {pages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </section>
    </>
  );
}
