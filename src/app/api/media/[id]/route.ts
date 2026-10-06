import { db } from "@/lib/db";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireGate } from "@/lib/age";
import { storage } from "@/providers/storage";
import { canReadMedia } from "@/services/entitlements";
import { safeError, AppError } from "@/lib/security";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireGate();
    const id = (await params).id;
    const media = await db.creatorMedia.findUnique({
      where: { id },
      include: { creator: true },
    });
    if (
      !media ||
      media.deletedAt ||
      media.moderation !== "APPROVED" ||
      media.creator.deletedAt ||
      media.creator.moderation !== "APPROVED"
    )
      throw new AppError(404, "Media unavailable.");
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session
      ? await db.user.findUnique({
          where: { id: session.user.id },
          include: { age: true },
        })
      : null;
    const allowedUser =
      user?.status === "ACTIVE" &&
      !user.deletedAt &&
      user.age &&
      ["SELF_DECLARED", "VERIFIED"].includes(user.age.state)
        ? user
        : undefined;
    const allowed = await canReadMedia(allowedUser?.id, id);
    if (!allowed) throw new AppError(403, "Unlock this content to view it.");
    const bytes = await storage.get(media.storageKey);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": media.mimeType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${media.id}.${media.type === "VOICE" ? "wav" : "svg"}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return safeError(e);
  }
}
