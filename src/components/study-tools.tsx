"use client";
import Link from "next/link";
import { VerseNoteEditor } from "./verse-note-editor";
import { useVerseNoteDrafts } from "./verse-note-drafts";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MemoryPractice } from "./memory-practice";
import {
  Bookmark,
  BookOpen,
  Eye,
  EyeOff,
  Trash2,
  LockKeyhole,
} from "lucide-react";
import { useJourney, JourneyLoading } from "./journey-provider";
import { Button } from "./ui/button";
import { EmptyState, PageHeading } from "./ui/shared";
import { BOOKS, type BookId } from "@/data/books";
import { bibleContent } from "@/services/bible-content";
import { verseLabel, verseReference, SAVED_VERSE_LIMIT } from "@/lib/verses";

function SavedVerse({ verseKey }: { verseKey: string }) {
  const { saveVerse, busy, state } = useJourney();
  const { drafts } = useVerseNoteDrafts();
  const hasNote = !!state?.verseNotes?.[verseKey];
  const { book, chapter, verse } = verseReference(verseKey);
  const [text, setText] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [hidden, setHidden] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    bibleContent
      .getChapter(book as BookId, chapter, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const verseText = data.verses.find((v) => v.number === verse)?.text;
        if (!verseText)
          throw new Error("This verse is unavailable in the bundled edition.");
        setText(verseText);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "Scripture could not be loaded.",
          );
      });
    return () => controller.abort();
  }, [book, chapter, verse, retry]);
  return (
    <article
      className="card saved-verse-card"
      aria-label={verseLabel(verseKey)}
    >
      <div className="section-heading">
        <h2>{verseLabel(verseKey)}</h2>
        <Bookmark size={20} />
      </div>
      <p className="eyebrow">WORLD ENGLISH BIBLE · CLASSIC</p>
      {error ? (
        <div role="alert">
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
      ) : !text ? (
        <p role="status">Loading Scripture…</p>
      ) : (
        <div
          className="memory-text"
          id={`memory-${verseKey}`}
          aria-live="polite"
        >
          {hidden ? (
            <p className="memory-prompt">
              Try recalling this verse. Say it aloud or write it on paper, then
              reveal the text to check.
            </p>
          ) : (
            <blockquote>{text}</blockquote>
          )}
        </div>
      )}
      <div className="saved-verse-actions">
        <Button
          variant="secondary"
          disabled={!text || !!error}
          aria-expanded={!hidden}
          aria-controls={`memory-${verseKey}`}
          onClick={() => setHidden((value) => !value)}
        >
          {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
          {hidden ? "Show verse" : "Hide verse to practise"}
        </Button>
        <Link
          className="text-link"
          href={`/bible?book=${book}&chapter=${chapter}#verse-${verse}`}
        >
          <BookOpen size={16} />
          Read in context
        </Link>
        <Button
          variant="ghost"
          disabled={busy || hasNote || !!drafts[verseKey]}
          onClick={() => void saveVerse(book as BookId, chapter, verse, false)}
        >
          <Trash2 size={16} />
          Remove
        </Button>
      </div>
      {(hasNote || drafts[verseKey]) && (
        <p className="small muted">
          Save or discard your draft, then delete the note before removing this
          verse.
        </p>
      )}
      <VerseNoteEditor verseKey={verseKey} />
    </article>
  );
}
export function StudyTools() {
  const { state, mode } = useJourney();
  const { drafts } = useVerseNoteDrafts();
  const [query, setQuery] = useState(""),
    [book, setBook] = useState(""),
    [sort, setSort] = useState("recent"),
    [page, setPage] = useState(0);
  const [practiceKeys, setPracticeKeys] = useState<string[] | null>(null);
  const [practiceSize, setPracticeSize] = useState(3);
  const startButton = useRef<HTMLDivElement>(null);
  // Next.js can hide a retained route instead of unmounting it. Practice is
  // deliberately temporary, so clear the queue when Activity hides this page.
  useLayoutEffect(() => () => setPracticeKeys(null), []);
  if (!state) return <JourneyLoading />;
  const saved = Object.entries(state.savedVerses ?? {});
  const filtered = saved
    .filter(
      ([key]) =>
        (!book || key.startsWith(`${book}.`)) &&
        verseLabel(key)
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort(([a, at], [b, bt]) => {
      if (sort === "recent" && at !== bt) return bt.localeCompare(at);
      const aa = verseReference(a),
        bb = verseReference(b);
      return (
        BOOKS.findIndex((v) => v.id === aa.book) -
          BOOKS.findIndex((v) => v.id === bb.book) ||
        aa.chapter - bb.chapter ||
        aa.verse - bb.verse
      );
    });
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages - 1);
  return (
    <>
      <PageHeading
        eyebrow="KEEP A VERSE CLOSE"
        title="Saved verses & memory practice"
        description="Return to passages that stay with you, and practise recalling their words at your own pace."
        action={
          <span className="soft-label">
            <LockKeyhole size={14} />
            {mode === "demo"
              ? "Private in this browser"
              : "Private to your account"}
          </span>
        }
      />
      <section className="card study-intro">
        <div>
          <h2>Your personal verse collection</h2>
          <p>
            Save a verse using the verse selector in the Bible Reader. Read it
            here, or start a short guided practice with first-letter hints and
            an optional typed recall check.
          </p>
          <p className="small muted">
            Practice is unscored and does not change XP, reading progress or
            streaks. Scripture words come from the bundled WEB text. Saved
            verses are included in your private exports.
          </p>
        </div>
        <Button asChild>
          <Link href="/bible">
            <BookOpen size={17} />
            Find a verse
          </Link>
        </Button>
      </section>
      {Object.keys(drafts).length > 0 && (
        <section
          className="card verse-note-draft-list"
          aria-label="Unsaved verse notes"
        >
          <h2>Unsaved verse notes in this tab</h2>
          {Object.keys(drafts)
            .filter((key) => Object.hasOwn(state.savedVerses ?? {}, key))
            .map((key) => (
              <Button
                key={key}
                variant="secondary"
                onClick={() => {
                  setPracticeKeys(null);
                  setQuery(verseLabel(key));
                  setBook("");
                  setPage(0);
                }}
              >
                Continue note: {verseLabel(key)}
              </Button>
            ))}
          {Object.keys(drafts)
            .filter((key) => !Object.hasOwn(state.savedVerses ?? {}, key))
            .map((key) => (
              <section key={key}>
                <h3>{verseLabel(key)}</h3>
                <VerseNoteEditor verseKey={key} />
              </section>
            ))}
        </section>
      )}
      {saved.length > 0 ? (
        <>
          {practiceKeys ? (
            <MemoryPractice
              verseKeys={practiceKeys}
              savedVerses={state.savedVerses ?? {}}
              onEnd={() => {
                setPracticeKeys(null);
                requestAnimationFrame(() =>
                  startButton.current?.querySelector("button")?.focus(),
                );
              }}
            />
          ) : (
            <>
              <div className="study-filters">
                <div className="study-filter">
                  <label htmlFor="verse-search">Find a reference</label>
                  <input
                    id="verse-search"
                    type="search"
                    value={query}
                    placeholder="For example, John 3:16"
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <div className="study-filter">
                  <label htmlFor="verse-book">Book</label>
                  <select
                    id="verse-book"
                    value={book}
                    onChange={(e) => {
                      setBook(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">All books</option>
                    {BOOKS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="study-filter">
                  <label htmlFor="verse-sort">Order</label>
                  <select
                    id="verse-sort"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="recent">Recently saved</option>
                    <option value="bible">Bible order</option>
                  </select>
                </div>
              </div>
              <p className="small muted">
                {saved.length} of {SAVED_VERSE_LIMIT.toLocaleString()} saved
                verses · {filtered.length} matching references
              </p>
              <section
                className="card practice-launch"
                aria-label="Start guided memory practice"
              >
                <div>
                  <h2>A few verses at your own pace</h2>
                  <p>
                    Practise the first matching verses in your chosen order.
                    Read, hide, use hints or compare your recall with the WEB
                    wording.
                  </p>
                  <p className="small muted">
                    Typed recall is temporary and never saved or sent. Practice
                    earns no XP.
                  </p>
                </div>
                <div className="practice-launch-controls" ref={startButton}>
                  <label htmlFor="practice-size">Verses per practice</label>
                  <select
                    id="practice-size"
                    value={practiceSize}
                    onChange={(event) =>
                      setPracticeSize(Number(event.target.value))
                    }
                  >
                    <option value={1}>Up to 1 verse</option>
                    <option value={3}>Up to 3 verses</option>
                    <option value={5}>Up to 5 verses</option>
                  </select>
                  <Button
                    disabled={!filtered.length}
                    onClick={() =>
                      setPracticeKeys(
                        filtered.slice(0, practiceSize).map(([key]) => key),
                      )
                    }
                  >
                    Start practice
                  </Button>
                </div>
              </section>
              {filtered.length ? (
                <div className="saved-verses-grid">
                  {filtered
                    .slice(currentPage * 12, (currentPage + 1) * 12)
                    .map(([key]) => (
                      <SavedVerse key={key} verseKey={key} />
                    ))}
                </div>
              ) : (
                <EmptyState title="No matching saved verses">
                  Try another reference or choose All books.
                </EmptyState>
              )}
              {pages > 1 && (
                <nav
                  className="study-pagination"
                  aria-label="Saved verses pages"
                >
                  <Button
                    variant="secondary"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous page
                  </Button>
                  <span>
                    Page {currentPage + 1} of {pages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={currentPage === pages - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next page
                  </Button>
                </nav>
              )}
            </>
          )}
        </>
      ) : (
        <section className="card">
          <EmptyState title="A place for the verses you want to remember">
            Open the Bible Reader and save your first verse. It will appear here
            for reading and memory practice.
          </EmptyState>
        </section>
      )}
      <p className="content-attribution">
        World English Bible Classic · Public domain.{" "}
        <a href="/bible/provenance.json" target="_blank" rel="noreferrer">
          Source record
        </a>
      </p>
    </>
  );
}
