"use client";
import { ReadingConsistency } from "./reading-consistency";
import { nextUnfinishedMission } from "@/services/reading-consistency";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Search,
  Route,
} from "lucide-react";
import { useJourney, JourneyLoading } from "@/components/journey-provider";
import { PageHeading, Progress } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import {
  getPlan,
  planId,
  PLAN_DETAILS,
  currentDay,
} from "@/services/reading-plan";
import { PlanCatalogue } from "./plan-catalogue";
import { addDays, displayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
export function ReadingPlan() {
  const { state, today } = useJourney();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0);
  if (!state) return <JourneyLoading />;
  const PLAN = getPlan(planId(state));
  const { next: nextMission, chapter: nextChapter } = nextUnfinishedMission(
    state,
    today,
  );
  const day = currentDay(state.profile.startDate, today),
    completed = Object.keys(state.days).length,
    missed = PLAN.filter((m) => m.day < day && !state.days[m.day]);
  const filtered = PLAN.filter(
    (m) =>
      (filter === "all" ||
        (filter === "complete" ? !!state.days[m.day] : !state.days[m.day])) &&
      `${m.label} day ${m.day}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 14)),
    visible = filtered.slice(
      Math.min(page, pages - 1) * 14,
      (Math.min(page, pages - 1) + 1) * 14,
    );
  return (
    <>
      <PageHeading
        eyebrow="YOUR 365-DAY ADVENTURE"
        title="One day. One meaningful step."
        description="Explore the whole Bible, with room to grow at your own pace."
        action={
          <Link className="text-link" href="#plan-catalogue">
            Compare reading journeys
          </Link>
        }
      />
      <section className="plan-overview card">
        <span className="plan-symbol">
          <Route size={35} />
        </span>
        <div>
          <span className="eyebrow">{PLAN_DETAILS[planId(state)].name}</span>
          <h2>The whole story, in a year.</h2>
          <p>66 books · 1,189 chapters · 365 days · Protestant canon</p>
          <Progress
            value={(completed / 365) * 100}
            label="Reading plan completion"
          />
          <span className="small muted">
            {completed} days completed · {((completed / 365) * 100).toFixed(1)}%
            of your journey
          </span>
        </div>
        <Button asChild>
          <Link
            href={
              nextMission && nextChapter
                ? `/bible?day=${nextMission.day}&book=${nextChapter.book}&chapter=${nextChapter.chapter}`
                : `/bible?day=${day}`
            }
          >
            {nextMission
              ? missed.length
                ? "Catch up gently"
                : "Open next mission"
              : "Review reading"}
            <ArrowRight size={16} />
          </Link>
        </Button>
      </section>
      {missed.length > 0 && (
        <p className="info-box">
          You have {missed.length} earlier{" "}
          {missed.length === 1 ? "mission" : "missions"} to explore. There’s no
          penalty for returning to the path.
        </p>
      )}
      <ReadingConsistency />
      <div className="list-controls">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search reading days or books"
            placeholder="Find a day or a Bible book…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <label className="filter-label">
          <span className="sr-only">Completion status</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All readings</option>
            <option value="pending">Still to discover</option>
            <option value="complete">Completed readings</option>
          </select>
        </label>
      </div>
      <div className="plan-list">
        {visible.length ? (
          visible.map((m) => {
            const done = !!state.days[m.day],
              first =
                m.chapters.find((c) => !state.chapters[c.key]) ?? m.chapters[0];
            return (
              <Link
                href={`/bible?day=${m.day}&book=${first.book}&chapter=${first.chapter}`}
                className={cn(
                  "plan-row",
                  m.day === day && "today",
                  done && "completed",
                )}
                key={m.day}
              >
                <span className="day-number">
                  {done ? <Check size={21} /> : String(m.day).padStart(3, "0")}
                </span>
                <div>
                  <span className="plan-row-date">
                    {displayDate(addDays(state.profile.startDate, m.day - 1))}
                    {m.day === day && <span className="today-pill">TODAY</span>}
                  </span>
                  <h3>{m.label}</h3>
                  <span className="small muted">
                    {m.chapters.filter((c) => state.chapters[c.key]).length} /{" "}
                    {m.chapters.length} chapters read
                  </span>
                </div>
                <span className="plan-row-status">
                  {done ? "Completed" : "50 XP"}
                </span>
                <ArrowRight size={17} />
              </Link>
            );
          })
        ) : (
          <div className="empty-state">
            <BookOpen />
            <h3>No readings found</h3>
            <p>Try a different book name or completion filter.</p>
          </div>
        )}
      </div>
      <div className="pagination">
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          <ArrowLeft size={15} />
          Previous
        </Button>
        <span aria-live="polite">
          Page {Math.min(page, pages - 1) + 1} of {pages} · {filtered.length}{" "}
          readings
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
          <ArrowRight size={15} />
        </Button>
      </div>
      <PlanCatalogue />
    </>
  );
}
