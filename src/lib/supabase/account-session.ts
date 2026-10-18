import type { SupabaseClient } from "@supabase/supabase-js";
import { authFailure } from "./auth-failure";

export async function accountSessionFailure(client: SupabaseClient) {
  try {
    const { data, error } = await client.rpc("account_session_active");
    if (error || typeof data !== "boolean")
      return authFailure(new Error("Session verification unavailable"));
    return data ? null : authFailure(null);
  } catch {
    return authFailure(new Error("Session verification unavailable"));
  }
}

export async function verifiedAccount(client: SupabaseClient) {
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { user: null, failure: authFailure(error) };
    const failure = await accountSessionFailure(client);
    if (failure) return { user: null, failure };
    return { user: data.user, failure: null };
  } catch {
    return {
      user: null,
      failure: authFailure(new Error("Identity verification unavailable")),
    };
  }
}
