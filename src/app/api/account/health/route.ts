import { accountsEnabled } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { verifiedAccount } from "@/lib/supabase/account-session";
import { consumeAccountRequest } from "@/lib/account-limits";
import { accountResponder, limitedReply } from "@/lib/account-response";
export const dynamic = "force-dynamic";
export async function GET() {
  const reply = accountResponder("health");
  if (!accountsEnabled())
    return reply({ error: "Account access is not enabled." }, 503);
  try {
    const client = await serverSupabase();
    const { failure } = await verifiedAccount(client);
    if (failure) return reply({ error: failure.message }, failure.status);
    await consumeAccountRequest(client, "health");
    return reply({ status: "ok" });
  } catch (error) {
    return (
      limitedReply(reply, error) ??
      reply(
        {
          error: "Your account connection could not be checked. Please retry.",
        },
        503,
      )
    );
  }
}
