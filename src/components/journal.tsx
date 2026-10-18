"use client";
import { useState } from "react";
import { NotebookPen, LockKeyhole, Check, ArrowRight } from "lucide-react";
import { useJourney, JourneyLoading } from "@/components/journey-provider";
import { PageHeading, EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { displayDate } from "@/lib/dates";
import { JOURNAL_CATEGORIES, type JournalCategory } from "@/lib/journal";
import { useJournalDrafts } from "./journal-drafts";
const prompts = [
  "What did I learn about God today?",
  "Which verse stood out to me?",
  "How can I apply this passage to my life?",
  "What should I pray about today?",
];
const categoryPrompts: Record<JournalCategory, string> = {
  reflection: "Today, as I read, I noticed…",
  prayer: "Today I pray for…",
  gratitude: "Today, I give thanks for…",
  application: "Today, I will put what I learned into practice by…",
};
function Editor({ date }: { date: string }) {
  const { reflect, busy, state } = useJourney();
  const { drafts, put, remove } = useJournalDrafts();
  const [saved, setSaved] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const entry = state?.reflections[date];
  const draft = drafts[date];
  const text = draft?.text ?? entry?.text ?? "";
  const category = draft?.category ?? entry?.category ?? "reflection";
  const changedElsewhere =
    draft &&
    (draft.text.trim() !== (entry?.text ?? "") ||
      draft.category !== (entry?.category ?? "reflection")) &&
    (draft.baseText !== (entry?.text ?? "") ||
      draft.baseCategory !== (entry?.category ?? "reflection"));
  const change = (nextText: string, nextCategory: JournalCategory) => {
    setSaved(false);
    setDiscarding(false);
    if (
      nextText === (entry?.text ?? "") &&
      nextCategory === (entry?.category ?? "reflection")
    )
      remove(date);
    else
      put(date, {
        text: nextText,
        category: nextCategory,
        baseText: draft?.baseText ?? entry?.text ?? "",
        baseCategory: draft?.baseCategory ?? entry?.category ?? "reflection",
      });
  };
  const valid = text.trim().length >= 20 && text.trim().length <= 10000;
  return (
    <section className="card journal-editor">
      <span className="eyebrow">{displayDate(date)}</span>
      <h2>Make room for reflection.</h2>
      <p className="muted">A thought, a prayer, a verse to carry with you.</p>
      <label htmlFor="reflection-category">Entry category</label>
      <select
        id="reflection-category"
        value={category}
        onChange={(e) => change(text, e.target.value as JournalCategory)}
      >
        {Object.entries(JOURNAL_CATEGORIES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {changedElsewhere && (
        <div className="journal-warning" role="status">
          <p>
            The saved entry changed while you were writing. Your draft is still
            here. Saving will replace that entry.
          </p>
          <details>
            <summary>Review the saved entry</summary>
            <p className="journal-saved-text">
              {entry?.text ?? "No saved entry"}
            </p>
            <p>{JOURNAL_CATEGORIES[entry?.category ?? "reflection"]}</p>
          </details>
        </div>
      )}
      <label htmlFor="reflection">Your reflection</label>
      <textarea
        id="reflection"
        maxLength={10000}
        rows={12}
        value={text}
        placeholder={categoryPrompts[category]}
        onChange={(e) => {
          change(e.target.value, category);
        }}
        aria-describedby="reflection-help"
      />
      <div className="editor-footer">
        <span id="reflection-help">
          {text.trim().length.toLocaleString()} / 10,000 characters · Minimum 20
        </span>
        <Button
          disabled={!valid || busy}
          onClick={async () => {
            const captured = draft;
            if (await reflect(date, text, category)) {
              if (captured) remove(date, captured);
              setSaved(true);
            }
          }}
        >
          {saved ? <Check size={16} /> : <NotebookPen size={16} />}{" "}
          {busy
            ? "Saving…"
            : saved && !draft
              ? "Saved"
              : changedElsewhere
                ? "Replace saved reflection"
                : "Save reflection"}
        </Button>
      </div>
      {draft && (
        <div className="journal-draft-actions">
          <p className="small muted" role="status">
            Unsaved draft in this tab. Save before closing, reloading or signing
            out.
          </p>
          {discarding ? (
            <div role="group" aria-label="Discard draft confirmation">
              <p>Discard your unsaved changes for this date?</p>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => {
                  remove(date);
                  setDiscarding(false);
                  setSaved(false);
                }}
              >
                Discard changes
              </Button>{" "}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDiscarding(false)}
              >
                Keep writing
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setDiscarding(true)}
            >
              Discard draft
            </Button>
          )}
        </div>
      )}
      <p className="small muted">
        {state?.reflections[date]
          ? "This entry is saved. You can return and edit it anytime; XP is awarded only once per date."
          : "A thoughtful reflection earns 20 participation XP, once per day."}
      </p>
    </section>
  );
}
export function Journal() {
  const { state, today, mode } = useJourney();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { drafts } = useJournalDrafts();
  if (!state) return <JourneyLoading />;
  const date = selected ?? today;
  const history = Object.entries(state.reflections)
    .filter(
      ([day, entry]) =>
        (filter === "all" || (entry.category ?? "reflection") === filter) &&
        `${day} ${displayDate(day)} ${entry.text}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(([a], [b]) => b.localeCompare(a));
  const pages = Math.max(1, Math.ceil(history.length / 10));
  const currentPage = Math.min(page, pages);
  return (
    <>
      <PageHeading
        eyebrow="A QUIET SPACE FOR YOUR HEART"
        title="Pause. Reflect. Grow."
        description="Notice what stays with you. Give your thoughts and prayers a place to land."
        action={
          <span className="soft-label">
            <LockKeyhole size={14} />
            {mode === "demo"
              ? "Private in this browser"
              : "Private to your account"}
          </span>
        }
      />
      <div className="journal-layout">
        <div>
          <div className="reflection-prompts">
            <span className="eyebrow">SOMETHING TO THINK ABOUT</span>
            <h2>
              {
                prompts[
                  (new Date(date + "T12:00Z").getUTCDate() - 1) % prompts.length
                ]
              }
            </h2>
            <p>There’s no perfect answer. Start with what’s on your heart.</p>
          </div>
          <Editor key={date} date={date} />
        </div>
        <aside>
          <section className="card journal-history">
            <div className="section-heading">
              <h2>Your reflections</h2>
              <NotebookPen size={19} />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelected(today)}
              disabled={date === today}
            >
              Today’s page <ArrowRight size={14} />
            </Button>
            {Object.keys(drafts).length > 0 && (
              <div
                className="journal-draft-list"
                aria-label="Unsaved journal drafts"
              >
                <h3>Unsaved drafts</h3>
                {Object.keys(drafts)
                  .sort()
                  .reverse()
                  .map((day) => (
                    <button
                      key={day}
                      className="entry-preview"
                      aria-current={date === day ? "true" : undefined}
                      onClick={() => setSelected(day)}
                    >
                      {displayDate(day)} · Draft
                    </button>
                  ))}
              </div>
            )}
            <div className="journal-filters">
              <label htmlFor="journal-search">Search reflections</label>
              <input
                id="journal-search"
                type="search"
                maxLength={200}
                value={search}
                placeholder="Words or date"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <label htmlFor="journal-filter">Filter by category</label>
              <select
                id="journal-filter"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All categories</option>
                {Object.entries(JOURNAL_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="small muted" role="status">
                {history.length}{" "}
                {history.length === 1 ? "reflection" : "reflections"} · Search
                stays in this browser.
              </p>
            </div>
            {history.length ? (
              <div className="entry-list">
                {history
                  .slice((currentPage - 1) * 10, currentPage * 10)
                  .map(([entryDate, entry]) => (
                    <button
                      aria-current={date === entryDate ? "true" : undefined}
                      className={`entry-preview ${date === entryDate ? "selected" : ""}`}
                      key={entryDate}
                      onClick={() => setSelected(entryDate)}
                    >
                      <strong>{displayDate(entryDate)}</strong>
                      <span className="journal-category">
                        {JOURNAL_CATEGORIES[entry.category ?? "reflection"]}
                        {drafts[entryDate] ? " · Draft" : ""}
                      </span>
                      <p>
                        {entry.text.slice(0, 100)}
                        {entry.text.length > 100 ? "…" : ""}
                      </p>
                    </button>
                  ))}
              </div>
            ) : (
              <EmptyState
                title={
                  Object.keys(state.reflections).length
                    ? "No matching reflections"
                    : "Your story begins here"
                }
              >
                {Object.keys(state.reflections).length
                  ? "Try different words, a date, or another category."
                  : "Your saved reflections will appear here, one meaningful moment at a time."}
              </EmptyState>
            )}
            {pages > 1 && (
              <nav className="journal-pagination" aria-label="Reflection pages">
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
          <div className="privacy-note">
            <LockKeyhole size={19} />
            <p>
              {mode === "demo"
                ? "Demo entries stay on this device. They are not encrypted or backed up. Avoid sensitive details on shared browsers. Export a copy from your profile to keep a backup."
                : "Your journal belongs to your signed-in account. It is never shared with fellow readers or groups. Sign out when using a shared device."}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
