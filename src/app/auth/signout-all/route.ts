import { NextResponse, type NextRequest } from "next/server";
import { accountsEnabled, appOrigin } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { verifiedAccount } from "@/lib/supabase/account-session";
import { accountReply } from "@/lib/account-response";

export async function POST(request: NextRequest) {
  const origin = appOrigin();
  if (request.headers.get("origin") !== origin)
    return accountReply({ error: "Request origin was not accepted." }, 403);
  if (!accountsEnabled())
    return accountReply({ error: "Account access is not enabled." }, 503);
  if (
    request.headers.get("content-type")?.split(";")[0] !==
    "application/x-www-form-urlencoded"
  )
    return accountReply(
      { error: "Please confirm signing out of all devices." },
      400,
    );
  try {
    const reader = request.body?.getReader();
    if (!reader)
      return accountReply({ error: "Confirmation is required." }, 400);
    const decoder = new TextDecoder();
    let body = "",
      size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return accountReply({ error: "Request is too large." }, 413);
      }
      body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode();
    const confirmation = new URLSearchParams(body);
    if (
      [...confirmation].length !== 1 ||
      confirmation.get("confirmation") !== "sign-out-all"
    )
      return accountReply(
        { error: "Please confirm signing out of all devices." },
        400,
      );
    const client = await serverSupabase();
    const { failure } = await verifiedAccount(client);
    if (failure)
      return accountReply({ error: failure.message }, failure.status);
    const { error } = await client.auth.signOut({ scope: "global" });
    if (error)
      return accountReply(
        { error: "Could not sign out of all devices. Please retry." },
        503,
      );
    const response = NextResponse.redirect(
      new URL("/login?signedOut=all", origin),
      303,
    );
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Vary", "Cookie");
    return response;
  } catch {
    return accountReply(
      { error: "Could not sign out of all devices. Please retry." },
      503,
    );
  }
}
