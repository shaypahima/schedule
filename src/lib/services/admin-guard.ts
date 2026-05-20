import { NextRequest, NextResponse } from "next/server";
import { getJwtSession } from "./jwt-session";
import { findProfile, Profile } from "./profile-repo";

type Ok = { profile: Profile; error: null };
type Fail = { profile: null; error: NextResponse };

export async function requireAdminJwt(req: NextRequest): Promise<Ok | Fail> {
  const session = await getJwtSession(req);
  if (!session) {
    return {
      profile: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const profile = await findProfile(session.userId);
  if (!profile) {
    return {
      profile: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (profile.role !== "admin") {
    return {
      profile: null,
      error: NextResponse.json({ error: "Coach only" }, { status: 403 }),
    };
  }
  return { profile, error: null };
}
