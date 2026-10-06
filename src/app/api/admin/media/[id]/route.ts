import { adultActor, safeError, AppError } from "@/lib/security";
import { db } from "@/lib/db";
import { storage } from "@/providers/storage";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await adultActor(["ADMIN", "CREATOR_MANAGER", "MODERATOR"]);
    const a = await db.creatorMedia.findUnique({
      where: { id: (await params).id },
    });
    if (!a || a.deletedAt) throw new AppError(404, "Media unavailable.");
    return new Response(new Uint8Array(await storage.get(a.storageKey)), {
      headers: {
        "Content-Type": a.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return safeError(e);
  }
}
