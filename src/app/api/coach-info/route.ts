import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/auth/require";
import { getCoachInfo } from "@/lib/services/coach-info-repo";

export async function GET(request: NextRequest) {
  const r = await requireAuthenticated(request);
  if ("error" in r) return r.error;

  const info = await getCoachInfo();
  if (!info) return NextResponse.json({ error: "No coach configured" }, { status: 404 });

  return NextResponse.json(info);
}
