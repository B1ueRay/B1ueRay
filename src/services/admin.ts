import { db } from "@/lib/db";
import { AppError } from "@/lib/security";
import { generate, reviewGeneration } from "./generation";
import { updateRequest } from "./requests";
import { refund } from "./payments";
import { moderation } from "@/providers/mock";
import type { AdminCommand } from "@/lib/admin-schema";
import type { Role } from "@prisma/client";
export async function executeAdmin(
  u: { id: string; role: Role },
  v: AdminCommand,
) {
  const creatorActions = [
    "generate",
    "createPost",
    "creator",
    "request",
    "paidMessage",
  ];
  const moderationActions = ["reviewGeneration", "content", "report"];
  if (
    u.role !== "ADMIN" &&
    !(u.role === "CREATOR_MANAGER" && creatorActions.includes(v.action)) &&
    !(u.role === "MODERATOR" && moderationActions.includes(v.action))
  )
    throw new AppError(403, "Your role cannot perform this action.");
  if (v.action === "generate")
    return generate(u.id, v.creatorId, v.type, v.brief, v.negativePrompt);
  if (v.action === "reviewGeneration")
    return reviewGeneration(u.id, v.jobId, v.approve);
  if (v.action === "refund") {
    await refund(u.id, v.paymentId);
    return { ok: true };
  }
  if (v.action === "request")
    return updateRequest(
      u.id,
      v.requestId,
      v.status,
      v.reason,
      v.fulfilledMediaId,
    );
  await db.$transaction(async (tx) => {
    let targetId = "site",
      targetType = v.action.toUpperCase();
    if (v.action === "createPost") {
      if (!(await moderation.text(v.title + " " + v.body)).allowed)
        throw new AppError(422, "Post copy did not pass moderation.");
      const media = await tx.creatorMedia.findFirst({
        where: {
          id: v.mediaId,
          creatorId: v.creatorId,
          moderation: "APPROVED",
          deletedAt: null,
        },
      });
      if (!media)
        throw new AppError(
          400,
          "Choose an approved asset belonging to this creator.",
        );
      const cfg = await tx.siteConfiguration.findUnique({
        where: { key: "pricing" },
      });
      if (!cfg)
        throw new AppError(503, "Pricing configuration is unavailable.");
      const pricing = cfg.value as { ppvMin: number; ppvMax: number };
      if (
        v.visibility === "PPV" &&
        (v.price < pricing.ppvMin || v.price > pricing.ppvMax)
      )
        throw new AppError(400, "PPV price outside configured bounds.");
      const scheduledAt = v.scheduledAt ? new Date(v.scheduledAt) : null;
      if (scheduledAt && Number.isNaN(scheduledAt.getTime()))
        throw new AppError(400, "Invalid scheduled date.");
      const post = await tx.creatorPost.create({
        data: {
          creatorId: v.creatorId,
          title: v.title,
          body: v.body,
          visibility: v.visibility,
          price: v.visibility === "PPV" ? v.price : 0,
          moderation: v.publish ? "APPROVED" : "DRAFT",
          publishedAt: v.publish ? scheduledAt || new Date() : null,
          scheduledAt,
          media: { create: { mediaId: media.id } },
        },
      });
      targetId = post.id;
      targetType = "POST";
      if (v.publish && !scheduledAt) {
        const subscribers = await tx.subscription.findMany({
          where: {
            creatorId: v.creatorId,
            status: "ACTIVE",
            currentPeriodEnd: { gt: new Date() },
          },
          select: { userId: true },
        });
        await tx.notification.createMany({
          data: subscribers.map((s) => ({
            userId: s.userId,
            type: "POST",
            title: "A new private chapter",
            body: "Your creator has shared a new post.",
            href: "/app/feed",
          })),
        });
      }
    } else if (v.action === "creator") {
      if (v.tipMax < v.tipMin)
        throw new AppError(400, "Tip minimum exceeds maximum.");
      await tx.creator.update({
        where: { id: v.creatorId },
        data: {
          name: v.name,
          bio: v.bio,
          category: v.category,
          tags: v.tags,
          languages: v.languages,
          featured: v.featured,
        },
      });
      await tx.subscriptionPlan.updateMany({
        where: { creatorId: v.creatorId, active: true },
        data: { price: v.price },
      });
      await tx.creatorSettings.update({
        where: { creatorId: v.creatorId },
        data: {
          chatAccess: v.chatAccess,
          paidMessagePrice: v.paidMessagePrice,
          tipMin: v.tipMin,
          tipMax: v.tipMax,
          requestStartingPrice: v.requestStartingPrice,
        },
      });
      targetId = v.creatorId;
    } else if (v.action === "userStatus") {
      if (v.userId === u.id)
        throw new AppError(400, "You cannot suspend your own account.");
      await tx.user.update({
        where: { id: v.userId },
        data: { status: v.status },
      });
      if (v.status !== "ACTIVE")
        await tx.session.deleteMany({ where: { userId: v.userId } });
      targetId = v.userId;
    } else if (v.action === "content") {
      await tx.creatorPost.update({
        where: { id: v.postId },
        data: {
          moderation: v.state,
          publishedAt: v.state === "APPROVED" ? new Date() : undefined,
          deletedAt: v.state === "REMOVED" ? new Date() : undefined,
        },
      });
      targetId = v.postId;
    } else if (v.action === "report") {
      const report = await tx.report.findUnique({
        where: { id: v.reportId },
        include: { cases: true },
      });
      if (!report) throw new AppError(404, "Report unavailable.");
      if (v.decision !== "NONE" && v.status !== "ACTIONED")
        throw new AppError(
          400,
          "An enforcement decision requires ACTIONED status.",
        );
      if (["HIDE", "REMOVE"].includes(v.decision)) {
        const state = v.decision === "HIDE" ? "HIDDEN" : "REMOVED";
        if (report.targetType === "POST")
          await tx.creatorPost.update({
            where: { id: report.targetId },
            data: { moderation: state },
          });
        else if (report.targetType === "CREATOR")
          await tx.creator.update({
            where: { id: report.targetId },
            data: { moderation: state },
          });
        else if (report.targetType === "MESSAGE")
          await tx.message.update({
            where: { id: report.targetId },
            data: { moderation: state },
          });
        else
          throw new AppError(
            400,
            "This decision is unavailable for this target.",
          );
      } else if (["SUSPEND", "BAN"].includes(v.decision)) {
        if (report.targetType !== "USER" || report.targetId === u.id)
          throw new AppError(400, "Choose a user report for this decision.");
        await tx.user.update({
          where: { id: report.targetId },
          data: { status: v.decision === "BAN" ? "BANNED" : "SUSPENDED" },
        });
        await tx.session.deleteMany({ where: { userId: report.targetId } });
      }
      await tx.report.update({
        where: { id: report.id },
        data: { status: v.status },
      });
      for (const c of report.cases) {
        await tx.moderationCase.update({
          where: { id: c.id },
          data: { status: v.status },
        });
        await tx.moderationAction.create({
          data: {
            caseId: c.id,
            operatorId: u.id,
            action: v.decision,
            reason: v.reason,
          },
        });
      }
      targetId = report.id;
    } else if (v.action === "config") {
      if (v.ppvMin > v.ppvMax)
        throw new AppError(400, "Minimum exceeds maximum.");
      await tx.siteConfiguration.upsert({
        where: { key: "reportReasons" },
        create: { key: "reportReasons", value: v.reportReasons },
        update: { value: v.reportReasons },
      });
      await tx.siteConfiguration.upsert({
        where: { key: "pricing" },
        create: {
          key: "pricing",
          value: { ppvMin: v.ppvMin, ppvMax: v.ppvMax },
        },
        update: { value: { ppvMin: v.ppvMin, ppvMax: v.ppvMax } },
      });
    } else if (v.action === "paidMessage") {
      if (!(await moderation.text(v.body + " " + v.preview)).allowed)
        throw new AppError(422, "Message rejected by moderation.");
      const c = await tx.conversation.findUnique({
        where: { id: v.conversationId },
        include: { creator: { include: { settings: true } } },
      });
      if (!c || c.deletedAt)
        throw new AppError(404, "Conversation unavailable.");
      if (
        v.mediaId &&
        !(await tx.creatorMedia.findFirst({
          where: {
            id: v.mediaId,
            creatorId: c.creatorId,
            moderation: "APPROVED",
            deletedAt: null,
          },
        }))
      )
        throw new AppError(400, "Invalid attachment.");
      const media = v.mediaId
        ? await tx.creatorMedia.findUniqueOrThrow({
            where: { id: v.mediaId },
          })
        : null;
      const m = await tx.message.create({
        data: {
          conversationId: c.id,
          sender: "CREATOR",
          type: "LOCKED",
          body: v.body,
          preview: v.preview,
          price: c.creator.settings!.paidMessagePrice,
          attachments: media
            ? { create: { mediaId: media.id, type: media.type } }
            : undefined,
        },
      });
      targetId = m.id;
      await tx.notification.create({
        data: {
          userId: c.userId,
          type: "LOCKED_MESSAGE",
          title: `A private note from ${c.creator.name}`,
          body: v.preview,
          href: `/app/messages?conversation=${c.id}`,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        operatorId: u.id,
        action: v.action.toUpperCase(),
        targetType,
        targetId,
        metadata: "reason" in v ? { reason: v.reason } : {},
      },
    });
  });
  return { ok: true };
}
