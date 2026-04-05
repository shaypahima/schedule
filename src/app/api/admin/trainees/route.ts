import { NextResponse } from "next/server";
import { getSession } from "@/lib/services/session";
import { getAuthService } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const trainees = await getAuthService().getTrainees();
  return NextResponse.json({
    trainees: trainees.map((t) => ({ id: t.id, name: t.name, phone: t.phone })),
  });
}
