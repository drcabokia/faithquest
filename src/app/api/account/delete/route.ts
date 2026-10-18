import type { NextRequest } from "next/server";
import { accountsEnabled, appOrigin } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { verifiedAccount } from "@/lib/supabase/account-session";
import { accountResponder, limitedReply } from "@/lib/account-response";
import { RateLimitError } from "../../../../../supabase/functions/_shared/operations";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const accountReply = accountResponder("delete");
  if (request.headers.get("origin") !== appOrigin())
    return accountReply({ error: "Request origin was not accepted." }, 403);
  if (!accountsEnabled())
    return accountReply({ error: "Account access is not enabled." }, 503);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return accountReply({ error: "Please confirm account deletion." }, 400);
  try {
    const reader = request.body?.getReader();
    if (!reader)
      return accountReply({ error: "Please confirm account deletion." }, 400);
    const decoder = new TextDecoder();
    let text = "",
      size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return accountReply({ error: "Request is too large." }, 413);
      }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return accountReply({ error: "Please confirm account deletion." }, 400);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !("confirmation" in body) ||
      body.confirmation !== "DELETE MY ACCOUNT"
    )
      return accountReply(
        { error: "Please type DELETE MY ACCOUNT to confirm." },
        400,
      );
    const client = await serverSupabase();
    const { failure } = await verifiedAccount(client);
    if (failure)
      return accountReply({ error: failure.message }, failure.status);
    const { data, error } = await client.functions.invoke("delete-account", {
      body,
    });
    if (error) {
      const context = "context" in error ? error.context : null;
      if (context instanceof Response && context.status === 429) {
        const seconds = Number(context.headers.get("retry-after"));
        return limitedReply(
          accountReply,
          new RateLimitError(
            Number.isInteger(seconds) && seconds > 0 && seconds <= 900
              ? seconds
              : 60,
          ),
        )!;
      }
      // Only relay a known, safe reauthentication response. All other upstream
      // failures are uncertain outcomes; never claim that deletion succeeded.
      if (context instanceof Response && context.status === 403)
        return accountReply(
          {
            error:
              "For account security, sign out of this device and sign in with Google again. Then confirm deletion within 10 minutes.",
          },
          403,
        );
      if (context instanceof Response && context.status === 401)
        return accountReply({ error: "Please sign in again." }, 401);
      return accountReply(
        {
          error:
            "Account deletion could not be confirmed. Sign in again to check your account before retrying.",
        },
        503,
      );
    }
    if (!data || data.deleted !== true)
      return accountReply(
        { error: "Account deletion could not be confirmed. Please retry." },
        503,
      );
    // Removal has committed. A cookie-cleanup outage must not misreport that outcome.
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {}
    return accountReply({ deleted: true });
  } catch {
    return accountReply(
      {
        error:
          "Account deletion could not be confirmed. Please check your connection and try again.",
      },
      503,
    );
  }
}
