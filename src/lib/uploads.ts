import { randomUUID } from "node:crypto";
import { AppError } from "./security";
const allowed: Record<
  string,
  { extension: string; check: (b: Buffer) => boolean }
> = {
  "image/png": {
    extension: "png",
    check: (b) =>
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  "image/jpeg": {
    extension: "jpg",
    check: (b) => b[0] === 255 && b[1] === 216 && b[2] === 255,
  },
  "image/webp": {
    extension: "webp",
    check: (b) =>
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  "audio/wav": {
    extension: "wav",
    check: (b) =>
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WAVE",
  },
};
/** External upload adapters must validate before storage and submit results for moderation. */
export function validateUpload(bytes: Buffer, mime: string) {
  const type = allowed[mime];
  if (!type) throw new AppError(415, "Unsupported file type.");
  if (bytes.length < 12 || bytes.length > 10 * 1024 * 1024)
    throw new AppError(413, "Invalid file size.");
  if (!type.check(bytes))
    throw new AppError(415, "File signature does not match its declared type.");
  return {
    key: `uploads/${randomUUID()}.${type.extension}`,
    size: bytes.length,
    mimeType: mime,
    moderation: "REVIEW" as const,
  };
}
