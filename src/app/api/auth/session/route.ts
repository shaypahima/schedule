import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/services/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}
