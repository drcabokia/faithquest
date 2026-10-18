"use client";
import { useState } from "react";
import { useJourney } from "./journey-provider";
import { Button } from "./ui/button";
import { planId, PLAN_IDS, PLAN_DETAILS } from "@/services/reading-plan";
import {
  CHRONOLOGICAL_DRAFT,
  CHRONOLOGICAL_DRAFT_ID,
  CHRONOLOGICAL_NOTES,
  previewPlan,
  previewName,
  draftScheduleExport,
  type PreviewPlanId,
} from "@/services/chronological-preview";
import { hasPlanActivity } from "@/services/select-reading-plan";

export function PlanCatalogue() {
  const { state, busy, selectPlan } = useJourney();
  const [preview, setPreview] = useState<PreviewPlanId>("balanced-v1");
  const [page, setPage] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!state) return null;
  const active = planId(state);
  const locked = hasPlanActivity(state);
  const missions = previewPlan(preview);
  const selectable = preview === CHRONOLOGICAL_DRAFT_ID ? null : preview;
  const visible = missions.slice(page * 7, (page + 1) * 7);
  const visibleNotes = new Set(
    CHRONOLOGICAL_DRAFT.slice(page * 7, (page + 1) * 7).flatMap(
      (m) => m.noteIds,
    ),
  );
  const pages = Math.ceil(missions.length / 7);
  return (
    <section
      className="card plan-catalogue"
      id="plan-catalogue"
      aria-labelledby="plan-catalogue-title"
    >
      <h2 id="plan-catalogue-title">Explore reading journeys</h2>
      <p>Preview a complete schedule without changing your journey.</p>
      <div className="plan-options">
        {PLAN_IDS.map((id) => (
          <article className="info-box" key={id}>
            <h3>{PLAN_DETAILS[id].name}</h3>
            <p>{PLAN_DETAILS[id].description}</p>
            <p className="small muted">
              365 days · 66 books · 1,189 chapters, each read once
            </p>
            {id === "balanced-v1" && (
              <p className="small muted">
                Development schedule · Independent editorial review pending.
                Whole chapters, usually 2–5 per day; reading time varies.
              </p>
            )}
            {id === active && <p className="soft-label">Your active plan</p>}
            <Button
              variant="secondary"
              onClick={() => {
                setPreview(id);
                setPage(0);
                setConfirmed(false);
                setMessage(null);
              }}
            >
              Preview {PLAN_DETAILS[id].name}
            </Button>
          </article>
        ))}
        <article className="info-box">
          <h3>Chronological Journey</h3>
          <p>
            Follow the sequence of biblical events, with notes on uncertain
            placements.
          </p>
          <p className="small muted">
            Editorial draft · Complete 365-day preview. Independent review is
            pending; this plan cannot be selected.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setPreview(CHRONOLOGICAL_DRAFT_ID);
              setPage(0);
              setConfirmed(false);
              setMessage(null);
            }}
          >
            Preview Chronological Journey
          </Button>
        </article>
      </div>
      <div className="schedule-preview" aria-label="Reading schedule preview">
        <h3>{previewName(preview)} · Schedule preview</h3>
        <p className="small muted">
          Preview only. Reading dates and completion marks appear in your active
          plan.
        </p>
        {preview === CHRONOLOGICAL_DRAFT_ID && (
          <p className="info-box">
            Editorial draft · Whole-chapter historical context, with uncertain
            placements. Parallel accounts revisit earlier events. This is not a
            strict event-by-event chronology or an order of composition.
          </p>
        )}
        <div className="preview-week-label">
          <label htmlFor="plan-preview-week">Preview week</label>
          <select
            id="plan-preview-week"
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
          >
            {Array.from({ length: pages }, (_, i) => (
              <option key={i} value={i}>
                Week {i + 1} · Days {i * 7 + 1}–{Math.min((i + 1) * 7, 365)}
              </option>
            ))}
          </select>
        </div>
        <ol start={page * 7 + 1}>
          {visible.map((m) => (
            <li key={m.day}>
              <strong>Day {m.day}</strong>
              <span>
                {m.label}
                {preview === CHRONOLOGICAL_DRAFT_ID && (
                  <small className="draft-context">
                    {CHRONOLOGICAL_DRAFT[m.day - 1].contexts.join(" · ")}
                  </small>
                )}
              </span>
            </li>
          ))}
        </ol>
        <div className="pagination">
          <Button
            size="sm"
            variant="secondary"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous preview week
          </Button>
          <span aria-live="polite">
            Week {page + 1} of {pages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page === pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next preview week
          </Button>
        </div>
        {preview === CHRONOLOGICAL_DRAFT_ID && (
          <>
            <details className="placement-notes">
              <summary>
                Placement notes for this week ({visibleNotes.size})
              </summary>
              {visibleNotes.size ? (
                CHRONOLOGICAL_NOTES.filter((n) => visibleNotes.has(n.id)).map(
                  (note) => (
                    <article key={note.id}>
                      <h4>{note.title}</h4>
                      <p>{note.text}</p>
                      <ul>
                        {note.sources.map((source) => (
                          <li key={source.label}>
                            {source.kind === "guide" ? (
                              <a
                                href={source.href}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {source.label} ↗
                              </a>
                            ) : (
                              <a
                                href={`/bible?book=${source.book}&chapter=${source.chapter}#verse-${source.verses[0]}`}
                              >
                                {source.label} · Read source
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ),
                )
              ) : (
                <p>
                  No additional placement note is attached to these readings.
                  The overall draft limitations still apply.
                </p>
              )}
            </details>
            <p className="small muted">
              Source links support the stated context; the proposed ordering is
              an editorial choice. Reading a source in the reader can update
              your reading position, and does not mark a chapter complete.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(draftScheduleExport(), null, 2)], {
                    type: "application/json",
                  }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "faithquest365-chronological-draft-v1.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download draft schedule
            </Button>
            <p className="small muted">
              The download contains public chapter references and placement
              notes. It is not a personal backup and cannot be restored as
              journey data.
            </p>
          </>
        )}
      </div>
      {selectable === null ? (
        <p className="small muted" role="status">
          Preview only · Chronological Journey is unavailable for activation
          until independent editorial review is complete. Your active journey is
          unchanged.
        </p>
      ) : locked ? (
        <p className="small muted">
          Your reading plan is fixed after your first activity to preserve saved
          progress and XP. You can preview every available schedule.
        </p>
      ) : preview !== active ? (
        <div className="plan-selection">
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I want to use {PLAN_DETAILS[selectable].name} for this journey.{" "}
            {preview === "balanced-v1" &&
              "I understand its independent editorial review is pending."}
          </label>
          <Button
            disabled={busy || !confirmed}
            onClick={async () => {
              if (await selectPlan(selectable)) {
                setConfirmed(false);
                setMessage(
                  "Reading plan selected. Your active mission list has been updated.",
                );
              }
            }}
          >
            Use {PLAN_DETAILS[selectable].name}
          </Button>
        </div>
      ) : (
        <p className="small muted">This is your active reading plan.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
