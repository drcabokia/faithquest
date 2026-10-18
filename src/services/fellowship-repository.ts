import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FELLOWSHIP_ERRORS,
  fellowshipSnapshotSchema,
  type FellowshipCommand,
} from "@/lib/fellowship";
import { databaseRateLimit } from "../../supabase/functions/_shared/operations";
export class FellowshipActionError extends Error {}
export async function fetchFellowship(
  client: SupabaseClient,
  command?: FellowshipCommand,
) {
  const { data, error } = await client.rpc(
    command ? "manage_fellowship" : "get_fellowship",
    command ? { p_command: command } : undefined,
  );
  if (error) {
    const limited = databaseRateLimit(error);
    if (limited) throw limited;
    throw new Error(
      "Group changes could not be confirmed. Check saved groups before trying again.",
    );
  }
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string" &&
    Object.hasOwn(FELLOWSHIP_ERRORS, data.error)
  ) {
    throw new FellowshipActionError(
      FELLOWSHIP_ERRORS[data.error as keyof typeof FELLOWSHIP_ERRORS],
    );
  }
  return fellowshipSnapshotSchema.parse(data);
}
