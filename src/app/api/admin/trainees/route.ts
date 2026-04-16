import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-guard";
import { getAuthService } from "@/lib/services";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const trainees = await getAuthService().getTrainees();
  return NextResponse.json({
    trainees: trainees.map((t) => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      isRecurring: t.isRecurring,
      preferredDay: t.preferredDay,
      preferredTime: t.preferredTime,
      isActive: t.isActive,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { phone, name } = await request.json();
  if (!phone || !name) {
    return NextResponse.json({ error: "phone and name required" }, { status: 400 });
  }

  try {
    const profile = await getAuthService().inviteTrainee(phone, name);
    return NextResponse.json(profile, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 409 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id, ...updates } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const profile = await getAuthService().updateTrainee(id, updates);
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 404 }
    );
  }
}
