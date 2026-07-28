import { put } from "@vercel/blob";
import { BookingError } from "./validation";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 1_500_000;

export type StoredAvatar = {
  url: string;
};

export async function storeAvatarFile(file: File, eventId: string): Promise<StoredAvatar> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new BookingError("INVALID_INPUT");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new BookingError("INVALID_INPUT");
  }

  const extension = extensionFor(file.type);
  const pathname = `avatars/${eventId}-${Date.now()}.${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(pathname, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
    });
    return { url: blob.url };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  return { url: dataUrl };
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}
