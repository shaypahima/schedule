import { NextRequest, NextResponse } from "next/server";
import { getJwtSession } from "@/lib/services/jwt-session";
import { getCoachInfo } from "@/lib/services/coach-info-repo";

export async function GET(request: NextRequest) {
  const session = await getJwtSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const info = await getCoachInfo();
  if (!info) return NextResponse.json({ error: "No coach configured" }, { status: 404 });

  return NextResponse.json(info);
}
