"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/lib/account-client";
import { useRequestCooldown } from "@/components/use-request-cooldown";

export function DeleteAccount({ busy }: { busy: boolean }) {
  const cooldown = useRequestCooldown();
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <section className="card backup-card account-deletion">
      <Trash2 size={23} />
      <h2>Delete your account</h2>
      <p>
        Permanently delete your FaithQuest365 profile, reading progress, XP,
        quiz attempts and reflections. This cannot be undone.
      </p>
      {!open ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          Review account deletion
        </Button>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (deleting || busy || confirmation !== "DELETE MY ACCOUNT")
              return;
            setDeleting(true);
            setError(null);
            try {
              await deleteAccount(confirmation);
              window.location.replace("/login?deleted=1");
            } catch (failure) {
              cooldown.pause(failure);
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Account deletion could not be confirmed. Please retry.",
              );
              setDeleting(false);
            }
          }}
        >
          <p>
            Export your account data above first if you want a private copy.
            Your Google account remains available. Signing into FaithQuest365
            again after deletion creates a new, empty journey.
          </p>
          <p>
            Deletion removes your group memberships and closes groups you own.
            Other members keep their personal reading data.
          </p>
          <p>
            For security, you must have signed in with Google within the last 10
            minutes.
          </p>
          <label htmlFor="delete-confirmation">
            Type DELETE MY ACCOUNT to confirm
          </label>
          <input
            id="delete-confirmation"
            autoComplete="off"
            spellCheck={false}
            value={confirmation}
            disabled={deleting}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError(null);
            }}
            required
          />
          {error && <p role="alert">{error}</p>}
          <Button
            type="submit"
            disabled={
              busy ||
              deleting ||
              cooldown.seconds > 0 ||
              confirmation !== "DELETE MY ACCOUNT"
            }
          >
            {cooldown.seconds > 0
              ? `Try deletion in ${cooldown.seconds}s`
              : deleting
                ? "Deleting account…"
                : "Delete my account permanently"}
          </Button>{" "}
          <Button
            type="button"
            variant="secondary"
            disabled={deleting}
            onClick={() => {
              setOpen(false);
              setConfirmation("");
              setError(null);
            }}
          >
            Cancel deletion
          </Button>
        </form>
      )}
    </section>
  );
}
