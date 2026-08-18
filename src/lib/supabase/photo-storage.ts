import {
  PhotoStorage,
  PhotoUpload,
  PHOTO_EXTENSIONS,
} from "@/lib/services/photo-storage";
import { getSupabaseAdminClient } from "./client";

const BUCKET = "progress-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // bucket is private (00019)

/** Supabase Storage adapter — service-role upload + long-lived signed URL. */
export class SupabasePhotoStorage implements PhotoStorage {
  async upload(input: PhotoUpload): Promise<{ url: string }> {
    const ext = PHOTO_EXTENSIONS[input.contentType] ?? "bin";
    const objectPath = `${input.traineeId}/${crypto.randomUUID()}.${ext}`;
    const storage = getSupabaseAdminClient().storage.from(BUCKET);

    const { error } = await storage.upload(objectPath, input.bytes, {
      contentType: input.contentType,
    });
    if (error) throw new Error(`photo upload failed: ${error.message}`);

    const { data, error: signError } = await storage.createSignedUrl(
      objectPath,
      SIGNED_URL_TTL_SECONDS
    );
    if (signError || !data) {
      throw new Error(`photo sign failed: ${signError?.message}`);
    }
    return { url: data.signedUrl };
  }
}
