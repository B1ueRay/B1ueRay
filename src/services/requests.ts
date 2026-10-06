import { db } from "@/lib/db";
import { AppError } from "@/lib/security";
export async function updateRequest(
  operatorId: string,
  requestId: string,
  status: "ACCEPTED" | "COMPLETED" | "REJECTED",
  reason: string,
  fulfilledMediaId?: string,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ContentRequest" WHERE "id"=${requestId} FOR UPDATE`;
    const req = await tx.contentRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new AppError(404, "Request unavailable.");
    if (req.status === "REFUNDED")
      throw new AppError(409, "Refunded requests cannot be fulfilled.");
    if (status === "COMPLETED") {
      if (!fulfilledMediaId)
        throw new AppError(400, "Choose a reviewed asset for delivery.");
      const media = await tx.creatorMedia.findFirst({
        where: {
          id: fulfilledMediaId,
          creatorId: req.creatorId,
          moderation: "APPROVED",
          deletedAt: null,
        },
      });
      if (!media)
        throw new AppError(
          400,
          "Deliver an approved asset belonging to the requested creator.",
        );
    }
    await tx.contentRequest.update({
      where: { id: requestId },
      data: {
        status,
        fulfilledMediaId: status === "COMPLETED" ? fulfilledMediaId : null,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });
    await tx.notification.create({
      data: {
        userId: req.userId,
        type: "REQUEST",
        title:
          status === "COMPLETED"
            ? "Your creative moment is ready"
            : "Your creative request has an update",
        body: `Request ${status.toLowerCase()}.`,
        href: "/app/purchases",
      },
    });
    await tx.auditLog.create({
      data: {
        operatorId,
        action: "REQUEST",
        targetType: "REQUEST",
        targetId: requestId,
        metadata: { status, reason },
      },
    });
    return { ok: true };
  });
}
