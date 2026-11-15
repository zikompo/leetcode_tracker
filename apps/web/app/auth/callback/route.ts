import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** GitHub sends people back here with a one-time code; swap it for a session cookie. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  // Only ever redirect within this site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }
  return NextResponse.redirect(new URL("/?error=Sign-in%20was%20cancelled", url.origin));
}
