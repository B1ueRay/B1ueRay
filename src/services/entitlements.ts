import { db } from "@/lib/db";
import type { CreatorPost, Prisma } from "@prisma/client";
export const publishedWhere = (): Prisma.CreatorPostWhereInput => ({
  moderation: "APPROVED",
  deletedAt: null,
  publishedAt: { lte: new Date() },
  OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
  creator: { moderation: "APPROVED", deletedAt: null },
});
export async function subscribed(userId: string, creatorId: string) {
  return !!(await db.subscription.findFirst({
    where: {
      userId,
      creatorId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() },
    },
  }));
}
export function entitled(
  visibility: string,
  active: boolean,
  purchased: boolean,
) {
  return (
    visibility === "PUBLIC" ||
    (visibility === "SUBSCRIBER" && active) ||
    (visibility === "PPV" && purchased)
  );
}
export async function canReadPost(
  userId: string | undefined,
  post: CreatorPost,
) {
  if (
    post.moderation !== "APPROVED" ||
    post.deletedAt ||
    !post.publishedAt ||
    post.publishedAt > new Date() ||
    (post.scheduledAt && post.scheduledAt > new Date())
  )
    return false;
  if (post.visibility === "PUBLIC") return true;
  if (!userId) return false;
  const [active, purchase] = await Promise.all([
    subscribed(userId, post.creatorId),
    db.purchase.findUnique({
      where: { userId_postId: { userId, postId: post.id } },
    }),
  ]);
  return entitled(post.visibility, active, purchase?.status === "PAID");
}
export async function postFeed(
  userId: string | undefined,
  options: { creatorId?: string; following?: boolean; cursor?: string } = {},
) {
  const posts = await db.creatorPost.findMany({
    where: {
      ...publishedWhere(),
      ...(options.creatorId ? { creatorId: options.creatorId } : {}),
      ...(options.following && userId
        ? {
            creator: {
              OR: [
                { favorites: { some: { userId } } },
                {
                  subscriptions: {
                    some: {
                      userId,
                      status: "ACTIVE",
                      currentPeriodEnd: { gt: new Date() },
                    },
                  },
                },
              ],
              moderation: "APPROVED",
              deletedAt: null,
            },
          }
        : {}),
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          slug: true,
          avatar: true,
          aiDisclosure: true,
        },
      },
      media: {
        include: {
          media: {
            select: { id: true, type: true, moderation: true, deletedAt: true },
          },
        },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 13,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const creatorIds = [...new Set(posts.map((p) => p.creatorId))];
  const [subs, buys] = userId
    ? await Promise.all([
        db.subscription.findMany({
          where: {
            userId,
            creatorId: { in: creatorIds },
            status: "ACTIVE",
            currentPeriodEnd: { gt: new Date() },
          },
          select: { creatorId: true },
        }),
        db.purchase.findMany({
          where: {
            userId,
            postId: { in: posts.map((p) => p.id) },
            status: "PAID",
          },
          select: { postId: true },
        }),
      ])
    : [[], []];
  const items = posts.slice(0, 12).map((p) => {
    const unlocked = entitled(
      p.visibility,
      subs.some((s) => s.creatorId === p.creatorId),
      buys.some((b) => b.postId === p.id),
    );
    return {
      id: p.id,
      title: p.title,
      body: unlocked
        ? p.body
        : "A private moment, reserved for the inner circle.",
      visibility: p.visibility,
      price: p.price,
      creator: p.creator,
      unlocked,
      createdAt: p.publishedAt,
      media: unlocked
        ? p.media
            .filter(
              (m) => m.media.moderation === "APPROVED" && !m.media.deletedAt,
            )
            .map((m) => ({ id: m.media.id, url: `/api/media/${m.media.id}` }))
        : [],
    };
  });
  return { items, nextCursor: posts.length > 12 ? items.at(-1)?.id : null };
}

export async function canReadMedia(
  userId: string | undefined,
  mediaId: string,
) {
  const access: Prisma.CreatorPostWhereInput[] = [{ visibility: "PUBLIC" }];
  if (userId) {
    access.push(
      {
        visibility: "SUBSCRIBER",
        creator: {
          subscriptions: {
            some: {
              userId,
              status: "ACTIVE",
              currentPeriodEnd: { gt: new Date() },
            },
          },
        },
      },
      { visibility: "PPV", purchases: { some: { userId, status: "PAID" } } },
    );
  }
  const post = await db.creatorPost.findFirst({
    where: {
      AND: [publishedWhere(), { media: { some: { mediaId } } }, { OR: access }],
    },
    select: { id: true },
  });
  if (post) return true;
  if (!userId) return false;
  if (
    await db.contentRequest.findFirst({
      where: { userId, fulfilledMediaId: mediaId, status: "COMPLETED" },
      select: { id: true },
    })
  )
    return true;
  return !!(await db.messageAttachment.findFirst({
    where: {
      mediaId,
      message: {
        conversation: { userId, deletedAt: null },
        deletedAt: null,
        moderation: "APPROVED",
        OR: [
          { type: { not: "LOCKED" } },
          { unlocks: { some: { userId, status: "PAID" } } },
        ],
      },
    },
    select: { id: true },
  }));
}
