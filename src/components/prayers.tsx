"use client";
import { useLayoutEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useJourney, JourneyLoading } from "./journey-provider";
import { usePrayerDrafts, type PrayerDraft } from "./prayer-drafts";
import { Button } from "./ui/button";
import { PageHeading } from "./ui/shared";
import {
  PRAYER_LIMIT,
  FOLLOW_UP_LIMIT,
  PRAYER_STATUS_LABELS,
  prayerDetailsSchema,
  followUpSchema,
  type PrayerStatus,
} from "@/lib/prayers";
const followKey = (id: string) => `follow:${id}`;
export function Prayers() {
  const { state, today, busy, changePrayer } = useJourney();
  const { drafts, put, remove } = usePrayerDrafts();
  const [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0);
  const [discarding, setDiscarding] = useState<string | null>(null),
    [deleting, setDeleting] = useState<string | null>(null);
  useLayoutEffect(
    () => () => {
      setDiscarding(null);
      setDeleting(null);
    },
    [],
  );
  if (!state) return <JourneyLoading />;
  const prayers = state.prayers ?? {};
  const entry = selected ? prayers[selected] : undefined;
  const draft = selected
    ? (drafts[selected] ?? drafts[followKey(selected)])
    : undefined;
  const draftKey = draft
    ? draft.kind === "request"
      ? draft.id
      : followKey(draft.id)
    : null;
  const missing = !!draft && draft.baseRevision !== null && !entry;
  const changed = !!draft && draft.baseRevision !== (entry?.revision ?? null);
  const query = search.trim().toLocaleLowerCase();
  const matches = Object.entries(prayers)
    .filter(
      ([, p]) =>
        (filter === "all" || p.status === filter) &&
        (!query ||
          [
            p.title,
            p.text,
            ...Object.values(p.followUps).flatMap((n) => [n.text, n.date]),
          ].some((t) => t.toLocaleLowerCase().includes(query))),
    )
    .sort(
      (a, b) =>
        b[1].updatedAt.localeCompare(a[1].updatedAt) ||
        a[0].localeCompare(b[0]),
    );
  const last = Math.max(0, Math.ceil(matches.length / 10) - 1),
    currentPage = Math.min(page, last);
  const closeDialogs = () => {
    setDiscarding(null);
    setDeleting(null);
  };
  const editRequest = () => {
    if (!selected || !entry) return;
    put(selected, {
      kind: "request",
      id: selected,
      title: entry.title,
      text: entry.text,
      status: entry.status,
      baseRevision: entry.revision,
    });
    closeDialogs();
  };
  const update = (value: Partial<PrayerDraft>) => {
    if (draft && draftKey) {
      put(draftKey, { ...draft, ...value } as PrayerDraft);
      closeDialogs();
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="A PRIVATE SPACE FOR PRAYER"
        title="Prayer Requests"
        description="Bring your concerns, remember your prayers, and record your own follow-ups."
      />
      <p className="small muted">
        Requests and follow-ups stay private to you and are never shared with
        fellowship groups. Prayer activity earns no XP. You choose when a
        request is answered.
      </p>
      <div className="card prayer-toolbar">
        <Button
          disabled={busy || Object.keys(prayers).length >= PRAYER_LIMIT}
          onClick={() => {
            const id = crypto.randomUUID();
            put(id, {
              kind: "request",
              id,
              title: "",
              text: "",
              status: "ongoing",
              baseRevision: null,
            });
            setSelected(id);
            closeDialogs();
          }}
        >
          <Heart size={16} /> New prayer request
        </Button>
        <p className="small muted">
          {Object.keys(prayers).length} / {PRAYER_LIMIT} saved requests. Each
          request can have up to {FOLLOW_UP_LIMIT} dated follow-ups.
        </p>
        <label htmlFor="prayer-search">Search prayer requests</label>
        <input
          id="prayer-search"
          type="search"
          value={search}
          autoComplete="off"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <label htmlFor="prayer-filter">Filter by prayer status</label>
        <select
          id="prayer-filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All statuses</option>
          {Object.entries(PRAYER_STATUS_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {Object.keys(drafts).length > 0 && (
        <section
          className="card prayer-drafts"
          aria-label="Unsaved prayer drafts"
        >
          <h2>Unsaved prayer drafts</h2>
          <p className="small muted">
            Drafts survive internal navigation in this tab. Save before
            reloading, signing out or closing the browser.
          </p>
          {Object.entries(drafts).map(([key, d]) => (
            <Button
              key={key}
              variant="secondary"
              onClick={() => {
                setSelected(d.id);
                closeDialogs();
              }}
            >
              Continue{" "}
              {d.kind === "request"
                ? d.title || "untitled prayer"
                : `follow-up for ${prayers[d.id]?.title ?? "deleted prayer"}`}
            </Button>
          ))}
        </section>
      )}
      {selected && (
        <section className="card prayer-editor" aria-label="Prayer editor">
          <h2>{entry?.title ?? "New prayer request"}</h2>
          {draft && draftKey ? (
            <>
              {changed && (
                <div className="journal-warning" role="status">
                  <p>
                    {missing
                      ? "This prayer was deleted elsewhere. Your draft is still here."
                      : "This prayer changed while you were writing. Review the saved version before continuing."}
                  </p>
                  {entry && (
                    <>
                      <details>
                        <summary>Review saved prayer</summary>
                        <h3>{entry.title}</h3>
                        <p className="personal-note-text">{entry.text}</p>
                        <p>{PRAYER_STATUS_LABELS[entry.status]}</p>
                        {Object.entries(entry.followUps).map(([id, n]) => (
                          <p className="personal-note-text" key={id}>
                            {n.date}: {n.text}
                          </p>
                        ))}
                      </details>
                      {draft.kind === "followUp" &&
                        entry.followUps[draft.followUpId] &&
                        (entry.followUps[draft.followUpId].text !==
                          draft.text.trim() ||
                          entry.followUps[draft.followUpId].date !==
                            draft.date) && (
                          <p>
                            This follow-up is already saved. Keeping this edited
                            draft will add a separate follow-up.
                          </p>
                        )}
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          // A follow-up committed before a lost reply must keep its stable ID for
                          // retry. After explicit review, edited wording starts a separate note.
                          const next =
                            draft.kind === "followUp" &&
                            entry.followUps[draft.followUpId] &&
                            (entry.followUps[draft.followUpId].text !==
                              draft.text.trim() ||
                              entry.followUps[draft.followUpId].date !==
                                draft.date)
                              ? { ...draft, followUpId: crypto.randomUUID() }
                              : draft;
                          put(draftKey, {
                            ...next,
                            baseRevision: entry.revision,
                          });
                        }}
                      >
                        Keep my draft against this version
                      </Button>
                    </>
                  )}
                  {missing && draft.kind === "request" && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        const id = crypto.randomUUID();
                        put(id, { ...draft, id, baseRevision: null });
                        remove(draftKey, draft);
                        setSelected(id);
                      }}
                    >
                      Save as a new prayer
                    </Button>
                  )}
                  {missing && draft.kind === "followUp" && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        const id = crypto.randomUUID();
                        put(id, {
                          kind: "request",
                          id,
                          title:
                            "Recovered prayer follow-up (" + draft.date + ")",
                          text: draft.text,
                          status: "ongoing",
                          baseRevision: null,
                        });
                        remove(draftKey, draft);
                        setSelected(id);
                      }}
                    >
                      Recover as a new prayer
                    </Button>
                  )}
                </div>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (changed || missing || busy) return;
                  const captured = draft;
                  const success =
                    draft.kind === "request"
                      ? await changePrayer(
                          draft.id,
                          {
                            action: "save",
                            value: {
                              title: draft.title,
                              text: draft.text,
                              status: draft.status,
                            },
                          },
                          draft.baseRevision,
                        )
                      : await changePrayer(
                          draft.id,
                          {
                            action: "followUp",
                            value: {
                              id: draft.followUpId,
                              text: draft.text,
                              date: draft.date,
                            },
                          },
                          draft.baseRevision,
                        );
                  if (success) remove(draftKey, captured);
                }}
              >
                {draft.kind === "request" ? (
                  <>
                    <label htmlFor="prayer-title">Prayer title</label>
                    <input
                      id="prayer-title"
                      maxLength={240}
                      autoComplete="off"
                      value={draft.title}
                      onChange={(e) => update({ title: e.target.value })}
                    />
                    <label htmlFor="prayer-text">Your prayer request</label>
                    <textarea
                      id="prayer-text"
                      rows={6}
                      maxLength={4000}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Today, I pray for…"
                      value={draft.text}
                      onChange={(e) => update({ text: e.target.value })}
                    />
                    <p className="small muted">
                      {Array.from(draft.title.trim()).length} / 120 title
                      characters · {Array.from(draft.text.trim()).length} /
                      2,000 request characters
                    </p>
                    <label htmlFor="prayer-status">Prayer status</label>
                    <select
                      id="prayer-status"
                      value={draft.status}
                      onChange={(e) =>
                        update({ status: e.target.value as PrayerStatus })
                      }
                    >
                      {Object.entries(PRAYER_STATUS_LABELS).map(
                        ([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </>
                ) : (
                  <>
                    <label htmlFor="prayer-follow-date">Follow-up date</label>
                    <input
                      id="prayer-follow-date"
                      type="date"
                      max={today}
                      value={draft.date}
                      disabled={busy}
                      onChange={(e) => update({ date: e.target.value })}
                    />
                    <label htmlFor="prayer-follow-text">Your follow-up</label>
                    <textarea
                      id="prayer-follow-text"
                      rows={4}
                      maxLength={2000}
                      autoComplete="off"
                      spellCheck={false}
                      value={draft.text}
                      disabled={busy}
                      onChange={(e) => update({ text: e.target.value })}
                    />
                    <p className="small muted">
                      {Array.from(draft.text.trim()).length} / 1,000 characters.
                      Dates use your journey timezone.
                    </p>
                  </>
                )}
                <div className="saved-verse-actions">
                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      changed ||
                      missing ||
                      (draft.kind === "request"
                        ? !prayerDetailsSchema.safeParse({
                            title: draft.title,
                            text: draft.text,
                            status: draft.status,
                          }).success
                        : !followUpSchema.safeParse({
                            text: draft.text,
                            date: draft.date,
                          }).success || draft.date > today)
                    }
                  >
                    {draft.kind === "request"
                      ? "Save prayer request"
                      : "Save follow-up"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setDiscarding(draftKey)}
                  >
                    Discard prayer draft
                  </Button>
                </div>
              </form>
              <p className="small muted" role="status">
                Unsaved prayer draft. Changes are saved only when you choose
                Save.
              </p>
              {discarding === draftKey && (
                <div role="group" aria-label="Discard prayer draft">
                  <p>Discard these unsaved changes?</p>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      remove(draftKey, draft);
                      setDiscarding(null);
                      if (!entry) setSelected(null);
                    }}
                  >
                    Discard prayer changes
                  </Button>{" "}
                  <Button variant="ghost" onClick={() => setDiscarding(null)}>
                    Keep writing
                  </Button>
                </div>
              )}
            </>
          ) : entry ? (
            <>
              <p>{PRAYER_STATUS_LABELS[entry.status]}</p>
              <p className="personal-note-text">{entry.text}</p>
              <div className="saved-verse-actions">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={editRequest}
                >
                  Edit prayer request
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    busy ||
                    Object.keys(entry.followUps).length >= FOLLOW_UP_LIMIT
                  }
                  onClick={() => {
                    put(followKey(selected), {
                      kind: "followUp",
                      id: selected,
                      followUpId: crypto.randomUUID(),
                      text: "",
                      date: today,
                      baseRevision: entry.revision,
                    });
                    closeDialogs();
                  }}
                >
                  Add follow-up
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setDeleting(entry.revision)}
                >
                  Delete prayer request
                </Button>
              </div>
              {deleting && (
                <div role="group" aria-label="Delete prayer request">
                  <p>
                    Delete this prayer and all its follow-ups permanently? Keep
                    a private export first if you need a copy.
                  </p>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await changePrayer(
                          selected,
                          { action: "delete", value: {} },
                          deleting,
                        )
                      ) {
                        setSelected(null);
                        setDeleting(null);
                      }
                    }}
                  >
                    Delete prayer permanently
                  </Button>{" "}
                  <Button variant="ghost" onClick={() => setDeleting(null)}>
                    Keep prayer
                  </Button>
                </div>
              )}
              <h3>Dated follow-ups</h3>
              {Object.keys(entry.followUps).length === 0 ? (
                <p className="muted">No follow-ups yet.</p>
              ) : (
                Object.entries(entry.followUps)
                  .sort(
                    (a, b) =>
                      b[1].date.localeCompare(a[1].date) ||
                      a[0].localeCompare(b[0]),
                  )
                  .map(([id, n]) => (
                    <div key={id} className="prayer-follow-up">
                      <time dateTime={n.date}>{n.date}</time>
                      <p className="personal-note-text">{n.text}</p>
                    </div>
                  ))
              )}
            </>
          ) : (
            <p>
              This prayer is no longer saved. Choose another request or start a
              new one.
            </p>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setSelected(null);
              closeDialogs();
            }}
          >
            Close prayer editor
          </Button>
        </section>
      )}
      <section aria-label="Saved prayer requests">
        <h2>Your saved requests</h2>
        <p className="small muted">{matches.length} matching requests</p>
        <div className="prayer-list">
          {matches
            .slice(currentPage * 10, currentPage * 10 + 10)
            .map(([id, p]) => (
              <article className="card" key={id} aria-label={p.title}>
                <p className="eyebrow">{PRAYER_STATUS_LABELS[p.status]}</p>
                <h3>{p.title}</h3>
                <p className="personal-note-text prayer-excerpt">{p.text}</p>
                <p className="small muted">
                  {Object.keys(p.followUps).length} follow-ups
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelected(id);
                    closeDialogs();
                  }}
                >
                  Open prayer
                </Button>
              </article>
            ))}
        </div>
        {!matches.length && (
          <p className="card">
            {Object.keys(prayers).length
              ? "No requests match these filters."
              : "Your prayer list is ready. Add your first request when you are ready."}
          </p>
        )}
        {last > 0 && (
          <div className="saved-verse-actions">
            <Button
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous prayer page
            </Button>
            <span>
              Page {currentPage + 1} of {last + 1}
            </span>
            <Button
              variant="secondary"
              disabled={currentPage === last}
              onClick={() => setPage(currentPage + 1)}
            >
              Next prayer page
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
