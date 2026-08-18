import { NextRequest, NextResponse } from "next/server";
import { getJwtSession } from "@/lib/services/jwt-session";
import { loadOrProvisionProfile } from "@/lib/auth/provision";

export async function GET(req: NextRequest) {
  const session = await getJwtSession(req);
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const profile = await loadOrProvisionProfile({
    userId: session.userId,
    email: session.email,
  });
  return NextResponse.json(profile);
}
