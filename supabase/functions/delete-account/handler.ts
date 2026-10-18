import {
  isAuthError,
  isAuthRetryableFetchError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  operationTrace,
  readAdmission,
  RateLimitError,
} from "../_shared/operations.ts";

type Clients = { user: SupabaseClient; admin: SupabaseClient };
export const deletionConfirmation = "DELETE MY ACCOUNT";

function reply(error: string, status: number, retryAfter = 5) {
  const trace = operationTrace("delete");
  const reference = trace.record(status);
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Request-ID": reference,
        ...([429, 503].includes(status)
          ? { "Retry-After": String(retryAfter) }
          : {}),
      },
    },
  );
}
function identityFailure(error: unknown) {
  return error == null ||
    (isAuthError(error) &&
      !isAuthRetryableFetchError(error) &&
      [400, 401, 403, 404].includes(error.status ?? 0))
    ? reply("Please sign in again.", 401)
    : reply(
        "Your account service is temporarily unavailable. Please retry.",
        503,
      );
}

// Refreshing a token is not a new login. Only a recent, signed OAuth AMR entry qualifies.
export function recentlyAuthenticated(amr: unknown, now: number) {
  return (
    Array.isArray(amr) &&
    amr.some(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        entry.method === "oauth" &&
        typeof entry.timestamp === "number" &&
        Number.isFinite(entry.timestamp) &&
        entry.timestamp <= now + 30 &&
        entry.timestamp >= now - 600,
    )
  );
}

export function createDeletionHandler(
  clients: (authorization: string) => Clients,
  now = () => Date.now(),
) {
  return async (request: Request) => {
    if (request.method !== "POST")
      return reply("Use a confirmed account-deletion request.", 405);
    // This function is invoked by the app server with a bearer JWT, never browser cookies.
    if (request.headers.has("origin"))
      return reply("Request origin was not accepted.", 403);
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer \S+$/i.test(authorization)) return identityFailure(null);
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return reply("Please confirm account deletion.", 400);
    let revoked = false;
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply("Please confirm account deletion.", 400);
      const decoder = new TextDecoder();
      let text = "",
        size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 1024) {
          await reader.cancel();
          return reply("Request is too large.", 413);
        }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return reply("Please confirm account deletion.", 400);
      }
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        !("confirmation" in body) ||
        body.confirmation !== deletionConfirmation
      )
        return reply("Please confirm account deletion.", 400);

      const { user, admin } = clients(authorization);
      const token = authorization.slice(7);
      const identity = await user.auth.getUser(token);
      if (identity.error || !identity.data.user)
        return identityFailure(identity.error);
      const claims = await user.auth.getClaims(token);
      if (claims.error || !claims.data?.claims)
        return identityFailure(claims.error);
      if (claims.data.claims.sub !== identity.data.user.id)
        return identityFailure(null);
      const session = await user.rpc("account_session_active");
      if (session.error || typeof session.data !== "boolean")
        return reply(
          "Your account service is temporarily unavailable. Please retry.",
          503,
        );
      if (!session.data) return identityFailure(null);
      if (
        !recentlyAuthenticated(claims.data.claims.amr, Math.floor(now() / 1000))
      )
        return reply(
          "For account security, sign out of this device and sign in with Google again. Then confirm deletion within 10 minutes.",
          403,
        );

      const budget = await user.rpc("consume_account_request", {
        p_bucket: "delete",
      });
      if (budget.error)
        return reply(
          "Your account service is temporarily unavailable. Please retry.",
          503,
        );
      const admission = readAdmission(budget.data);
      if (!admission.allowed)
        return reply(
          new RateLimitError(admission.retryAfterSeconds).message,
          429,
          admission.retryAfterSeconds,
        );

      // Revoke first so an unexpired access JWT cannot retain account access.
      const signout = await admin.auth.admin.signOut(token, "global");
      if (signout.error)
        return reply(
          "Account deletion could not be started. Please retry.",
          503,
        );
      revoked = true;
      // The only target is the server-verified caller. Existing FKs cascade personal data.
      const deletion = await admin.auth.admin.deleteUser(
        identity.data.user.id,
        false,
      );
      if (deletion.error) throw deletion.error;
      return Response.json(
        { deleted: true },
        {
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    } catch {
      return reply(
        revoked
          ? "Your devices were signed out, but account deletion could not be confirmed. Sign in again to check your account before retrying."
          : "Account deletion could not be confirmed. Please check your connection and try again.",
        503,
      );
    }
  };
}
