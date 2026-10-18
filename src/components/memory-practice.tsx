"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, Lightbulb } from "lucide-react";
import type { BookId } from "@/data/books";
import { bibleContent } from "@/services/bible-content";
import { firstLetterHint, recallMatches } from "@/lib/memory-practice";
import { verseLabel, verseReference } from "@/lib/verses";
import { Button } from "./ui/button";

function PracticeVerse({
  verseKey,
  position,
  total,
  onNext,
}: {
  verseKey: string;
  position: number;
  total: number;
  onNext: () => void;
}) {
  const { book, chapter, verse } = verseReference(verseKey);
  const heading = useRef<HTMLHeadingElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [recalling, setRecalling] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hints, setHints] = useState(false);
  const [recall, setRecall] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    bibleContent
      .getChapter(book as BookId, chapter, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const value = data.verses.find((v) => v.number === verse)?.text;
        if (!value) throw new Error("Verse unavailable");
        setText(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [book, chapter, verse, retry]);

  function startRecall() {
    setRecalling(true);
    setRevealed(false);
    setHints(false);
    setRecall("");
    setResult(null);
  }

  return (
    <>
      <p className="eyebrow">
        VERSE {position} OF {total}
      </p>
      <h2 ref={heading} tabIndex={-1}>
        {verseLabel(verseKey)}
      </h2>
      <p className="small muted">World English Bible · Classic</p>
      {error ? (
        <div className="practice-feedback" role="alert">
          <p>Scripture could not be loaded. Try again or end this practice.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setError(false);
              setRetry((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : text === null ? (
        <p role="status">Loading Scripture…</p>
      ) : (
        <>
          <div className="memory-text" aria-live="polite">
            {!recalling || revealed ? (
              <blockquote>{text}</blockquote>
            ) : (
              <p className="memory-prompt">
                Recall the verse aloud, on paper, or in the optional box below.
              </p>
            )}
          </div>
          {!recalling ? (
            <Button onClick={startRecall}>Hide and recall</Button>
          ) : (
            <>
              <div className="saved-verse-actions">
                <Button
                  variant="secondary"
                  aria-expanded={hints}
                  aria-controls="practice-hints"
                  onClick={() => setHints(!hints)}
                >
                  <Lightbulb size={16} />
                  {hints ? "Hide hints" : "Show first-letter hints"}
                </Button>
                {!revealed && (
                  <Button variant="secondary" onClick={() => setRevealed(true)}>
                    <Eye size={16} />
                    Reveal verse
                  </Button>
                )}
                {revealed && (
                  <Button variant="secondary" onClick={startRecall}>
                    Try recall again
                  </Button>
                )}
              </div>
              <div id="practice-hints">
                {hints && (
                  <div className="practice-feedback">
                    <p className="small muted">
                      First-letter hints · practice aid
                    </p>
                    <p className="practice-hints">{firstLetterHint(text)}</p>
                  </div>
                )}
              </div>
              <form
                className="practice-recall"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!recall.trim()) return;
                  setResult(recallMatches(recall, text));
                  setRevealed(true);
                }}
              >
                <label htmlFor="practice-recall">Your recall (optional)</label>
                <textarea
                  id="practice-recall"
                  rows={5}
                  maxLength={10000}
                  value={recall}
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="off"
                  aria-describedby="practice-comparison-help"
                  onChange={(event) => {
                    setRecall(event.target.value);
                    setResult(null);
                  }}
                />
                <p id="practice-comparison-help" className="small muted">
                  Compare words in order, ignoring capitalization, punctuation
                  and spacing. This checks wording only. Your typing is cleared
                  when you leave this verse.
                </p>
                <Button
                  variant="secondary"
                  type="submit"
                  disabled={!recall.trim()}
                >
                  Compare wording
                </Button>
                {result !== null && (
                  <p className="practice-feedback" role="status">
                    {result
                      ? "The words match the WEB verse in order."
                      : "Some words differ. Compare your recall with the WEB verse above, then try again when ready."}
                  </p>
                )}
              </form>
            </>
          )}
          <div className="practice-next">
            <Button onClick={onNext}>
              {position === total ? "Finish practice" : "Next verse"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </>
      )}
    </>
  );
}

export function MemoryPractice({
  verseKeys,
  savedVerses,
  onEnd,
}: {
  verseKeys: string[];
  savedVerses: Record<string, string>;
  onEnd: () => void;
}) {
  const [position, setPosition] = useState(0);
  const collectionChanged = verseKeys.some(
    (key) => !Object.hasOwn(savedVerses, key),
  );
  return (
    <section
      className="card memory-practice"
      aria-label="Guided memory practice"
    >
      {collectionChanged ? (
        <div role="status">
          <h2>Your saved collection changed</h2>
          <p>
            One of these verses was removed. Return to your collection to start
            a new practice.
          </p>
        </div>
      ) : position >= verseKeys.length ? (
        <div role="status">
          <h2>Practice finished</h2>
          <p>
            You reached the end of this {verseKeys.length}-verse queue. Return
            whenever you want to practise again.
          </p>
        </div>
      ) : (
        <PracticeVerse
          key={verseKeys[position]}
          verseKey={verseKeys[position]}
          position={position + 1}
          total={verseKeys.length}
          onNext={() => setPosition((value) => value + 1)}
        />
      )}
      <p className="small muted practice-privacy">
        Unscored practice · no XP. Typed recall stays in memory and is never
        saved or sent.
      </p>
      <Button variant="ghost" onClick={onEnd}>
        {collectionChanged || position >= verseKeys.length
          ? "Return to saved verses"
          : "End practice"}
      </Button>
    </section>
  );
}
