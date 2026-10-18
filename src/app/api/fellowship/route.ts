import type { NextRequest } from "next/server";
import { accountsEnabled, appOrigin } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { verifiedAccount } from "@/lib/supabase/account-session";
import { accountResponder, limitedReply } from "@/lib/account-response";
import { fellowshipCommandSchema } from "@/lib/fellowship";
import {
  fetchFellowship,
  FellowshipActionError,
} from "@/services/fellowship-repository";
export const dynamic = "force-dynamic";
async function handle(request: NextRequest, write: boolean) {
  const reply = accountResponder("fellowship");
  if (!accountsEnabled())
    return reply({ error: "Live groups require account access." }, 503);
  try {
    if (write && request.headers.get("origin") !== appOrigin())
      return reply({ error: "Request origin was not accepted." }, 403);
    if (write && Number(request.headers.get("content-length") ?? 0) > 4096)
      return reply({ error: "Request is too large." }, 413);
    const client = await serverSupabase();
    const { failure } = await verifiedAccount(client);
    if (failure) return reply({ error: failure.message }, failure.status);
    if (!write) return reply(await fetchFellowship(client));
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Group data is required." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return reply({ error: "Request is too large." }, 413);
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return reply({ error: "Group data must be valid JSON." }, 400);
    }
    const parsed = fellowshipCommandSchema.safeParse(payload);
    if (!parsed.success)
      return reply(
        { error: "Check the group details and sharing consent." },
        400,
      );
    return reply(await fetchFellowship(client, parsed.data));
  } catch (error) {
    const limited = limitedReply(reply, error);
    if (limited) return limited;
    if (error instanceof FellowshipActionError)
      return reply({ error: error.message }, 400);
    return reply(
      {
        error:
          "Group changes could not be confirmed. Check saved groups before trying again.",
      },
      503,
    );
  }
}
export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
