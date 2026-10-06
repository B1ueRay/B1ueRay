import { db } from "@/lib/db";
export async function metrics() {
  const now = new Date();
  const [users, activeUsers, subs, paid, messages, queue, rankings, events] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.session.groupBy({ by: ["userId"], where: { expiresAt: { gt: now } } }),
      db.subscription.findMany({
        where: { status: "ACTIVE", currentPeriodEnd: { gt: now } },
        include: { plan: { select: { price: true } } },
      }),
      db.payment.findMany({
        where: { status: "PAID" },
        select: { amount: true, kind: true, userId: true },
      }),
      db.message.count({ where: { sender: "USER" } }),
      db.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      db.payment.groupBy({
        by: ["creatorId"],
        where: { status: "PAID" },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 8,
      }),
      db.analyticsEvent.groupBy({ by: ["name"], _count: true }),
    ]);
  const gross = paid.reduce((sum, p) => sum + p.amount, 0),
    buyers = new Set(paid.map((p) => p.userId)).size;
  return {
    users,
    activeUsers: activeUsers.length,
    subscribers: subs.length,
    mrr: subs.reduce((s, v) => s + v.plan.price, 0),
    gmv: gross,
    arppu: buyers ? Math.round(gross / buyers) : 0,
    conversion: users ? Math.round((buyers / users) * 100) : 0,
    churn: subs.length
      ? Math.round(
          (subs.filter((s) => s.cancelAtPeriodEnd).length / subs.length) * 100,
        )
      : 0,
    messages,
    ppv: paid
      .filter((p) => ["PPV", "MESSAGE"].includes(p.kind))
      .reduce((s, p) => s + p.amount, 0),
    tips: paid
      .filter((p) => p.kind === "TIP")
      .reduce((s, p) => s + p.amount, 0),
    queue,
    rankings,
    events,
  };
}
