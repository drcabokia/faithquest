"use client";
import { useState } from "react";
import type { BookId } from "@/data/books";
import { noteLength, VERSE_NOTE_LIMIT } from "@/lib/verse-notes";
import { verseLabel, verseReference } from "@/lib/verses";
import { useJourney } from "./journey-provider";
import { useVerseNoteDrafts } from "./verse-note-drafts";
import { Button } from "./ui/button";

export function VerseNoteEditor({ verseKey }: { verseKey: string }) {
  const { state, busy, saveNote, saveVerse } = useJourney();
  const { drafts, put, remove } = useVerseNoteDrafts();
  const [opened, setOpened] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const draft = drafts[verseKey];
  const entry = state?.verseNotes?.[verseKey];
  const current = entry?.text ?? null;
  const text = draft?.text ?? current ?? "";
  const saved = Object.hasOwn(state?.savedVerses ?? {}, verseKey);
  const changedElsewhere =
    !!draft && draft.baseText !== current && draft.text.trim() !== current;
  const valid =
    noteLength(text.trim()) > 0 && noteLength(text.trim()) <= VERSE_NOTE_LIMIT;
  const { book, chapter, verse } = verseReference(verseKey);
  const editing = opened || !!draft;
  const label = verseLabel(verseKey);
  return (
    <div className="verse-note-editor">
      <h3>Your private note</h3>
      <p className="small muted">
        Your own thoughts, separate from Scripture. Notes earn no XP and are
        never shared with groups.
      </p>
      {!saved && (
        <div className="journal-warning" role="status">
          <p>This verse is no longer saved. Your draft is still here.</p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void saveVerse(book as BookId, chapter, verse, true)}
          >
            Save verse again
          </Button>
        </div>
      )}
      {editing ? (
        <>
          {changedElsewhere && (
            <div className="journal-warning" role="status">
              <p>
                The saved note changed while you were writing. Review it before
                saving your draft.
              </p>
              <details>
                <summary>Review saved note</summary>
                <p className="personal-note-text">
                  {current ?? "No saved note"}
                </p>
              </details>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => put(verseKey, { text, baseText: current })}
              >
                Keep my draft against this version
              </Button>
            </div>
          )}
          <label htmlFor={`verse-note-${verseKey}`}>
            Private note for {label}
          </label>
          <textarea
            id={`verse-note-${verseKey}`}
            rows={5}
            maxLength={4000}
            value={text}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`verse-note-help-${verseKey}`}
            onChange={(event) => {
              setDiscarding(false);
              setDeleting(false);
              const value = event.target.value;
              // Even reverting to the current text is a newer draft while a
              // pending save may replace that current version.
              if (value === (current ?? "") && !busy) remove(verseKey);
              else
                put(verseKey, {
                  text: value,
                  baseText: draft ? draft.baseText : current,
                });
            }}
          />
          <p id={`verse-note-help-${verseKey}`} className="small muted">
            {noteLength(text.trim())} / {VERSE_NOTE_LIMIT.toLocaleString()}{" "}
            characters. Drafts stay in this tab until you save.
          </p>
          <div className="saved-verse-actions">
            <Button
              disabled={busy || !saved || !draft || !valid || changedElsewhere}
              onClick={async () => {
                if (!draft) return;
                const captured = draft;
                if (
                  await saveNote(
                    book as BookId,
                    chapter,
                    verse,
                    text,
                    captured.baseText,
                  )
                ) {
                  remove(verseKey, captured);
                  setOpened(false);
                }
              }}
            >
              Save private note
            </Button>
            {draft ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setDiscarding(true)}
              >
                Discard note draft
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setOpened(false)}>
                Close note editor
              </Button>
            )}
          </div>
          {draft && (
            <p className="small muted" role="status">
              Unsaved note draft. Save before closing or reloading this tab.
            </p>
          )}
          {discarding && (
            <div role="group" aria-label={`Discard note draft for ${label}`}>
              <p>Discard these unsaved note changes?</p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  remove(verseKey);
                  setDiscarding(false);
                  setOpened(false);
                }}
              >
                Discard note changes
              </Button>{" "}
              <Button variant="ghost" onClick={() => setDiscarding(false)}>
                Keep writing
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {entry && <p className="personal-note-text">{entry.text}</p>}
          <Button variant="secondary" onClick={() => setOpened(true)}>
            {entry ? "Edit private note" : "Add private note"}
          </Button>
        </>
      )}
      {entry && !draft && (
        <div className="note-delete">
          {deleting ? (
            <div role="group" aria-label={`Delete private note for ${label}`}>
              <p>Delete this saved note? The verse stays in your collection.</p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  if (
                    await saveNote(
                      book as BookId,
                      chapter,
                      verse,
                      null,
                      entry.text,
                    )
                  ) {
                    setDeleting(false);
                    setOpened(false);
                  }
                }}
              >
                Delete note permanently
              </Button>{" "}
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Keep note
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDeleting(true)}
            >
              Delete private note
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
