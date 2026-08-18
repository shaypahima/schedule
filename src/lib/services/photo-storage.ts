/**
 * PhotoStorage — where progress/profile photos live (#61).
 *
 * One adapter per environment: Supabase Storage (cloud, private bucket from
 * migration 00019, served via long-lived signed URLs), local disk under
 * public/uploads (PG_DEV — Next serves it statically), in-memory mock (tests).
 * Callers get back a URL ready to stamp on a row; nothing else leaks through.
 */

export interface PhotoUpload {
  traineeId: string;
  bytes: Uint8Array;
  contentType: string;
}

export interface PhotoStorage {
  upload(input: PhotoUpload): Promise<{ url: string }>;
}

export const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let override: PhotoStorage | undefined;
let instance: PhotoStorage | undefined;

/** Test seam — pass undefined to restore the environment-selected adapter. */
export function setPhotoStorage(storage?: PhotoStorage): void {
  override = storage;
}

export function getPhotoStorage(): PhotoStorage {
  if (override) return override;
  if (!instance) {
    if (process.env.MOCK_SERVICES === "true") {
      instance = new MockPhotoStorage();
    } else {
      // Lazy requires keep fs/supabase out of test bundles.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isPgDriver } = require("@/lib/pg/client");
      if (isPgDriver()) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { LocalDiskPhotoStorage } = require("@/lib/pg/photo-storage");
        instance = new LocalDiskPhotoStorage();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { SupabasePhotoStorage } = require("@/lib/supabase/photo-storage");
        instance = new SupabasePhotoStorage();
      }
    }
  }
  return instance!;
}

/** In-memory adapter for dev/testing. */
export class MockPhotoStorage implements PhotoStorage {
  public uploads: PhotoUpload[] = [];
  private seq = 0;

  async upload(input: PhotoUpload): Promise<{ url: string }> {
    this.uploads.push(input);
    const ext = PHOTO_EXTENSIONS[input.contentType] ?? "bin";
    return { url: `https://photos.test/${input.traineeId}/${++this.seq}.${ext}` };
  }
}
