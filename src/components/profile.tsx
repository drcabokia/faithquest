"use client";
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
import { totalXp } from "@/services/gamification";
function ProfileForm({ initial }: { initial: Profile }) {
  const { profile, busy, state, today } = useJourney();
  const [draft, setDraft] = useState(initial),
    [saved, setSaved] = useState(false),
    [validation, setValidation] = useState<string | null>(null);
  const hasActivity =
    !!state &&
    (Object.keys(state.chapters).length > 0 ||
      Object.keys(state.rewards).length > 0 ||
      Object.keys(state.attempts).length > 0);
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
        Canonical Journey · 365 days<span>ACTIVE</span>
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
  const { state } = useJourney();
  if (!state) return <JourneyLoading />;
  function exportDemo() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "faithquest365-demo-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
              LOCAL DEMO PROFILE
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
              Download your demo progress and reflections as JSON. Store the
              file somewhere private. Restore/import is planned; this export is
              for safekeeping.
            </p>
            <Button variant="secondary" onClick={exportDemo}>
              <Download size={16} />
              Export demo backup
            </Button>
          </section>
          <div className="privacy-note">
            <LockKeyhole size={20} />
            <p>
              This demo uses browser storage only. Clearing site data removes
              your demo progress. Entries are not encrypted or synced. Google
              sign-in and Supabase persistence are future production work.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
