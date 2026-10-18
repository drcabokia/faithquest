"use client";
import Link from "next/link";
import { PLAN_DETAILS, planId } from "@/services/reading-plan";
import { useState } from "react";
import {
  Download,
  Check,
  Settings,
  LockKeyhole,
  BookOpen,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";
import { useJourney, JourneyLoading } from "@/components/journey-provider";
import { profileSchema, type Profile } from "@/lib/state";
import { PageHeading } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { totalXp } from "@/services/gamification-display";
import { fetchAccountExport } from "@/lib/account-client";
import { DeleteAccount } from "@/components/delete-account";
import { AccountConnection } from "@/components/account-connection";
import { useRequestCooldown } from "@/components/use-request-cooldown";
import { RestoreBackup } from "@/components/restore-backup";
function ProfileForm({ initial }: { initial: Profile }) {
  const { profile, busy, state, today } = useJourney();
  const [draft, setDraft] = useState(initial),
    [saved, setSaved] = useState(false),
    [validation, setValidation] = useState<string | null>(null);
  const hasActivity =
    !!state &&
    (Object.keys(state.chapters).length > 0 ||
      Object.keys(state.rewards).length > 0 ||
      Object.keys(state.attempts).length > 0 ||
      (state.challengeStarts?.length ?? 0) > 0);
  const edit = (change: Partial<Profile>) => {
    setDraft((p) => ({ ...p, ...change }));
    setSaved(false);
  };
  return (
    <form
      className="card settings-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = profileSchema.safeParse(draft);
        if (!result.success) {
          setValidation(
            "Please use a name of 1–50 characters, a valid start date, and a valid IANA timezone.",
          );
          return;
        }
        setValidation(null);
        if (await profile(result.data)) setSaved(true);
      }}
    >
      <div className="section-heading">
        <h2>Your reading preferences</h2>
        <Settings size={20} />
      </div>
      <label htmlFor="display-name">Display name</label>
      <input
        id="display-name"
        maxLength={50}
        required
        value={draft.name}
        onChange={(e) => edit({ name: e.target.value })}
      />
      <p>
        <Link className="text-link" href="/reading-plan#plan-catalogue">
          Compare reading plans
        </Link>
      </p>
      <div className="form-columns">
        <div>
          <label htmlFor="start-date">Journey start date</label>
          <input
            type="date"
            id="start-date"
            required
            max={today}
            value={draft.startDate}
            onChange={(e) => edit({ startDate: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="timezone">Journey timezone</label>
          <input
            id="timezone"
            required
            disabled={hasActivity}
            value={draft.timeZone}
            onChange={(e) => edit({ timeZone: e.target.value })}
            aria-describedby="timezone-help"
          />
        </div>
      </div>
      <p className="small muted" id="timezone-help">
        {hasActivity
          ? "Your timezone is fixed after your first activity to keep calendar-day streaks consistent."
          : "Use an IANA timezone such as Asia/Kuala_Lumpur. It is fixed after your first activity."}{" "}
        Changing your start date keeps existing progress.
      </p>
      <label>Reading plan</label>
      <div className="readonly-setting">
        <BookOpen size={17} />
        {PLAN_DETAILS[planId(state ?? {})].name} · 365 days<span>ACTIVE</span>
      </div>
      <label>Bible translation</label>
      <div className="readonly-setting">
        World English Bible Classic <span>PUBLIC DOMAIN</span>
      </div>
      <label>Appearance</label>
      <div className="theme-options">
        {(
          [
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
            { id: "system", label: "System", icon: Monitor },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <label key={id} className={draft.theme === id ? "selected" : ""}>
            <input
              type="radio"
              name="theme"
              value={id}
              checked={draft.theme === id}
              onChange={() => edit({ theme: id })}
            />
            <Icon size={18} />
            {label}
          </label>
        ))}
      </div>
      {validation && (
        <p role="alert" className="field-error">
          {validation}
        </p>
      )}
      <Button disabled={busy} type="submit">
        {saved ? <Check size={16} /> : <Settings size={16} />}{" "}
        {saved ? "Preferences saved" : "Save preferences"}
      </Button>
    </form>
  );
}
export function ProfileScreen() {
  const exportCooldown = useRequestCooldown();
  const { state, mode, busy } = useJourney();
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState<string | null>(null),
    [exportReady, setExportReady] = useState(false);
  const [confirmSignout, setConfirmSignout] = useState(false);
  if (!state) return <JourneyLoading />;
  async function exportJourney() {
    setExporting(true);
    setExportError(null);
    setExportReady(false);
    try {
      const snapshot = mode === "supabase" ? await fetchAccountExport() : state;
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download =
        mode === "demo"
          ? "faithquest365-demo-backup.json"
          : "faithquest365-account-export.json";
      try {
        link.click();
        setExportReady(true);
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      exportCooldown.pause(error);
      setExportError(
        error instanceof Error
          ? error.message
          : "Your export could not be prepared. Please retry.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE THIS JOURNEY YOURS"
        title="A rhythm that fits your life."
        description="Your preferences, your progress, your next faithful step."
      />
      <div className="profile-layout">
        <ProfileForm
          key={`${state.profile.name}-${state.profile.theme}-${state.profile.startDate}`}
          initial={state.profile}
        />
        <aside>
          <section className="card profile-card">
            <span className="avatar avatar-large">
              {state.profile.name.slice(0, 1).toUpperCase()}
            </span>
            <h2>{state.profile.name}</h2>
            <span className="demo-pill">
              <span />
              {mode === "demo" ? "LOCAL DEMO PROFILE" : "PRIVATE ACCOUNT"}
            </span>
            <div className="profile-stats">
              <span>
                <strong>{Object.keys(state.days).length}</strong>Reading days
              </span>
              <span>
                <strong>{totalXp(state)}</strong>Total XP
              </span>
              <span>
                <strong>{Object.keys(state.reflections).length}</strong>
                Reflections
              </span>
            </div>
          </section>
          <section className="card backup-card">
            <Download size={23} />
            <h2>Keep a copy of your journey</h2>
            <p>
              {mode === "supabase"
                ? "Download your latest saved progress and reflections as JSON."
                : "Download this browser’s progress and reflections as JSON."}{" "}
              Store the file somewhere private. Use Restore a backup below to
              preview and merge missing entries later.
            </p>
            <Button
              variant="secondary"
              disabled={exporting || busy || exportCooldown.seconds > 0}
              onClick={() => void exportJourney()}
            >
              <Download size={16} />
              {exportCooldown.seconds > 0
                ? `Try export in ${exportCooldown.seconds}s`
                : exporting
                  ? "Preparing export…"
                  : mode === "demo"
                    ? "Export demo backup"
                    : "Export account data"}
            </Button>
            {exportError && <p role="alert">{exportError}</p>}
            {exportReady && (
              <p role="status">Your export is ready. Check your downloads.</p>
            )}
          </section>
          <RestoreBackup />
          {mode === "supabase" && (
            <section className="card backup-card">
              <LockKeyhole size={23} />
              <h2>Account sessions</h2>
              <p>
                Sign out of FaithQuest365 on every device. Your saved progress
                and reflections stay in your account.
              </p>
              {confirmSignout ? (
                <form action="/auth/signout-all" method="post">
                  <input
                    type="hidden"
                    name="confirmation"
                    value="sign-out-all"
                  />
                  <p>You will need to sign in again on this device too.</p>
                  <Button type="submit" disabled={busy}>
                    Confirm sign out everywhere
                  </Button>{" "}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmSignout(false)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmSignout(true)}
                >
                  Sign out of all devices
                </Button>
              )}
            </section>
          )}
          {mode === "supabase" && <AccountConnection />}
          {mode === "supabase" && <DeleteAccount busy={busy || exporting} />}
          <div className="privacy-note">
            <LockKeyhole size={20} />
            <p>
              {mode === "demo"
                ? "This demo uses browser storage only. Clearing site data removes your demo progress. Entries are not encrypted or synced."
                : "Your progress and reflections are saved to your private account. Signing out clears the app session on this device."}
            </p>
          </div>
        </aside>
      </div>
      {mode === "supabase" && (
        <form action="/auth/signout" method="post">
          <Button variant="secondary" type="submit">
            Sign out of this device
          </Button>
        </form>
      )}
    </>
  );
}
