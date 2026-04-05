import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/services/session";
import { getRealCalendarService } from "@/lib/services";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=no_code", request.url)
    );
  }

  const calendarService = getRealCalendarService();
  if (!calendarService) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=not_configured", request.url)
    );
  }

  try {
    await calendarService.handleAuthCallback(code);
    return NextResponse.redirect(
      new URL("/admin/settings?connected=true", request.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/admin/settings?error=auth_failed", request.url)
    );
  }
}
