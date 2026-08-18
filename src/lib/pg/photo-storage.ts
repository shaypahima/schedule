import { promises as fs } from "fs";
import path from "path";
import {
  PhotoStorage,
  PhotoUpload,
  PHOTO_EXTENSIONS,
} from "@/lib/services/photo-storage";

/**
 * Local-disk PhotoStorage for the native-Postgres dev path (no Storage
 * service). Files land under public/uploads, which Next serves statically in
 * dev; the returned URL is relative — clients resolve it against the API base.
 */
export class LocalDiskPhotoStorage implements PhotoStorage {
  constructor(
    private root = path.join(process.cwd(), "public", "uploads", "progress-photos")
  ) {}

  async upload(input: PhotoUpload): Promise<{ url: string }> {
    const ext = PHOTO_EXTENSIONS[input.contentType] ?? "bin";
    const dir = path.join(this.root, input.traineeId);
    await fs.mkdir(dir, { recursive: true });
    const file = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(dir, file), input.bytes);
    return { url: `/uploads/progress-photos/${input.traineeId}/${file}` };
  }
}
