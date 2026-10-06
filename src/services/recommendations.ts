import { db } from "@/lib/db";
export function score(
  c: {
    popularity: number;
    featured: boolean;
    tags: string[];
    languages: string[];
  },
  preferences: { tags: string[]; languages: string[] },
) {
  return (
    c.popularity +
    Number(c.featured) * 100 +
    c.tags.filter((t) => preferences.tags.includes(t)).length * 30 +
    c.languages.filter((l) => preferences.languages.includes(l)).length * 20
  );
}
export async function discover(
  options: {
    search?: string;
    category?: string;
    language?: string;
    sort?: string;
    userId?: string;
  } = {},
) {
  const creators = await db.creator.findMany({
    where: {
      moderation: "APPROVED",
      deletedAt: null,
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: "insensitive" } },
              { bio: { contains: options.search, mode: "insensitive" } },
              { tags: { has: options.search } },
            ],
          }
        : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.language ? { languages: { has: options.language } } : {}),
    },
    include: {
      plans: { where: { active: true }, take: 1 },
      _count: {
        select: {
          posts: true,
          subscriptions: {
            where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
          },
        },
      },
    },
    take: 100,
  });
  const favorites = options.userId
    ? await db.favorite.findMany({
        where: { userId: options.userId },
        include: { creator: { select: { tags: true, languages: true } } },
      })
    : [];
  const prefs = {
    tags: favorites.flatMap((f) => f.creator.tags),
    languages: favorites.flatMap((f) => f.creator.languages),
  };
  const [paid, subs, chats, views] = options.userId
    ? await Promise.all([
        db.payment.groupBy({
          by: ["creatorId"],
          where: { userId: options.userId, status: "PAID" },
          _count: true,
        }),
        db.subscription.findMany({
          where: {
            userId: options.userId,
            status: "ACTIVE",
            currentPeriodEnd: { gt: new Date() },
          },
          select: { creatorId: true },
        }),
        db.conversation.findMany({
          where: { userId: options.userId, deletedAt: null },
          select: {
            creatorId: true,
            _count: {
              select: {
                messages: { where: { sender: "USER", deletedAt: null } },
              },
            },
          },
        }),
        db.analyticsEvent.groupBy({
          by: ["creatorId"],
          where: {
            userId: options.userId,
            name: { in: ["creator_view", "profile_click"] },
            createdAt: { gt: new Date(Date.now() - 30 * 86400000) },
          },
          _count: true,
        }),
      ])
    : [[], [], [], []];
  const affinity = (id: string) =>
    Math.min(100, (paid.find((p) => p.creatorId === id)?._count || 0) * 20) +
    Number(subs.some((s) => s.creatorId === id)) * 100 +
    Math.min(
      50,
      (chats.find((c) => c.creatorId === id)?._count.messages || 0) * 5,
    ) +
    Math.min(20, (views.find((v) => v.creatorId === id)?._count || 0) * 2);
  return creators
    .sort((a, b) =>
      options.sort === "price"
        ? (a.plans[0]?.price || 0) - (b.plans[0]?.price || 0)
        : options.sort === "newest"
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : score(b, prefs) + affinity(b.id) - score(a, prefs) - affinity(a.id),
    )
    .map((c) => ({
      ...c,
      favorited: favorites.some((f) => f.creatorId === c.id),
    }));
}
