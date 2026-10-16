import { NextResponse, type NextRequest } from "next/server";
import { accountsEnabled, appOrigin } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
export async function POST(request: NextRequest) {
  if (!accountsEnabled())
    return NextResponse.json(
      { error: "Account access is not enabled." },
      { status: 503 },
    );
  const origin = appOrigin();
  if (request.headers.get("origin") !== origin)
    return NextResponse.json(
      { error: "Request origin was not accepted." },
      { status: 403 },
    );
  try {
    const client = await serverSupabase();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL("/auth/callback", origin).toString(),
        scopes: "openid email profile",
      },
    });
    if (!error && data.url) return NextResponse.redirect(data.url, 303);
  } catch {}
  return NextResponse.redirect(new URL("/login?error=signin", origin), 303);
}
