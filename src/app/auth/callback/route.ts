import { NextResponse, type NextRequest } from "next/server";
import { accountsEnabled, appOrigin } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const origin = appOrigin();
  if (!accountsEnabled())
    return NextResponse.redirect(new URL("/login", origin));
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const client = await serverSupabase();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data, error: identityError } = await client.auth.getUser();
        if (!identityError && data.user)
          return NextResponse.redirect(new URL("/dashboard", origin));
      }
    } catch {}
  }
  return NextResponse.redirect(new URL("/login?error=signin", origin));
}
