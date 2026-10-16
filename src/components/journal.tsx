"use client";
import { useState } from "react";
import { NotebookPen, LockKeyhole, Check, ArrowRight } from "lucide-react";
import { useJourney, JourneyLoading } from "@/components/journey-provider";
import { PageHeading, EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { displayDate } from "@/lib/dates";
const prompts = [
  "What did I learn about God today?",
  "Which verse stood out to me?",
  "How can I apply this passage to my life?",
  "What should I pray about today?",
];
function Editor({ date, initial }: { date: string; initial: string }) {
  const { reflect, busy, state } = useJourney();
  const [text, setText] = useState(initial),
    [saved, setSaved] = useState(false);
  const valid = text.trim().length >= 20 && text.trim().length <= 10000;
  return (
    <section className="card journal-editor">
      <span className="eyebrow">{displayDate(date)}</span>
      <h2>Make room for reflection.</h2>
      <p className="muted">A thought, a prayer, a verse to carry with you.</p>
      <label htmlFor="reflection">Your reflection</label>
      <textarea
        id="reflection"
        maxLength={10000}
        rows={12}
        value={text}
        placeholder="Today, as I read, I noticed…"
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
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
            if (await reflect(date, text)) setSaved(true);
          }}
        >
          {saved ? <Check size={16} /> : <NotebookPen size={16} />}{" "}
          {busy ? "Saving…" : saved ? "Saved" : "Save reflection"}
        </Button>
      </div>
      <p className="small muted">
        {state?.reflections[date]
          ? "This entry is saved. You can return and edit it anytime; XP is awarded only once per date."
          : "A thoughtful reflection earns 20 participation XP, once per day."}
      </p>
    </section>
  );
}
export function Journal() {
  const { state, today } = useJourney();
  const [selected, setSelected] = useState<string | null>(null);
  if (!state) return <JourneyLoading />;
  const date = selected ?? today;
  const history = Object.entries(state.reflections).sort(([a], [b]) =>
    b.localeCompare(a),
  );
  return (
    <>
      <PageHeading
        eyebrow="A QUIET SPACE FOR YOUR HEART"
        title="Pause. Reflect. Grow."
        description="Notice what stays with you. Give your thoughts and prayers a place to land."
        action={
          <span className="soft-label">
            <LockKeyhole size={14} />
            Private in this browser
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
          <Editor
            key={date}
            date={date}
            initial={state.reflections[date]?.text ?? ""}
          />
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
            {history.length ? (
              <div className="entry-list">
                {history.map(([entryDate, entry]) => (
                  <button
                    aria-current={date === entryDate ? "true" : undefined}
                    className={`entry-preview ${date === entryDate ? "selected" : ""}`}
                    key={entryDate}
                    onClick={() => setSelected(entryDate)}
                  >
                    <strong>{displayDate(entryDate)}</strong>
                    <p>
                      {entry.text.slice(0, 100)}
                      {entry.text.length > 100 ? "…" : ""}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="Your story begins here">
                Your saved reflections will appear here, one meaningful moment
                at a time.
              </EmptyState>
            )}
          </section>
          <div className="privacy-note">
            <LockKeyhole size={19} />
            <p>
              Demo entries stay on this device. They are not encrypted or backed
              up. Avoid sensitive details on shared browsers. Export a copy from
              your profile to keep a backup.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
