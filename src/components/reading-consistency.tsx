"use client";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { useJourney } from "./journey-provider";
import { Button } from "./ui/button";
import { addDays, displayDate } from "@/lib/dates";
import { graceEligibility } from "@/lib/grace-days";
import { nextUnfinishedMission } from "@/services/reading-consistency";
export function ReadingConsistency() {
  const { state, today, busy, claimGrace } = useJourney();
  const [confirmation, setConfirmation] = useState<string | null>(null),
    [page, setPage] = useState(0);
  useLayoutEffect(() => () => setConfirmation(null), []);
  if (!state) return null;
  const dates = state.graceDates ?? [],
    eligibility = graceEligibility(state.days, dates, today),
    reading = new Set(Object.values(state.days));
  const { next, chapter, overdue, due } = nextUnfinishedMission(state, today);
  const last = Math.max(0, Math.ceil(dates.length / 10) - 1),
    currentPage = Math.min(page, last);
  const history = [...dates]
    .reverse()
    .slice(currentPage * 10, currentPage * 10 + 10);
  return (
    <section
      className="card consistency-card"
      aria-label="Reading rhythm and catch-up"
    >
      <h2>Your reading rhythm</h2>
      {next && chapter ? (
        <>
          <p>
            {overdue
              ? `${overdue} earlier unfinished ${overdue === 1 ? "mission" : "missions"}. Take one at a time.`
              : due
                ? "There is reading ready for you today."
                : "You are up to date with today's missions. Continue ahead when you are ready."}
          </p>
          <p>
            Next unfinished mission:{" "}
            <strong>
              Day {next.day} · {next.label}
            </strong>
          </p>
          <Button asChild variant="secondary">
            <Link
              href={`/bible?day=${next.day}&book=${chapter.book}&chapter=${chapter.chapter}`}
            >
              Continue next unfinished mission
            </Link>
          </Button>
          <p className="small muted">
            Catch-up reading is recorded on the date you finish it. Complete
            every assigned chapter to finish a mission.
          </p>
        </>
      ) : (
        <p>
          All 365 reading missions are complete. Your saved history remains
          available in My Reading Plan.
        </p>
      )}
      <h3>Reading dates</h3>
      <p className="small muted">
        Dates follow {state.profile.timeZone}. Grace protects continuity; each
        reading day still requires a completed mission.
      </p>
      <ul className="rhythm-calendar">
        {Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => (
          <li
            key={d}
            className={
              reading.has(d)
                ? "rhythm-read"
                : dates.includes(d)
                  ? "rhythm-grace"
                  : ""
            }
            aria-label={displayDate(d)}
          >
            <time dateTime={d}>{displayDate(d)}</time>
            <span>
              {reading.has(d)
                ? "Mission completed"
                : dates.includes(d)
                  ? "Grace day"
                  : d === today
                    ? "Today, no mission yet"
                    : "No mission recorded"}
            </span>
            {reading.has(d) && dates.includes(d) && (
              <small>Grace also recorded</small>
            )}
          </li>
        ))}
      </ul>
      <h3>Optional grace day</h3>
      <p>
        Cover yesterday if you missed it after a completed reading day. Grace
        dates must be at least 30 calendar days apart. Grace adds no XP, mission
        completion, badge progress or challenge credit.
      </p>
      {eligibility.available ? (
        <>
          <p>
            You can cover {displayDate(eligibility.date)}. Continue reading
            today to keep your rhythm going.
          </p>
          {!confirmation && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmation(eligibility.date)}
            >
              Use grace for yesterday
            </Button>
          )}
        </>
      ) : (
        <p className="small muted" role="status">
          {eligibility.reason}
        </p>
      )}
      {eligibility.nextEligible &&
        eligibility.nextEligible > eligibility.date && (
          <p className="small muted">
            Next eligible missed date: {displayDate(eligibility.nextEligible)}.
            A claim is available the following day if the reading conditions are
            met.
          </p>
        )}
      {confirmation && (
        <div
          className="journal-warning"
          role="group"
          aria-label="Confirm grace day"
        >
          <p>
            Save a grace day for {displayDate(confirmation)}? Reading missions
            and rewards will remain unchanged.
          </p>
          {confirmation !== eligibility.date && (
            <p>
              The date has changed. Cancel and review the current grace option.
            </p>
          )}
          {dates.includes(confirmation) && <p>This grace date is now saved.</p>}
          <Button
            variant="secondary"
            disabled={
              busy ||
              !eligibility.available ||
              confirmation !== eligibility.date
            }
            onClick={async () => {
              const captured = confirmation;
              if (await claimGrace(captured)) setConfirmation(null);
            }}
          >
            Confirm grace day
          </Button>{" "}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirmation(null)}
          >
            Cancel grace
          </Button>
        </div>
      )}
      <h3>Saved grace dates</h3>
      {!history.length ? (
        <p className="small muted">No grace dates claimed.</p>
      ) : (
        <>
          <ul className="grace-history">
            {history.map((d) => (
              <li key={d}>
                <time dateTime={d}>{displayDate(d)}</time> · Grace day
                {reading.has(d) ? " · Reading also saved" : ""}
              </li>
            ))}
          </ul>
          {last > 0 && (
            <div className="saved-verse-actions">
              <Button
                variant="secondary"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous grace page
              </Button>
              <span>
                Page {currentPage + 1} of {last + 1}
              </span>
              <Button
                variant="secondary"
                disabled={currentPage === last}
                onClick={() => setPage(currentPage + 1)}
              >
                Next grace page
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
