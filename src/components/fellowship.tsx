"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LockKeyhole, Users } from "lucide-react";
import { useJourney, JourneyLoading } from "./journey-provider";
import { PageHeading, Progress } from "./ui/shared";
import { Button } from "./ui/button";
import { requestFellowship } from "@/lib/account-client";
import type { FellowshipCommand, FellowshipSnapshot } from "@/lib/fellowship";

const consentText =
  "I agree to share my display name and overall reading-plan percentage with this group’s members.";
type Group = FellowshipSnapshot["groups"][number];
type Perform = (command: FellowshipCommand) => Promise<boolean>;
function GroupCard({
  group,
  busy,
  perform,
}: {
  group: Group;
  busy: boolean;
  perform: Perform;
}) {
  const [name, setName] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [confirm, setConfirm] = useState<{
    type: "close" | "leave" | "rotate" | "remove";
    memberId?: string;
    name?: string;
  } | null>(null);
  const [typed, setTyped] = useState("");
  return (
    <article className="card fellowship-group" aria-label={group.name}>
      <div className="section-heading">
        <h2>{group.name}</h2>
        <span className="soft-label">
          {group.owner ? "Group owner" : "Member"}
        </span>
      </div>
      <p className="muted">
        {group.members.length} of 20 members · Reading-plan participation
      </p>
      <p className="small muted">
        Listed by name for encouragement. This percentage records plan progress;
        it does not measure spiritual growth.
      </p>
      <ul className="fellowship-roster">
        {group.members.map((member, i) => (
          <li key={member.memberId ?? `${member.name}-${i}`}>
            <div>
              <strong>
                {member.name}
                {member.isYou ? " (you)" : ""}
              </strong>
              <span>{member.participationPercent}% of the plan recorded</span>
            </div>
            <Progress
              value={member.participationPercent}
              label={`${member.name} reading-plan participation`}
            />
            {group.owner && !member.isYou && member.memberId && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setConfirm({
                    type: "remove",
                    memberId: member.memberId,
                    name: member.name,
                  });
                  setTyped("");
                }}
              >
                Remove {member.name}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {group.owner && (
        <div className="fellowship-owner-tools">
          <label htmlFor={`group-name-${group.id}`}>Group name</label>
          <input
            id={`group-name-${group.id}`}
            maxLength={80}
            value={name ?? group.name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !(name ?? group.name).trim()}
            onClick={async () => {
              if (
                await perform({
                  type: "rename",
                  groupId: group.id,
                  name: (name ?? group.name).trim(),
                })
              )
                setName(null);
            }}
          >
            Save group name
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCode(!showCode)}
          >
            {showCode ? "Hide invitation code" : "Show invitation code"}
          </Button>
          {showCode && group.inviteCode && (
            <div>
              <label htmlFor={`invite-${group.id}`}>Invitation code</label>
              <input
                id={`invite-${group.id}`}
                readOnly
                value={group.inviteCode}
                onFocus={(e) => e.target.select()}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="small muted">
                Copy and share privately with people you want to invite. Anyone
                signed in with this code can join until you rotate it.
              </p>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setConfirm({ type: "rotate" })}
          >
            Rotate invitation code
          </Button>
        </div>
      )}
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => {
          setTyped("");
          setConfirm({ type: group.owner ? "close" : "leave" });
        }}
      >
        {group.owner ? "Close group" : "Leave group"}
      </Button>
      {confirm && (
        <div
          className="fellowship-confirm"
          role="group"
          aria-label="Confirm group action"
        >
          <p>
            {confirm.type === "close"
              ? "Closing removes this group and all its memberships. Everyone keeps their personal reading data. Type CLOSE GROUP to confirm."
              : confirm.type === "leave"
                ? "Leave this group and stop sharing your participation? Your personal reading data stays with you."
                : confirm.type === "rotate"
                  ? "Replace the invitation code? The old code will stop working. Current members stay in the group."
                  : `Remove ${confirm.name}? Their personal reading data stays private. The invitation code will also change to prevent rejoining with the old code.`}
          </p>
          {confirm.type === "close" && (
            <>
              <label htmlFor={`close-${group.id}`}>
                Close group confirmation
              </label>
              <input
                id={`close-${group.id}`}
                value={typed}
                autoComplete="off"
                disabled={busy}
                onChange={(e) => setTyped(e.target.value)}
              />
            </>
          )}
          <Button
            size="sm"
            disabled={
              busy || (confirm.type === "close" && typed !== "CLOSE GROUP")
            }
            onClick={async () => {
              const command: FellowshipCommand =
                confirm.type === "close"
                  ? {
                      type: "close",
                      groupId: group.id,
                      confirmation: "CLOSE GROUP",
                    }
                  : confirm.type === "remove"
                    ? {
                        type: "remove",
                        groupId: group.id,
                        memberId: confirm.memberId!,
                      }
                    : { type: confirm.type, groupId: group.id };
              if (await perform(command)) setConfirm(null);
            }}
          >
            Confirm{" "}
            {confirm.type === "remove"
              ? "removal"
              : confirm.type === "rotate"
                ? "rotation"
                : confirm.type}
          </Button>{" "}
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            Cancel group action
          </Button>
        </div>
      )}
    </article>
  );
}
function AccountFellowship() {
  const [data, setData] = useState<FellowshipSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createConsent, setCreateConsent] = useState(false);
  const [joinConsent, setJoinConsent] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<Extract<
    FellowshipCommand,
    { type: "create" }
  > | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const execute = useCallback((command?: FellowshipCommand) => {
    const result = queue.current
      .catch(() => {})
      .then(async () => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
          const next = await requestFellowship(command);
          setData(next);
          if (command) setNotice("Group changes saved.");
          return next;
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Groups are unavailable. Check saved groups before trying again.",
          );
          return null;
        } finally {
          setBusy(false);
        }
      });
    queue.current = result;
    return result;
  }, []);
  useEffect(() => {
    void execute();
    const refresh = () => {
      void execute();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [execute]);
  const perform: Perform = async (command) => !!(await execute(command));
  return (
    <>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          const next = await execute();
          if (
            next &&
            pendingCreate &&
            next.groups.some(
              (g) => g.creationRequestId === pendingCreate.requestId,
            )
          ) {
            setPendingCreate(null);
            setName("");
            setCreateConsent(false);
            setNotice("Your group creation was confirmed.");
          }
        }}
      >
        {busy ? "Checking groups…" : "Check saved groups"}
      </Button>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data ? (
        <p role="status">
          {error
            ? "Your groups could not be loaded. Use Check saved groups to retry."
            : "Opening your groups…"}
        </p>
      ) : (
        <>
          <div className="fellowship-forms">
            <section className="card">
              <h2>Create a private group</h2>
              <p>
                Own up to two groups and belong to five. Each group has room for
                twenty people. Creating or joining earns no XP.
              </p>
              <label htmlFor="new-group-name">New group name</label>
              <input
                id="new-group-name"
                value={name}
                maxLength={80}
                disabled={busy || !!pendingCreate}
                onChange={(e) => setName(e.target.value)}
              />
              <label className="fellowship-consent">
                <input
                  type="checkbox"
                  checked={createConsent}
                  disabled={busy || !!pendingCreate}
                  onChange={(e) => setCreateConsent(e.target.checked)}
                />
                {consentText}
              </label>
              <Button
                disabled={busy || !name.trim() || !createConsent}
                onClick={async () => {
                  const command = pendingCreate ?? {
                    type: "create" as const,
                    requestId: crypto.randomUUID(),
                    name: name.trim(),
                    consent: true as const,
                  };
                  setPendingCreate(command);
                  if (await perform(command)) {
                    setPendingCreate(null);
                    setName("");
                    setCreateConsent(false);
                  }
                }}
              >
                {pendingCreate ? "Retry same group creation" : "Create group"}
              </Button>
              {pendingCreate && (
                <p className="small muted">
                  This request is kept in this tab. Check saved groups before
                  retrying; a retry uses the same request so it cannot create a
                  duplicate.
                </p>
              )}
            </section>
            <section className="card">
              <h2>Join by invitation</h2>
              <p>
                Ask the owner for their private invitation code. Your current
                display name and overall reading-plan percentage will be visible
                to this group.
              </p>
              <label htmlFor="join-code">Group invitation code</label>
              <input
                id="join-code"
                value={code}
                maxLength={64}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
                onChange={(e) => setCode(e.target.value)}
              />
              <label className="fellowship-consent">
                <input
                  type="checkbox"
                  checked={joinConsent}
                  disabled={busy}
                  onChange={(e) => setJoinConsent(e.target.checked)}
                />
                {consentText}
              </label>
              <Button
                disabled={
                  busy || !/^[0-9a-f]{32}$/i.test(code.trim()) || !joinConsent
                }
                onClick={async () => {
                  if (
                    await perform({
                      type: "join",
                      code: code.trim().toLowerCase(),
                      consent: true,
                    })
                  ) {
                    setCode("");
                    setJoinConsent(false);
                  }
                }}
              >
                Join group
              </Button>
            </section>
          </div>
          <section
            className="fellowship-groups"
            aria-label="Your fellowship groups"
          >
            <h2>Your groups</h2>
            {!data.groups.length && (
              <p className="card fellowship-empty">
                You have not joined a group. Your personal journey stays private
                until you choose to share participation.
              </p>
            )}
            {data.groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                busy={busy}
                perform={perform}
              />
            ))}
          </section>
        </>
      )}
    </>
  );
}
export function Fellowship() {
  const { mode, state } = useJourney();
  return (
    <>
      <PageHeading
        eyebrow="FAITH GROWS IN FELLOWSHIP"
        title="Side by side in the Word."
        description="Private reading groups for encouragement, with room for different rhythms."
        action={
          <span className="soft-label">
            <LockKeyhole size={14} />
            Invite-only groups
          </span>
        }
      />
      <div className="card fellowship-privacy">
        <Users size={24} />
        <p>
          Groups share only display names and overall reading-plan percentages
          after each person agrees. Journals, prayer entries, saved verses, quiz
          answers, XP and reading dates stay private. Members are listed by
          name; there are no rankings.
        </p>
        <p className="small muted">
          Use Check saved groups for the latest view. An owner can remove
          members or close a group. Leaving or removal stops future access; it
          cannot erase information members have already seen.
        </p>
      </div>
      {mode === "demo" ? (
        <section className="card fellowship-demo">
          <h2>Live groups require a signed-in account</h2>
          <p>
            This is a personal demo stored in your browser. It does not create
            groups or share participation. Use FaithQuest’s account mode to
            create or join a private group.
          </p>
          <Button asChild>
            <Link href="/reading-plan">Continue your personal journey</Link>
          </Button>
        </section>
      ) : !state ? (
        <JourneyLoading />
      ) : (
        <AccountFellowship />
      )}
    </>
  );
}
