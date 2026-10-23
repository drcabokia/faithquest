"use client";
import Link from "next/link";
import { VerseNoteEditor } from "./verse-note-editor";
import { useVerseNoteDrafts } from "./verse-note-drafts";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MemoryPractice } from "./memory-practice";
import { BookOpen, ChevronDown, Trash2, LockKeyhole, X } from "lucide-react";
import { useJourney, JourneyLoading } from "./journey-provider";
import { Button } from "./ui/button";
import { EmptyState, PageHeading } from "./ui/shared";
import { BOOKS, type BookId } from "@/data/books";
import { bibleContent } from "@/services/bible-content";
import { verseLabel, verseReference, SAVED_VERSE_LIMIT } from "@/lib/verses";

function SavedVerse({
  verseKey,
  expanded,
  onExpandedChange,
  selected,
  selectionFull,
  onSelect,
}: {
  verseKey: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  selected: boolean;
  selectionFull: boolean;
  onSelect: () => void;
}) {
  const { saveVerse, busy, state } = useJourney();
  const { drafts } = useVerseNoteDrafts();
  const hasNote = !!state?.verseNotes?.[verseKey];
  const { book, chapter, verse } = verseReference(verseKey);
  const [text, setText] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  const label = verseLabel(verseKey);
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
    <article className="saved-verse-row" aria-label={label}>
      <label className="study-row-choice">
        <input
          type="checkbox"
          checked={selected}
          disabled={!selected && selectionFull}
          onChange={onSelect}
          aria-describedby="practice-selection-count"
        />
        <span className="sr-only">Select {label} for practice</span>
      </label>
      <details
        className="saved-verse-details"
        open={expanded}
        onToggle={(event) => onExpandedChange(event.currentTarget.open)}
      >
        <summary
          aria-label={`Details for ${label}`}
          aria-describedby={
            hasNote || drafts[verseKey]
              ? `verse-note-status-${verseKey}`
              : undefined
          }
        >
          <div className="saved-verse-overview">
            <h2>{label}</h2>
            <p className="saved-verse-preview">
              {error
                ? "Scripture unavailable · open to retry"
                : text
                  ? text.length > 120
                    ? `${text.slice(0, 120)}…`
                    : text
                  : "Loading Scripture…"}
            </p>
            {(hasNote || drafts[verseKey]) && (
              <span
                className="saved-verse-note-status"
                id={`verse-note-status-${verseKey}`}
              >
                {drafts[verseKey] ? "Unsaved note draft" : "Private note"}
              </span>
            )}
          </div>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        {expanded && (
          <div className="saved-verse-body">
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
              <div className="memory-text">
                <blockquote>{text}</blockquote>
              </div>
            )}
            <div className="saved-verse-actions">
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
                onClick={() =>
                  void saveVerse(book as BookId, chapter, verse, false)
                }
              >
                <Trash2 size={16} />
                Remove
              </Button>
            </div>
            {(hasNote || drafts[verseKey]) && (
              <p className="small muted">
                {drafts[verseKey]
                  ? "Save or discard your note draft before removing this verse."
                  : "Delete the private note before removing this verse."}
              </p>
            )}
            <VerseNoteEditor verseKey={verseKey} />
          </div>
        )}
      </details>
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
  const [selection, setSelection] = useState<
    { key: string; savedAt: string }[]
  >([]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const startButton = useRef<HTMLDivElement>(null);
  const practiceHeading = useRef<HTMLHeadingElement>(null);
  // Next.js can hide a retained route instead of unmounting it. Practice is
  // deliberately temporary, so clear the queue when Activity hides this page.
  useLayoutEffect(
    () => () => {
      setPracticeKeys(null);
      setSelection([]);
    },
    [],
  );
  if (!state) return <JourneyLoading />;
  const saved = Object.entries(state.savedVerses ?? {});
  // A removed/re-saved verse must be selected again. Selection is temporary;
  // it never changes the saved collection or survives leaving this page.
  const selectedKeys = selection
    .filter(({ key, savedAt }) => state.savedVerses?.[key] === savedAt)
    .map(({ key }) => key);
  const toggleSelection = (key: string) =>
    setSelection((current) => {
      const valid = current.filter(
        (item) => state.savedVerses?.[item.key] === item.savedAt,
      );
      return valid.some((item) => item.key === key)
        ? valid.filter((item) => item.key !== key)
        : valid.length < 5
          ? [...valid, { key, savedAt: state.savedVerses![key] }]
          : valid;
    });
  const expand = (key: string, open: boolean) =>
    setExpandedKeys((current) =>
      !!current[key] === open ? current : { ...current, [key]: open },
    );
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
      <div className="study-toolbar">
        <details className="study-help">
          <summary>How practice works</summary>
          <p>
            Save verses in the Bible Reader, then select up to five here.
            Practice follows your selection order. Selections stay visible below
            when you filter or change pages.
          </p>
          <p>
            Read, hide, use first-letter hints or compare your recall with the
            exact WEB wording. Practice earns no XP. Your selection and typed
            recall are temporary and never saved or sent.
          </p>
          <p>
            Saved verses and notes are private and included in your exports.
            Unsaved note drafts stay in this tab; save them before closing or
            reloading.
          </p>
        </details>
        <Button asChild>
          <Link href="/bible">
            <BookOpen size={17} />
            Find a verse
          </Link>
        </Button>
      </div>
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
                  expand(key, true);
                  requestAnimationFrame(() =>
                    document.getElementById(`verse-note-${key}`)?.focus(),
                  );
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
      {saved.length > 0 || practiceKeys ? (
        <>
          {practiceKeys ? (
            <MemoryPractice
              verseKeys={practiceKeys}
              savedVerses={state.savedVerses ?? {}}
              onEnd={() => {
                setPracticeKeys(null);
                requestAnimationFrame(() => {
                  const button =
                    startButton.current?.querySelector<HTMLButtonElement>(
                      "[data-start-practice]",
                    );
                  if (button?.disabled) practiceHeading.current?.focus();
                  else button?.focus();
                });
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
                className="practice-selection"
                aria-label="Choose verses for memory practice"
              >
                <div>
                  <h2 ref={practiceHeading} tabIndex={-1}>
                    Memory practice
                  </h2>
                  <p
                    className="small muted"
                    id="practice-selection-count"
                    role="status"
                  >
                    {selectedKeys.length} of 5 selected
                    {selectedKeys.length === 0
                      ? " · Select verses below"
                      : " · In selection order"}
                  </p>
                </div>
                <div className="practice-selection-actions" ref={startButton}>
                  {selectedKeys.length > 0 && (
                    <Button variant="ghost" onClick={() => setSelection([])}>
                      Clear selection
                    </Button>
                  )}
                  <Button
                    data-start-practice
                    disabled={!selectedKeys.length}
                    onClick={() => setPracticeKeys(selectedKeys)}
                  >
                    Start practice
                  </Button>
                </div>
                {selectedKeys.length > 0 && (
                  <ol
                    className="practice-selected-verses"
                    aria-label="Selected practice verses"
                  >
                    {selectedKeys.map((key) => (
                      <li key={key}>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Deselect ${verseLabel(key)}`}
                          onClick={() => toggleSelection(key)}
                        >
                          {verseLabel(key)} <X size={14} aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              {filtered.length ? (
                <ul
                  className="card saved-verses-list"
                  aria-label="Saved verses"
                >
                  {filtered
                    .slice(currentPage * 12, (currentPage + 1) * 12)
                    .map(([key]) => (
                      <li key={key}>
                        <SavedVerse
                          verseKey={key}
                          expanded={!!expandedKeys[key]}
                          onExpandedChange={(open) => expand(key, open)}
                          selected={selectedKeys.includes(key)}
                          selectionFull={selectedKeys.length >= 5}
                          onSelect={() => toggleSelection(key)}
                        />
                      </li>
                    ))}
                </ul>
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
