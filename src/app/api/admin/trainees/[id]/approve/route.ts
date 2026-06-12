import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCoach } from "@/lib/auth/require";
import { loadProfile } from "@/lib/auth/profile-repo";
import { isPgDriver, pgQuery } from "@/lib/pg/client";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const target = await loadProfile(id);
  if (!target) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (target.role !== "trainee") {
    return NextResponse.json({ error: "NOT_A_TRAINEE" }, { status: 400 });
  }
  if (target.status !== "pending") {
    return NextResponse.json(
      { error: "NOT_PENDING", message: `status is ${target.status}` },
      { status: 409 }
    );
  }
  if (!target.hasIntro) {
    return NextResponse.json(
      { error: "INTRO_MISSING", message: "Trainee has not submitted intro yet" },
      { status: 409 }
    );
  }

  if (isPgDriver()) {
    await pgQuery("update profiles set status = 'active' where id = $1", [id]);
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin()
    .from("profiles")
    .update({ status: "active" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "DB_ERROR", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
