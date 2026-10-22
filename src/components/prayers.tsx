"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Plus } from "lucide-react";
import { dateInZone, displayDate } from "@/lib/dates";
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
  const listId = useId();
  const editorRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listSummaryRef = useRef<HTMLParagraphElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousView = useRef<{
    id: string | null;
    kind?: PrayerDraft["kind"];
  }>({ id: null });
  const draft = selected
    ? (drafts[selected] ?? drafts[followKey(selected)])
    : undefined;
  const draftKind = draft?.kind;
  useLayoutEffect(() => {
    const previous = previousView.current;
    if (selected) {
      if (selected !== previous.id || draftKind !== previous.kind) {
        const target = draftKind
          ? editorRef.current?.querySelector<HTMLInputElement>(
              "input, textarea",
            )
          : editorRef.current?.querySelector<HTMLHeadingElement>("h2");
        target?.focus();
      }
    } else if (previous.id) {
      (rowRefs.current.get(previous.id) ?? listSummaryRef.current)?.focus();
    }
    previousView.current = { id: selected, kind: draftKind };
  }, [selected, draftKind]);
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
  const draftKey = draft
    ? draft.kind === "request"
      ? draft.id
      : followKey(draft.id)
    : null;
  const missing = !!draft && draft.baseRevision !== null && !entry;
  const changed = !!draft && draft.baseRevision !== (entry?.revision ?? null);
  const query = search.trim().toLocaleLowerCase();
  // One row per identity: an unsaved draft resumes here instead of appearing twice.
  const ids = [
    ...new Set([
      ...Object.keys(prayers),
      ...Object.values(drafts).map((d) => d.id),
    ]),
  ];
  const matches = ids
    .map((id) => {
      const saved = prayers[id];
      const pending = drafts[id] ?? drafts[followKey(id)];
      const requestDraft = pending?.kind === "request" ? pending : undefined;
      const title =
        requestDraft?.title.trim() ||
        saved?.title ||
        (pending?.baseRevision ? "Deleted prayer" : "Untitled prayer");
      const text = requestDraft?.text ?? saved?.text ?? pending?.text ?? "";
      const status = requestDraft?.status ?? saved?.status;
      const label = pending
        ? pending.kind === "followUp"
          ? "Continue follow-up for " + title
          : "Continue " + title
        : "Open prayer: " + title;
      return { id, saved, pending, title, text, status, label };
    })
    .filter(
      ({ saved, pending, title, text, status }) =>
        (filter === "all" ||
          (filter === "drafts" ? !!pending : status === filter)) &&
        (!query ||
          [
            title,
            text,
            pending?.text ?? "",
            pending?.kind === "followUp" ? pending.date : "",
            ...Object.values(saved?.followUps ?? {}).flatMap((n) => [
              n.text,
              n.date,
            ]),
          ].some((value) => value.toLocaleLowerCase().includes(query))),
    )
    .sort((a, b) => {
      if (Boolean(a.saved) !== Boolean(b.saved)) return a.saved ? 1 : -1;
      return (
        (b.saved?.updatedAt ?? "").localeCompare(a.saved?.updatedAt ?? "") ||
        a.id.localeCompare(b.id)
      );
    });
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
        description="Your prayers and follow-ups, in one private place."
        action={
          !selected ? (
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
              <Plus size={18} aria-hidden="true" /> New prayer request
            </Button>
          ) : undefined
        }
      />
      {!selected && (
        <div className="prayer-toolbar">
          <div>
            <label htmlFor="prayer-search">Search prayer requests</label>
            <input
              id="prayer-search"
              ref={searchRef}
              type="search"
              placeholder="Search prayers and follow-ups"
              value={search}
              autoComplete="off"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div>
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
              {Object.entries(PRAYER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
              <option value="drafts">Unsaved drafts</option>
            </select>
          </div>
        </div>
      )}
      {selected && (
        <section
          ref={editorRef}
          className="card prayer-editor"
          aria-label="Prayer editor"
        >
          <Button
            className="prayer-back"
            variant="ghost"
            onClick={() => {
              setSelected(null);
              closeDialogs();
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to prayer requests
          </Button>
          <h2 tabIndex={-1}>
            {entry?.title ??
              (missing ? "Recover prayer draft" : "New prayer request")}
          </h2>
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
                    data-prayer-discard
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
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDiscarding(null);
                      editorRef.current
                        ?.querySelector<HTMLButtonElement>(
                          "[data-prayer-discard]",
                        )
                        ?.focus();
                    }}
                  >
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
              </div>
              <h3>
                Dated follow-ups{" "}
                <span className="muted small">
                  ({Object.keys(entry.followUps).length} / {FOLLOW_UP_LIMIT})
                </span>
              </h3>
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
              <div className="prayer-delete-actions">
                <Button
                  variant="ghost"
                  disabled={busy}
                  data-prayer-delete
                  onClick={() => setDeleting(entry.revision)}
                >
                  Delete prayer request
                </Button>
                {deleting && (
                  <div role="group" aria-label="Delete prayer request">
                    <p>
                      Delete this prayer and all its follow-ups permanently?
                      Keep a private export first if you need a copy.
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
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDeleting(null);
                        editorRef.current
                          ?.querySelector<HTMLButtonElement>(
                            "[data-prayer-delete]",
                          )
                          ?.focus();
                      }}
                    >
                      Keep prayer
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p>
              This prayer is no longer saved. Choose another request or start a
              new one.
            </p>
          )}
        </section>
      )}
      {!selected && (
        <section aria-label="Prayer request list">
          <div className="prayer-list-heading">
            <p
              ref={listSummaryRef}
              tabIndex={-1}
              className="small muted"
              role="status"
            >
              {matches.length} {matches.length === 1 ? "request" : "requests"}
              {filter !== "all" || query ? " found" : ""}
            </p>
            {(filter !== "all" || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                  setPage(0);
                  searchRef.current?.focus();
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <ul className="prayer-list" aria-label="Prayer requests">
            {matches
              .slice(currentPage * 10, currentPage * 10 + 10)
              .map(({ id, saved, pending, title, text, status, label }) => (
                <li key={id}>
                  <button
                    type="button"
                    className="prayer-row"
                    aria-label={label}
                    aria-describedby={
                      (status ? listId + id + "-status " : "") + listId + id
                    }
                    ref={(node) => {
                      if (node) rowRefs.current.set(id, node);
                      else rowRefs.current.delete(id);
                    }}
                    onClick={() => {
                      setSelected(id);
                      closeDialogs();
                    }}
                  >
                    <span className="prayer-row-copy">
                      <span className="prayer-row-heading">
                        <span className="prayer-row-title">{title}</span>
                        {status && (
                          <span
                            id={listId + id + "-status"}
                            className="prayer-status"
                            data-status={status}
                          >
                            {PRAYER_STATUS_LABELS[status]}
                          </span>
                        )}
                      </span>
                      <span className="prayer-row-preview">
                        {text || "Write your prayer request…"}
                      </span>
                      <span className="prayer-row-meta" id={listId + id}>
                        {pending && (
                          <span className="prayer-draft-label">
                            {saved
                              ? pending.kind === "followUp"
                                ? "Unsaved follow-up"
                                : "Unsaved changes"
                              : pending.baseRevision
                                ? "Draft · deleted elsewhere"
                                : "New draft"}
                          </span>
                        )}
                        {saved && (
                          <>
                            <time dateTime={saved.updatedAt}>
                              Last saved{" "}
                              {displayDate(
                                dateInZone(
                                  state.profile.timeZone,
                                  new Date(saved.updatedAt),
                                ),
                              )}
                            </time>
                            {Object.keys(saved.followUps).length > 0 && (
                              <span>
                                {Object.keys(saved.followUps).length}{" "}
                                {Object.keys(saved.followUps).length === 1
                                  ? "follow-up"
                                  : "follow-ups"}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
          </ul>
          {!matches.length && (
            <div className="prayer-empty">
              <p>
                {ids.length
                  ? "No requests match these filters."
                  : "Add your first prayer request when you’re ready."}
              </p>
            </div>
          )}
          {last > 0 && (
            <nav
              className="prayer-pagination"
              aria-label="Prayer request pages"
            >
              <Button
                variant="secondary"
                aria-label="Previous prayer page"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ArrowLeft size={16} aria-hidden="true" /> Previous
              </Button>
              <span>
                Page {currentPage + 1} of {last + 1}
              </span>
              <Button
                variant="secondary"
                aria-label="Next prayer page"
                disabled={currentPage === last}
                onClick={() => setPage(currentPage + 1)}
              >
                Next <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </nav>
          )}
          <p className="small muted prayer-list-note">
            {Object.keys(prayers).length} of {PRAYER_LIMIT} saved requests.
            {Object.keys(drafts).length > 0 &&
              " Unsaved drafts stay in this tab. Save before reloading or signing out."}
            {Object.keys(prayers).length >= PRAYER_LIMIT &&
              " Export and delete an old request to make room for another."}
          </p>
        </section>
      )}
    </>
  );
}
