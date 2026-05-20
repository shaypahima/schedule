import { NextRequest, NextResponse } from "next/server";
import { getJwtSession } from "@/lib/services/jwt-session";
import { findProfile } from "@/lib/services/profile-repo";
import { getRealCalendarService } from "@/lib/services";

export async function GET(request: NextRequest) {
  const session = await getJwtSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await findProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Coach only" }, { status: 403 });
  }

  const calendar = getRealCalendarService();
  if (!calendar) return NextResponse.json({ connected: false, mock: true });

  const connected = await calendar.isConnected();
  return NextResponse.json({ connected });
}
