import type { NextRequest } from "next/server";
import { accountsEnabled, appOrigin } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { verifiedAccount } from "@/lib/supabase/account-session";
import { accountResponder, limitedReply } from "@/lib/account-response";
import { BACKUP_MAX_BYTES, restoreSchema } from "@/lib/backup";
import { stateSchema } from "@/lib/state";
import { databaseRateLimit } from "../../../../../supabase/functions/_shared/operations";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const reply = accountResponder("restore");
  if (!accountsEnabled())
    return reply({ error: "Account access is not enabled." }, 503);
  try {
    if (request.headers.get("origin") !== appOrigin())
      return reply({ error: "Request origin was not accepted." }, 403);
    if (Number(request.headers.get("content-length") ?? 0) > BACKUP_MAX_BYTES)
      return reply({ error: "Backup is too large." }, 413);
    const client = await serverSupabase();
    const { failure } = await verifiedAccount(client);
    if (failure) return reply({ error: failure.message }, failure.status);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Backup data is required." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BACKUP_MAX_BYTES) {
        await reader.cancel();
        return reply({ error: "Backup is too large." }, 413);
      }
      chunks.push(value);
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
      return reply({ error: "Choose a valid JSON backup." }, 400);
    }
    const result = restoreSchema.safeParse(payload);
    if (!result.success)
      return reply(
        { error: "This backup contains unsupported or invalid journey data." },
        400,
      );
    const { data, error } = await client.rpc("restore_journey", {
      p_backup: result.data,
    });
    if (error) {
      const limit = databaseRateLimit(error);
      if (limit) throw limit;
      if (["22023", "22007", "22008"].includes(error.code))
        return reply(
          {
            error:
              "Check the backup dates, reading plan and journey timezone. The restore was not applied.",
          },
          400,
        );
      if (error.code === "42501")
        return reply({ error: "Please sign in again." }, 401);
      throw new Error("Restore unavailable");
    }
    return reply({ state: stateSchema.parse(data) });
  } catch (error) {
    const limited = limitedReply(reply, error);
    if (limited) return limited;
    return reply(
      {
        error:
          "Restore could not be confirmed. Check saved progress before trying again.",
      },
      503,
    );
  }
}
