"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useJourney } from "./journey-provider";
import { Button } from "./ui/button";
import { planId } from "@/services/reading-plan";
import {
  BACKUP_MAX_BYTES,
  parseBackup,
  previewRestore,
  type RestoreData,
} from "@/lib/backup";

export function RestoreBackup() {
  const { state, mode, busy, restore } = useJourney();
  const [backup, setBackup] = useState<RestoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const selection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!state) return null;
  const preview = backup ? previewRestore(state, backup) : null;
  const reset = () => {
    selection.current++;
    setBackup(null);
    setConfirmed(false);
    setError(null);
    setReading(false);
    if (fileInput.current) fileInput.current.value = "";
  };
  return (
    <section className="card backup-card">
      <Upload size={23} />
      <h2>Restore a backup</h2>
      <p>
        Choose a FaithQuest JSON export, up to 5 MB. Preview it before adding
        missing chapters, quiz answers, reflections, saved verses, challenge
        history, private verse notes and prayer requests. Existing entries and
        your reading preferences stay in place. XP is calculated from activity.
      </p>
      <p className="small muted">
        {mode === "supabase"
          ? "After confirmation, your backup’s saved activity, reflections, verse notes and prayer requests will be uploaded to the account you are signed into."
          : "The merge is saved in this browser."}{" "}
        Keep a fresh export before restoring. Backups must use the same journey
        timezone and reading plan.
      </p>
      <p className="small muted">
        Group membership is managed in Community and is not restored from
        personal backups. Rejoin using a current invitation.
      </p>
      <label htmlFor="restore-file">Backup file</label>
      <input
        id="restore-file"
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        disabled={busy || restoring || reading}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          const version = ++selection.current;
          setBackup(null);
          setConfirmed(false);
          setError(null);
          setMessage(null);
          if (!file) return;
          setReading(true);
          try {
            if (file.size > BACKUP_MAX_BYTES)
              throw new Error("Choose a backup smaller than 5 MB.");
            const parsed = parseBackup(
              await file.text(),
              state.profile.timeZone,
              new Date(),
              planId(state),
            );
            if (version === selection.current) setBackup(parsed);
          } catch (error) {
            if (version === selection.current)
              setError(
                error instanceof Error
                  ? error.message
                  : "This backup could not be read.",
              );
          } finally {
            if (version === selection.current) setReading(false);
          }
        }}
      />
      {reading && <p role="status">Reading backup…</p>}
      {preview && (
        <div>
          <h3>Backup preview</h3>
          {preview.challengeError && (
            <p role="alert">{preview.challengeError}</p>
          )}
          <p>
            {preview.chapters} missing chapters · {preview.attempts} missing
            quiz answers · {preview.reflections} missing reflections ·{" "}
            {preview.savedVerses} missing saved verses · {preview.challenges}{" "}
            missing challenges · {preview.verseNotes} missing verse notes ·{" "}
            {preview.prayers} missing prayer requests
          </p>
          <p>
            {preview.prayerConflicts} conflicting prayer requests keep their
            current details and follow-ups. {preview.noteConflicts} conflicting
            verse notes keep their current text. {preview.conflicts} conflicting
            reflections will keep their current text and category. Saved quiz
            answers cannot be replaced. Imported answers are checked again.
          </p>
          <p className="small muted">
            These counts reflect currently loaded progress. The merge also
            preserves any entries saved on another device before confirmation.
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || restoring}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            This backup belongs to me, and I want to merge it into{" "}
            {mode === "supabase"
              ? `my signed-in account (${state.profile.name})`
              : "this browser’s journey"}
            .
          </label>
          <Button
            disabled={
              !!preview.challengeError ||
              !confirmed ||
              busy ||
              restoring ||
              !(
                preview.chapters +
                preview.attempts +
                preview.reflections +
                preview.savedVerses +
                preview.verseNotes +
                preview.prayers +
                preview.challenges
              )
            }
            onClick={async () => {
              if (!backup) return;
              setRestoring(true);
              setError(null);
              setMessage(null);
              try {
                if (await restore(backup)) {
                  reset();
                  setMessage("Backup merged. Existing entries were kept.");
                } else
                  setError(
                    "Restore could not be confirmed. Check saved progress before trying again.",
                  );
              } finally {
                setRestoring(false);
              }
            }}
          >
            {restoring ? "Restoring…" : "Confirm merge"}
          </Button>{" "}
          <Button variant="secondary" disabled={restoring} onClick={reset}>
            Cancel restore
          </Button>
          {!(
            preview.chapters +
            preview.attempts +
            preview.reflections +
            preview.savedVerses +
            preview.verseNotes +
            preview.prayers +
            preview.challenges
          ) && <p role="status">There are no missing entries to restore.</p>}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
