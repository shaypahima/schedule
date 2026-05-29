import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePendingTrainee } from "@/lib/auth/require";
import { isPgDriver, pgQuery } from "@/lib/pg/client";

const E164 = /^\+\d{8,15}$/;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  const r = await requirePendingTrainee(request);
  if ("error" in r) return r.error;

  if (r.trainee.hasIntro) {
    return NextResponse.json(
      { error: "INTRO_ALREADY_SUBMITTED" },
      { status: 409 }
    );
  }

  const body = (await request.json()) as { phone?: string; introText?: string };
  if (typeof body.phone !== "string" || !E164.test(body.phone)) {
    return NextResponse.json(
      { error: "PHONE_INVALID", message: "phone must be E.164 (e.g. +972501234567)" },
      { status: 400 }
    );
  }
  const introText = body.introText?.trim() ?? "";
  if (introText.length < 10) {
    return NextResponse.json(
      { error: "INTRO_TOO_SHORT", message: "introText must be at least 10 chars" },
      { status: 400 }
    );
  }

  if (isPgDriver()) {
    await pgQuery(
      `insert into trainee_profile (id, phone, intro_text, updated_at)
         values ($1, $2, $3, now())
         on conflict (id) do update set
           phone = excluded.phone, intro_text = excluded.intro_text, updated_at = now()`,
      [r.trainee.userId, body.phone, introText],
    );
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin()
    .from("trainee_profile")
    .upsert({
      id: r.trainee.userId,
      phone: body.phone,
      intro_text: introText,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: "DB_ERROR", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
