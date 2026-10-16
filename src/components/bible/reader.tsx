"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { BOOKS, type BookId } from "@/data/books";
import { bibleContent, type BibleChapter } from "@/services/bible-content";
import { ALL_CHAPTERS, PLAN, currentDay } from "@/services/reading-plan";
import { useJourney, JourneyLoading } from "@/components/journey-provider";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/shared";
import { cn } from "@/lib/utils";
function ChapterText({
  book,
  chapter,
  onReady,
}: {
  book: BookId;
  chapter: number;
  onReady: () => void;
}) {
  const [data, setData] = useState<BibleChapter | null>(null),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    bibleContent
      .getChapter(book, chapter, controller.signal)
      .then((data) => {
        setData(data);
        onReady();
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load this chapter.",
          );
      });
    return () => controller.abort();
  }, [book, chapter, onReady, retry]);
  if (error)
    return (
      <div className="empty-state" role="alert">
        <BookOpen />
        <h3>Scripture is unavailable</h3>
        <p>{error}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setError(null);
            setRetry((r) => r + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  if (!data)
    return (
      <div className="loading-state" role="status">
        <LoaderCircle className="spin" size={20} />
        Loading Scripture…
      </div>
    );
  return (
    <div className="scripture-text">
      {data.verses
        .filter((v) => v.text.length > 0)
        .map((v) => (
          <p key={v.number}>
            <sup>{v.number}</sup>
            {v.text}
          </p>
        ))}
      {data.verses.some((v) => !v.text) && (
        <p className="verse-numbering-note">
          Verse numbering follows the WEB source. Some verse numbers have no
          text in this edition; no replacement text has been added.
        </p>
      )}
    </div>
  );
}
import { useCallback } from "react";
function ChapterReader({
  book,
  chapter,
  day,
}: {
  book: BookId;
  chapter: number;
  day: number;
}) {
  const { state, busy, complete, remember } = useJourney();
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => {
    setReady(true);
    void remember(book, chapter);
  }, [book, chapter, remember]);
  if (!state) return null;
  const index = ALL_CHAPTERS.findIndex(
    (c) => c.book === book && c.chapter === chapter,
  );
  const previous = ALL_CHAPTERS[index - 1],
    next = ALL_CHAPTERS[index + 1];
  const done = !!state.chapters[`${book}.${chapter}`];
  return (
    <>
      <article className="card reader-paper">
        <div className="reader-title">
          <span className="eyebrow">WORLD ENGLISH BIBLE · CLASSIC</span>
          <h2>
            {BOOKS.find((b) => b.id === book)!.name} <em>{chapter}</em>
          </h2>
          <span className="reader-ornament">✦</span>
        </div>
        <ChapterText book={book} chapter={chapter} onReady={onReady} />
        <div className="reader-completion">
          <div>
            <strong>
              {done
                ? "A step worth celebrating."
                : "Take a moment. Let it sink in."}
            </strong>
            <p>
              {done
                ? "This chapter is recorded in your journey."
                : "When you’ve read this chapter, mark it below."}
            </p>
          </div>
          <Button
            disabled={busy || !ready || done}
            onClick={() => void complete(`${book}.${chapter}`)}
          >
            {done ? <Check size={17} /> : <BookOpen size={17} />}{" "}
            {done ? "Chapter completed" : "Mark chapter as read"}
          </Button>
        </div>
      </article>
      <div className="reader-pagination">
        {previous ? (
          <Button asChild variant="secondary">
            <Link
              href={`/bible?day=${day}&book=${previous.book}&chapter=${previous.chapter}`}
            >
              <ArrowLeft size={16} />
              Previous chapter
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button asChild>
            <Link
              href={`/bible?day=${day}&book=${next.book}&chapter=${next.chapter}`}
            >
              Next chapter
              <ArrowRight size={16} />
            </Link>
          </Button>
        ) : (
          <Link className="text-link" href="/achievements">
            View your milestones <ArrowRight size={16} />
          </Link>
        )}
      </div>
      <p className="content-attribution">
        World English Bible Classic · Public domain.{" "}
        <a
          href="https://ebible.org/eng-web/copyright.htm"
          target="_blank"
          rel="noreferrer"
        >
          Content & licensing
        </a>{" "}
        ·{" "}
        <a href="/bible/provenance.json" target="_blank" rel="noreferrer">
          Source record
        </a>
      </p>
    </>
  );
}
export function Reader() {
  const { state, today } = useJourney();
  const query = useSearchParams(),
    router = useRouter();
  if (!state) return <JourneyLoading />;
  const queryDay = Number(query.get("day"));
  const day =
    Number.isInteger(queryDay) && queryDay >= 1 && queryDay <= 365
      ? queryDay
      : currentDay(state.profile.startDate, today);
  const mission = PLAN[day - 1];
  const resume =
    mission.chapters.find((c) => !state.chapters[c.key]) ?? mission.chapters[0];
  const savedResume =
    !query.get("day") && !query.get("book") ? state.resume : undefined;
  const book =
    BOOKS.find((b) => b.id === (query.get("book") ?? savedResume?.book)) ??
    BOOKS.find((b) => b.id === resume.book)!;
  const queryChapter = Number(query.get("chapter"));
  const chapter =
    Number.isInteger(queryChapter) &&
    queryChapter >= 1 &&
    queryChapter <= book.chapters
      ? queryChapter
      : query.get("book")
        ? 1
        : (savedResume?.chapter ?? resume.chapter);
  return (
    <>
      <PageHeading
        eyebrow="SLOW DOWN. LISTEN. DISCOVER."
        title="Time in the Word"
        description="A quiet space for the most meaningful part of your journey."
        action={
          <span className="soft-label">
            <BookOpen size={14} />
            World English Bible
          </span>
        }
      />
      <div className="reader-mission">
        <span className="eyebrow">DAY {day} MISSION</span>
        <div className="mission-chapters">
          {mission.chapters.map((c) => (
            <Link
              className={cn(
                "chapter-chip",
                state.chapters[c.key] && "complete",
                book.id === c.book && chapter === c.chapter && "selected",
              )}
              href={`/bible?day=${day}&book=${c.book}&chapter=${c.chapter}`}
              key={c.key}
            >
              {state.chapters[c.key] ? (
                <Check size={13} />
              ) : (
                <BookOpen size={13} />
              )}{" "}
              {BOOKS.find((b) => b.id === c.book)!.name} {c.chapter}
            </Link>
          ))}
        </div>
        {state.days[day] && (
          <span className="mission-done">
            <Check size={15} />
            Mission complete · 50 XP awarded
          </span>
        )}
      </div>
      <div className="reader-controls">
        <label>
          Book
          <select
            value={book.id}
            onChange={(e) =>
              router.push(`/bible?day=${day}&book=${e.target.value}&chapter=1`)
            }
          >
            {BOOKS.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chapter
          <select
            value={chapter}
            onChange={(e) =>
              router.push(
                `/bible?day=${day}&book=${book.id}&chapter=${e.target.value}`,
              )
            }
          >
            {Array.from({ length: book.chapters }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <Link href="/reading-plan" className="text-link">
          My reading plan <ChevronRight size={15} />
        </Link>
      </div>
      <ChapterReader
        key={`${book.id}.${chapter}`}
        book={book.id}
        chapter={chapter}
        day={day}
      />
    </>
  );
}
