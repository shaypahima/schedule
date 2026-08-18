import { NextRequest, NextResponse } from "next/server";
import { requireActiveTrainee } from "@/lib/auth/require";
import {
  getPhotoStorage,
  PHOTO_EXTENSIONS,
} from "@/lib/services/photo-storage";

const MAX_BYTES = 5 * 1024 * 1024;

/** Upload a progress/profile photo (#61). multipart field: `photo`. */
export async function POST(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "PHOTO_REQUIRED" }, { status: 400 });
  }
  if (!PHOTO_EXTENSIONS[photo.type]) {
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json({ error: "TOO_LARGE" }, { status: 400 });
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const { url } = await getPhotoStorage().upload({
    traineeId: r.trainee.userId,
    bytes,
    contentType: photo.type,
  });
  return NextResponse.json({ url }, { status: 201 });
}
