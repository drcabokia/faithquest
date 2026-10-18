import { createClient } from "@supabase/supabase-js";
import { createDeletionHandler } from "./handler.ts";

// Supabase injects these credentials into the hosted Edge runtime. They never
// enter the Next.js environment, browser bundle, response, or logs.
Deno.serve(
  createDeletionHandler((authorization) => {
    const url = Deno.env.get("SUPABASE_URL")!;
    const options = {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    };
    return {
      user: createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        ...options,
        global: { headers: { Authorization: authorization } },
      }),
      admin: createClient(
        url,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        options,
      ),
    };
  }),
);
