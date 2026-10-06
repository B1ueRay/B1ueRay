import { db } from "@/lib/db";
import { AppError } from "@/lib/security";
import { moderation, llm } from "@/providers/mock";
import { subscribed } from "./entitlements";
export async function openConversation(userId: string, creatorId: string) {
  const creator = await db.creator.findUnique({ where: { id: creatorId } });
  if (!creator || creator.deletedAt || creator.moderation !== "APPROVED")
    throw new AppError(404, "Creator unavailable.");
  return db.conversation.upsert({
    where: { userId_creatorId: { userId, creatorId } },
    create: { userId, creatorId, participants: { create: { userId } } },
    update: { deletedAt: null },
  });
}
export async function readMessages(userId: string, conversationId: string) {
  const c = await db.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
      deletedAt: null,
      creator: { deletedAt: null, moderation: "APPROVED" },
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          avatar: true,
          aiDisclosure: true,
          settings: { select: { tipMin: true, tipMax: true } },
        },
      },
      messages: {
        where: { deletedAt: null, moderation: "APPROVED" },
        include: {
          unlocks: { where: { userId, status: "PAID" } },
          attachments: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
  if (!c) throw new AppError(404, "Conversation unavailable.");
  return {
    id: c.id,
    creator: c.creator,
    messages: c.messages.reverse().map((m) => {
      const unlocked = m.type !== "LOCKED" || m.unlocks.length > 0;
      return {
        id: m.id,
        sender: m.sender,
        type: m.type,
        body: unlocked ? m.body : m.preview || "A private note awaits you.",
        price: m.price,
        unlocked,
        createdAt: m.createdAt,
        attachments: unlocked
          ? m.attachments.map((a) => ({
              type: a.type,
              url: `/api/media/${a.mediaId}`,
            }))
          : [],
      };
    }),
  };
}
export async function sendMessage(
  userId: string,
  conversationId: string,
  text: string,
) {
  const c = await db.conversation.findFirst({
    where: { id: conversationId, userId, deletedAt: null },
    include: {
      creator: { include: { persona: true, settings: true } },
      messages: {
        where: { type: "TEXT", deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      user: { include: { settings: true } },
    },
  });
  if (
    !c?.creator.persona ||
    !c.creator.settings ||
    c.creator.moderation !== "APPROVED" ||
    c.creator.deletedAt
  )
    throw new AppError(404, "Conversation unavailable.");
  const active = await subscribed(userId, c.creatorId);
  if (c.creator.settings?.chatAccess === "SUBSCRIBER" && !active)
    throw new AppError(403, "Subscribe to send messages to this creator.");
  if (!(await moderation.text(text)).allowed)
    throw new AppError(
      422,
      "This message is outside the safe demo content policy.",
    );
  const persona = c.creator.persona;
  const memory =
    c.user.settings?.memoryEnabled === false
      ? {}
      : (c.memory as Record<string, string>);
  const preferred = text
    .match(/(?:my name is|call me) ([\p{L} -]{2,30})/iu)?.[1]
    ?.trim();
  if (preferred && c.user.settings?.memoryEnabled !== false)
    memory.preferredName = preferred;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const response = await Promise.race([
    llm.respond(
      {
        name: c.creator.name,
        tone: persona.tone,
        interests: persona.interests,
        languages: persona.languages,
        boundaries: persona.boundaries,
        history: c.messages
          .reverse()
          .map((m) => ({ sender: m.sender, body: m.body })),
        memory,
        subscribed: active,
      },
      text,
    ),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new AppError(
              504,
              "Your creator is taking a moment. Please try again.",
            ),
          ),
        10000,
      );
    }),
  ]).finally(() => clearTimeout(timeout));
  if (!(await moderation.text(response.text)).allowed)
    throw new AppError(422, "The AI response was held for moderation.");
  return db.$transaction(async (tx) => {
    await tx.message.create({
      data: { conversationId, userId, sender: "USER", body: text },
    });
    await tx.message.create({
      data: {
        conversationId,
        sender: "CREATOR",
        body: response.text,
        usageTokens: response.tokens,
        provider: "mock",
      },
    });
    const config = persona.monetizationConfig as {
      paidOfferEvery?: number;
      offerPreview?: string;
      offerBody?: string;
    };
    const sent = await tx.message.count({
      where: { conversationId, sender: "USER" },
    });
    if (config.paidOfferEvery && sent % config.paidOfferEvery === 0)
      await tx.message.create({
        data: {
          conversationId,
          sender: "CREATOR",
          type: "LOCKED",
          preview:
            config.offerPreview || "A personal creative note, just for you.",
          body:
            config.offerBody ||
            "Your private inspiration: plan a slow morning, choose your favorite music, and make something beautiful.",
          price: c.creator.settings!.paidMessagePrice,
          provider: "mock",
        },
      });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { memory, updatedAt: new Date() },
    });
    await tx.notification.create({
      data: {
        userId,
        type: "MESSAGE",
        title: `A note from ${c.creator.name}`,
        body: "Your AI creator has replied.",
        href: `/app/messages?conversation=${conversationId}`,
      },
    });
    await tx.analyticsEvent.create({
      data: {
        userId,
        creatorId: c.creatorId,
        name: "message_sent",
        metadata: { tokens: response.tokens },
      },
    });
    return { ok: true };
  });
}
