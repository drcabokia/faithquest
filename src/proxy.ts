import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  accountsEnabled,
  storageMode,
  supabaseSettings,
} from "@/lib/supabase/config";
const journeyRoutes = [
  "/dashboard",
  "/reading-plan",
  "/bible",
  "/quiz",
  "/journal",
  "/achievements",
  "/community",
  "/profile",
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
    if (protectedPage && (error || !data?.claims?.sub)) {
      const redirect = NextResponse.redirect(new URL("/login", request.url));
      for (const cookie of response.cookies.getAll())
        redirect.cookies.set(cookie);
      response = redirect;
    }
  } catch {
    if (protectedPage)
      response = NextResponse.redirect(
        new URL("/login?error=connection", request.url),
      );
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
    "/login",
    "/auth/:path*",
    "/api/journey",
  ],
};
