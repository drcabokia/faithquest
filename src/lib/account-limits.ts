import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readAdmission,
  RateLimitError,
} from "../../supabase/functions/_shared/operations";

export async function consumeAccountRequest(
  client: SupabaseClient,
  bucket: "export" | "health",
) {
  const { data, error } = await client.rpc("consume_account_request", {
    p_bucket: bucket,
  });
  if (error) throw new Error("Account request admission is unavailable.");
  const admission = readAdmission(data);
  if (!admission.allowed) throw new RateLimitError(admission.retryAfterSeconds);
}
