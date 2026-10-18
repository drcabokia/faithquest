import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  accountsEnabled,
  storageMode,
  supabaseSettings,
} from "@/lib/supabase/config";
import { authFailure } from "@/lib/supabase/auth-failure";
import { accountSessionFailure } from "@/lib/supabase/account-session";
import { operationTrace } from "../supabase/functions/_shared/operations";
const journeyRoutes = [
  "/dashboard",
  "/reading-plan",
  "/bible",
  "/quiz",
  "/journal",
  "/achievements",
  "/community",
  "/profile",
  "/study",
  "/challenges",
];
export async function proxy(request: NextRequest) {
  if (storageMode() === "demo") return NextResponse.next();
  const protectedPage = journeyRoutes.includes(request.nextUrl.pathname);
  if (!accountsEnabled()) {
    if (protectedPage)
      return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const trace = operationTrace("proxy");
  function unavailable() {
    const reference = trace.record(503);
    const failed = new NextResponse(
      `Your account service is temporarily unavailable. Refresh this page to try again. Reference: ${reference}`,
      {
        status: 503,
        headers: { "Retry-After": "5", "X-Request-ID": reference },
      },
    );
    for (const cookie of response.cookies.getAll()) failed.cookies.set(cookie);
    return failed;
  }
  try {
    const { url, key } = supabaseSettings();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          for (const item of items) request.cookies.set(item.name, item.value);
          response = NextResponse.next({ request });
          for (const item of items)
            response.cookies.set(item.name, item.value, item.options);
        },
      },
    });
    const { data, error } = await supabase.auth.getClaims();
    const failure = protectedPage
      ? error || !data?.claims?.sub
        ? authFailure(error)
        : await accountSessionFailure(supabase)
      : null;
    if (failure) {
      if (failure.status === 503) response = unavailable();
      else {
        const redirect = NextResponse.redirect(new URL("/login", request.url));
        for (const cookie of response.cookies.getAll())
          redirect.cookies.set(cookie);
        response = redirect;
      }
    }
  } catch {
    if (protectedPage) response = unavailable();
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}
export const config = {
  matcher: [
    "/dashboard",
    "/reading-plan",
    "/bible",
    "/quiz",
    "/journal",
    "/achievements",
    "/community",
    "/profile",
    "/study",
    "/challenges",
    "/login",
    "/auth/:path*",
    "/api/journey",
    "/api/fellowship",
    "/api/account/export",
    "/api/account/delete",
    "/api/account/health",
    "/api/account/restore",
  ],
};
