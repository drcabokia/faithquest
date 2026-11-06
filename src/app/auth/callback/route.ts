import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  accountsEnabled,
  appOrigin,
  supabaseSettings,
} from "@/lib/supabase/config";
export async function GET(request: NextRequest) {
  const origin = appOrigin();
  if (!accountsEnabled())
    return NextResponse.redirect(new URL("/login", origin));
  // Keep one response for success and failure so every SDK cookie write,
  // including chunk removal and PKCE cleanup, reaches the browser.
  const response = NextResponse.redirect(
    new URL("/login?error=signin", origin),
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const { url, key } = supabaseSettings();
      const client = createServerClient(url, key, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (items, cacheHeaders) => {
            for (const { name, value, options } of items) {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            }
            for (const [name, value] of Object.entries(cacheHeaders))
              response.headers.set(name, value);
          },
        },
      });
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data, error: identityError } = await client.auth.getUser();
        if (!identityError && data.user)
          response.headers.set(
            "Location",
            new URL("/dashboard", origin).toString(),
          );
      }
    } catch {}
  }
  return response;
}
