import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type UploadMetadata,
} from "firebase/storage";
import type { JournalImage } from "../types/journal";
import { getFirebaseStorage } from "./firebase";

export const JOURNAL_IMAGE_MAX_COUNT = 3;
export const JOURNAL_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function journalImagePath(uid: string, entryId: string, fileName: string): string {
  return `users/${uid}/journal/${entryId}/${fileName}`;
}

function safeFileName(original: string): string {
  const ext = original.includes(".") ? original.split(".").pop()?.toLowerCase() : "jpg";
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}.${ext ?? "jpg"}`;
}

export function validateJournalImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "JPEG / PNG / WebP の画像のみ添付できます";
  }
  if (file.size > JOURNAL_IMAGE_MAX_BYTES) {
    return "画像は 2MB 以下にしてください";
  }
  return null;
}

export async function uploadJournalImages(
  uid: string,
  entryId: string,
  files: File[],
): Promise<JournalImage[]> {
  const storage = getFirebaseStorage();
  const uploaded: JournalImage[] = [];

  for (const file of files) {
    const error = validateJournalImageFile(file);
    if (error) throw new Error(error);
    const path = journalImagePath(uid, entryId, safeFileName(file.name));
    const metadata: UploadMetadata = { contentType: file.type };
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, metadata);
    const url = await getDownloadURL(storageRef);
    uploaded.push({ url, name: file.name });
  }

  return uploaded;
}

export async function deleteJournalImages(uid: string, entryId: string, images: JournalImage[]): Promise<void> {
  const storage = getFirebaseStorage();
  await Promise.all(
    images.map(async (image) => {
      try {
        const path = decodeURIComponent(new URL(image.url).pathname.split("/o/")[1]?.split("?")[0] ?? "");
        if (!path.startsWith(`users/${uid}/journal/${entryId}/`)) return;
        await deleteObject(ref(storage, path));
      } catch {
        // ignore missing objects
      }
    }),
  );
}

/** Extract storage path from Firebase download URL */
function pathFromDownloadUrl(url: string): string | null {
  try {
    const encoded = new URL(url).pathname.split("/o/")[1]?.split("?")[0];
    return encoded ? decodeURIComponent(encoded) : null;
  } catch {
    return null;
  }
}

export async function deleteRemovedJournalImages(
  uid: string,
  entryId: string,
  previous: JournalImage[],
  next: JournalImage[],
): Promise<void> {
  const nextUrls = new Set(next.map((i) => i.url));
  const removed = previous.filter((i) => !nextUrls.has(i.url));
  if (removed.length === 0) return;

  const storage = getFirebaseStorage();
  await Promise.all(
    removed.map(async (image) => {
      const path = pathFromDownloadUrl(image.url);
      if (!path || !path.startsWith(`users/${uid}/journal/${entryId}/`)) return;
      try {
        await deleteObject(ref(storage, path));
      } catch {
        // ignore
      }
    }),
  );
}
