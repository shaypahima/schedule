import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { setSession } from "@/lib/services/session";

export async function POST(request: NextRequest) {
  const { phone, code } = await request.json();

  if (!phone || !code) {
    return NextResponse.json(
      { error: "Phone and code required" },
      { status: 400 }
    );
  }

  try {
    const profile = await getAuthService().verifyOtp(phone, code);
    await setSession(profile);
    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      role: profile.role,
    });
  } catch {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }
}
