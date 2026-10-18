import { fellowshipSnapshotSchema, type FellowshipCommand } from "./fellowship";
import { stateSchema } from "./state";
import type { JourneyCommand } from "./commands";
import type { RestoreData } from "./backup";

export class AccountRequestError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds = 0,
  ) {
    super(message);
  }
}

async function readAccount(
  path: string,
  options: RequestInit = {},
  networkError = "Your account could not be reached. Check your connection and try again.",
) {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      // A timeout is an uncertain outcome; mutations are never replayed here.
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(networkError);
  }
  if (response.status === 401) {
    window.location.replace("/login");
    throw new Error("Please sign in again.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      const wait =
        Number.isInteger(seconds) && seconds > 0 && seconds <= 900
          ? seconds
          : 60;
      throw new AccountRequestError(
        `Please wait ${wait} seconds before trying again. Your saved progress is unchanged.`,
        wait,
      );
    }
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Your account data could not be loaded or saved. Please retry.";
    const requestId = response.headers.get("x-request-id");
    const reference =
      response.status >= 500 &&
      requestId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        requestId,
      )
        ? ` Reference: ${requestId}`
        : "";
    throw new AccountRequestError(message + reference);
  }
  return data;
}

export async function requestJourney(command?: JourneyCommand) {
  const data = await readAccount("/api/journey", {
    method: command ? "POST" : "GET",
    headers: command ? { "Content-Type": "application/json" } : undefined,
    body: command ? JSON.stringify(command) : undefined,
  });
  const result = stateSchema.safeParse(
    data && typeof data === "object" && "state" in data ? data.state : null,
  );
  if (!result.success)
    throw new Error("Your account data could not be read. Please retry.");
  return result.data;
}

export async function fetchAccountExport() {
  const data = await readAccount("/api/account/export");
  const result = stateSchema.safeParse(data);
  if (!result.success)
    throw new Error("Your account export could not be read. Please retry.");
  return result.data;
}

export async function restoreAccount(backup: RestoreData) {
  const data = await readAccount(
    "/api/account/restore",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backup),
    },
    "Restore could not be confirmed. Check saved progress before trying again.",
  );
  const result = stateSchema.safeParse(
    data && typeof data === "object" && "state" in data ? data.state : null,
  );
  if (!result.success)
    throw new Error(
      "Restore could not be confirmed. Check saved progress before trying again.",
    );
  return result.data;
}

export async function checkAccountConnection() {
  const data = await readAccount("/api/account/health");
  if (
    !data ||
    typeof data !== "object" ||
    !("status" in data) ||
    data.status !== "ok"
  )
    throw new Error(
      "Your account connection could not be checked. Please retry.",
    );
}

export async function deleteAccount(confirmation: string) {
  const data = await readAccount(
    "/api/account/delete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    },
    "Account deletion could not be confirmed. Check your connection, then sign in again to check your account before retrying.",
  );
  if (
    !data ||
    typeof data !== "object" ||
    !("deleted" in data) ||
    data.deleted !== true
  )
    throw new Error(
      "Account deletion could not be confirmed. Please check your account before retrying.",
    );
}

export async function requestFellowship(command?: FellowshipCommand) {
  const data = await readAccount(
    "/api/fellowship",
    command
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        }
      : {},
    "Group changes could not be confirmed. Check saved groups before trying again.",
  );
  return fellowshipSnapshotSchema.parse(data);
}
