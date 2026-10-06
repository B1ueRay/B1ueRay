import { z } from "zod";
import { db } from "@/lib/db";
import {
  adultActor,
  sameOrigin,
  limit,
  safeError,
  AppError,
} from "@/lib/security";
import { checkout } from "@/services/payments";
import { openConversation, sendMessage, readMessages } from "@/services/chat";
const id = z.string().min(1).max(100);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("favorite"), creatorId: id }),
  z.object({
    action: z.literal("checkout"),
    kind: z.enum([
      "SUBSCRIPTION",
      "RENEWAL",
      "PPV",
      "MESSAGE",
      "TIP",
      "REQUEST",
    ]),
    targetId: id,
    idempotencyKey: z.string().uuid(),
    amount: z.number().int().positive().optional(),
    brief: z.string().max(1000).optional(),
    simulateFailure: z.boolean().optional(),
  }),
  z.object({ action: z.literal("conversation"), creatorId: id }),
  z.object({
    action: z.literal("message"),
    conversationId: id,
    text: z.string().trim().min(1).max(2000),
  }),
  z.object({ action: z.literal("deleteConversation"), conversationId: id }),
  z.object({ action: z.literal("cancelSubscription"), subscriptionId: id }),
  z.object({ action: z.literal("notificationsRead") }),
  z.object({
    action: z.literal("report"),
    targetType: z.enum(["CREATOR", "POST", "MESSAGE", "USER"]),
    targetId: id,
    reason: z.string().min(1).max(100),
    detail: z.string().trim().max(2000),
  }),
  z.object({
    action: z.literal("settings"),
    memoryEnabled: z.boolean(),
    analyticsConsent: z.boolean(),
    emailNotifications: z.boolean(),
  }),
  z.object({ action: z.literal("deleteAccount") }),
  z.object({
    action: z.literal("block"),
    blockedUserId: id,
    remove: z.boolean().optional(),
  }),
  z.object({ action: z.literal("clearMemory") }),
  z.object({
    action: z.literal("event"),
    name: z.enum([
      "landing_view",
      "creator_view",
      "profile_click",
      "ppv_viewed",
      "subscription_checkout_started",
    ]),
    creatorId: id.optional(),
  }),
]);
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const u = await adultActor();
    await limit(`action:${u.id}`, 80);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new AppError(400, "Invalid request.");
    const input = parsed.data;
    switch (input.action) {
      case "favorite": {
        const c = await db.creator.findFirst({
          where: {
            id: input.creatorId,
            moderation: "APPROVED",
            deletedAt: null,
          },
        });
        if (!c) throw new AppError(404, "Creator unavailable.");
        const key = { userId: u.id, creatorId: c.id };
        const old = await db.favorite.findUnique({
          where: { userId_creatorId: key },
        });
        if (old) await db.favorite.delete({ where: { id: old.id } });
        else await db.favorite.create({ data: key });
        if (!old && u.settings?.analyticsConsent)
          await db.analyticsEvent.create({
            data: { userId: u.id, creatorId: c.id, name: "creator_favorite" },
          });
        return Response.json({ favorited: !old });
      }
      case "checkout":
        await limit(`checkout:${u.id}`, 15);
        return Response.json(await checkout(u.id, input));
      case "conversation":
        return Response.json({
          id: (await openConversation(u.id, input.creatorId)).id,
        });
      case "message":
        await limit(`chat:${u.id}`, 20);
        await sendMessage(u.id, input.conversationId, input.text);
        return Response.json(await readMessages(u.id, input.conversationId));
      case "deleteConversation": {
        const c = await db.conversation.findFirst({
          where: { id: input.conversationId, userId: u.id },
        });
        if (!c) throw new AppError(404, "Conversation unavailable.");
        await db.$transaction([
          db.message.deleteMany({ where: { conversationId: c.id } }),
          db.conversation.update({
            where: { id: c.id },
            data: { memory: {}, summary: null, deletedAt: new Date() },
          }),
        ]);
        return Response.json({ ok: true });
      }
      case "cancelSubscription":
        await db.subscription.updateMany({
          where: { id: input.subscriptionId, userId: u.id, status: "ACTIVE" },
          data: { cancelAtPeriodEnd: true },
        });
        return Response.json({ ok: true });
      case "notificationsRead":
        await db.notification.updateMany({
          where: { userId: u.id, readAt: null },
          data: { readAt: new Date() },
        });
        return Response.json({ ok: true });
      case "report": {
        const config = await db.siteConfiguration.findUnique({
          where: { key: "reportReasons" },
        });
        if (!((config?.value as string[]) || []).includes(input.reason))
          throw new AppError(400, "Invalid report reason.");
        const target =
          input.targetType === "CREATOR"
            ? await db.creator.findUnique({ where: { id: input.targetId } })
            : input.targetType === "POST"
              ? await db.creatorPost.findUnique({
                  where: { id: input.targetId },
                })
              : input.targetType === "USER"
                ? await db.user.findUnique({
                    where: { id: input.targetId },
                    select: { id: true },
                  })
                : await db.message.findFirst({
                    where: {
                      id: input.targetId,
                      conversation: { userId: u.id },
                    },
                  });
        if (!target) throw new AppError(404, "Report target unavailable.");
        const report = await db.report.create({
          data: {
            userId: u.id,
            targetType: input.targetType,
            targetId: input.targetId,
            reason: input.reason,
            detail: input.detail,
            cases: {
              create: {
                targetType: input.targetType,
                targetId: input.targetId,
              },
            },
          },
        });
        return Response.json({ id: report.id });
      }
      case "settings":
        await db.userSettings.upsert({
          where: { userId: u.id },
          create: {
            userId: u.id,
            memoryEnabled: input.memoryEnabled,
            analyticsConsent: input.analyticsConsent,
            emailNotifications: input.emailNotifications,
          },
          update: {
            memoryEnabled: input.memoryEnabled,
            analyticsConsent: input.analyticsConsent,
            emailNotifications: input.emailNotifications,
          },
        });
        if (!input.memoryEnabled)
          await db.conversation.updateMany({
            where: { userId: u.id },
            data: { memory: {}, summary: null },
          });
        return Response.json({ ok: true });
      case "deleteAccount":
        await db.userSettings.upsert({
          where: { userId: u.id },
          create: { userId: u.id, deletionRequestedAt: new Date() },
          update: { deletionRequestedAt: new Date() },
        });
        return Response.json({ ok: true });
      case "block":
        if (u.id === input.blockedUserId)
          throw new AppError(400, "Cannot block yourself.");
        if (!(await db.user.findUnique({ where: { id: input.blockedUserId } })))
          throw new AppError(404, "User unavailable.");
        if (input.remove)
          await db.blockedUser.deleteMany({
            where: { userId: u.id, blockedUserId: input.blockedUserId },
          });
        else
          await db.blockedUser.upsert({
            where: {
              userId_blockedUserId: {
                userId: u.id,
                blockedUserId: input.blockedUserId,
              },
            },
            create: { userId: u.id, blockedUserId: input.blockedUserId },
            update: {},
          });
        return Response.json({ ok: true });
      case "clearMemory":
        await db.conversation.updateMany({
          where: { userId: u.id },
          data: { memory: {}, summary: null },
        });
        return Response.json({ ok: true });
      case "event":
        if (u.settings?.analyticsConsent)
          await db.analyticsEvent.create({
            data: {
              userId: u.id,
              name: input.name,
              creatorId: input.creatorId,
            },
          });
        return Response.json({ ok: true });
    }
  } catch (e) {
    return safeError(e);
  }
}
