import { NextResponse, type NextRequest } from "next/server";
import { accountsEnabled, appOrigin } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
export async function POST(request: NextRequest) {
  const origin = appOrigin();
  if (request.headers.get("origin") !== origin)
    return NextResponse.json(
      { error: "Request origin was not accepted." },
      { status: 403 },
    );
  if (accountsEnabled()) {
    try {
      const client = await serverSupabase();
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error)
        return NextResponse.json(
          { error: "Could not sign out. Please retry." },
          { status: 503 },
        );
    } catch {
      return NextResponse.json(
        { error: "Could not sign out. Please retry." },
        { status: 503 },
      );
    }
  }
  const response = NextResponse.redirect(new URL("/login", origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
