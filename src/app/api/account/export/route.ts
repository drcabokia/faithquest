import { accountsEnabled } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { verifiedAccount } from "@/lib/supabase/account-session";
import { accountResponder, limitedReply } from "@/lib/account-response";
import { consumeAccountRequest } from "@/lib/account-limits";
import { SupabaseJourneyRepository } from "@/services/supabase-journey";

export const dynamic = "force-dynamic";

export async function GET() {
  const accountReply = accountResponder("export");
  if (!accountsEnabled())
    return accountReply({ error: "Account access is not enabled." }, 503);
  try {
    const client = await serverSupabase();
    const { failure } = await verifiedAccount(client);
    if (failure) {
      return accountReply({ error: failure.message }, failure.status);
    }
    await consumeAccountRequest(client, "export");
    const state = await new SupabaseJourneyRepository(client).getJourney();
    const response = accountReply(state);
    response.headers.set(
      "Content-Disposition",
      'attachment; filename="faithquest365-account-export.json"',
    );
    return response;
  } catch (error) {
    const limited = limitedReply(accountReply, error);
    if (limited) return limited;
    return accountReply(
      { error: "Your account export could not be prepared. Please retry." },
      503,
    );
  }
}
