import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";

export async function POST(request: NextRequest) {
  const { phone } = await request.json();

  if (!phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  await getContainer().auth.sendOtp(phone);
  return NextResponse.json({ success: true });
}
