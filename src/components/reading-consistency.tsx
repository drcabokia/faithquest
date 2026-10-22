"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
  const status = !next
    ? "All 365 missions complete"
    : overdue
      ? `${overdue} ${overdue === 1 ? "mission" : "missions"} to catch up`
      : due
        ? "Today's reading is ready"
        : "Up to date";
  const graceReason = eligibility.available
    ? null
    : {
        grace_reading_exists:
          "Yesterday's reading is complete; no grace is needed.",
        grace_no_prior_reading:
          "A completed mission is needed on the day before the missed date.",
        grace_cooldown: "A grace day was used recently.",
        grace_limit: "Your grace history is full.",
        grace_invalid_day: "Grace covers yesterday only.",
      }[eligibility.code ?? "grace_invalid_day"];
  return (
    <section
      className="card consistency-card"
      aria-label="Reading rhythm and catch-up"
    >
      <details
        className="rhythm-disclosure"
        onToggle={(event) => {
          if (!event.currentTarget.open) setConfirmation(null);
        }}
      >
        <summary>
          <h2 className="rhythm-summary">
            <span>
              Your reading rhythm
              <span className="rhythm-status">
                {status}
                {eligibility.available ? " · Grace available" : ""}
              </span>
            </span>
            <span className="rhythm-toggle">
              <span className="rhythm-show">View details</span>
              <span className="rhythm-hide">Hide details</span>
              <ChevronDown size={18} aria-hidden="true" />
            </span>
          </h2>
        </summary>
        <div className="rhythm-details">
          {next && chapter ? (
            <div className="rhythm-next">
              <div>
                <span className="small muted">Next unfinished mission</span>
                <p>
                  <strong>
                    Day {next.day} · {next.label}
                  </strong>
                </p>
              </div>
              <Button asChild variant="secondary">
                <Link
                  href={`/bible?day=${next.day}&book=${chapter.book}&chapter=${chapter.chapter}`}
                >
                  Continue Day {next.day}
                </Link>
              </Button>
            </div>
          ) : (
            <p>
              All 365 missions are complete. View your history in My Reading
              Plan.
            </p>
          )}
          <p className="small muted">
            Complete every assigned chapter to finish a mission. Catch-up
            reading is recorded on the date you finish.
          </p>
          <h3>Reading dates</h3>
          <p className="small muted">
            Dates follow {state.profile.timeZone}. Only completed missions count
            as reading days.
          </p>
          <ul className="rhythm-calendar">
            {Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(
              (d) => (
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
              ),
            )}
          </ul>
          <h3>Optional grace day</h3>
          <p>
            Grace can cover yesterday after a completed reading day, with at
            least 30 days between grace dates. It adds no XP, completed
            missions, badges or challenge credit.
          </p>
          {eligibility.available ? (
            <>
              <p>Available for {displayDate(eligibility.date)}.</p>
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
              {dates.includes(eligibility.date)
                ? "Grace is saved for yesterday."
                : graceReason}
            </p>
          )}
          {eligibility.nextEligible &&
            eligibility.nextEligible > eligibility.date && (
              <p className="small muted">
                Earliest next grace date:{" "}
                {displayDate(eligibility.nextEligible)}. Eligibility is checked
                the following day.
              </p>
            )}
          {confirmation && (
            <div
              className="journal-warning"
              role="group"
              aria-label="Confirm grace day"
            >
              <p>
                Save a grace day for {displayDate(confirmation)}? Reading
                missions and rewards will remain unchanged.
              </p>
              {confirmation !== eligibility.date && (
                <p>
                  The date has changed. Cancel and review the current grace
                  option.
                </p>
              )}
              {dates.includes(confirmation) && (
                <p>This grace date is now saved.</p>
              )}
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
        </div>
      </details>
    </section>
  );
}
