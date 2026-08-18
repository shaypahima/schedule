import { NextRequest, NextResponse } from "next/server";
import { requirePendingTrainee } from "@/lib/auth/require";
import { validateIntro, saveIntro } from "@/lib/auth/intro";

const MESSAGES: Record<string, string> = {
  PHONE_INVALID: "phone must be E.164 (e.g. +972501234567)",
  INTRO_TOO_SHORT: "introText must be at least 10 chars",
};

export async function POST(request: NextRequest) {
  const r = await requirePendingTrainee(request);
  if ("error" in r) return r.error;

  if (r.trainee.hasIntro) {
    return NextResponse.json({ error: "INTRO_ALREADY_SUBMITTED" }, { status: 409 });
  }

  const body = (await request.json()) as { phone?: string; introText?: string };
  const parsed = validateIntro(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, message: MESSAGES[parsed.error] },
      { status: 400 },
    );
  }

  try {
    await saveIntro(r.trainee.userId, parsed.value);
  } catch (e) {
    return NextResponse.json(
      { error: "DB_ERROR", message: (e as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
