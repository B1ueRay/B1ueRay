import { db } from "@/lib/db";
import { AppError } from "@/lib/security";
import { payments, moderation } from "@/providers/mock";
import type { Prisma } from "@prisma/client";
type Kind = "SUBSCRIPTION" | "RENEWAL" | "PPV" | "MESSAGE" | "TIP" | "REQUEST";
export type CheckoutInput = {
  kind: Kind;
  targetId: string;
  amount?: number;
  brief?: string;
  idempotencyKey: string;
  simulateFailure?: boolean;
};
export function allocate(amount: number) {
  const platformFee = Math.floor(amount * 0.2),
    processorFee = Math.floor(amount * 0.03);
  return {
    GROSS: -amount,
    CREATOR: amount - platformFee,
    PROCESSOR: processorFee,
    TAX: 0,
    PLATFORM: platformFee - processorFee,
  };
}
async function resolveTarget(userId: string, input: CheckoutInput) {
  let creatorId = "",
    amount = 0;
  if (input.kind === "SUBSCRIPTION" || input.kind === "RENEWAL") {
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: input.targetId },
      include: { creator: true },
    });
    if (
      !plan?.active ||
      plan.creator.moderation !== "APPROVED" ||
      plan.creator.deletedAt
    )
      throw new AppError(404, "Subscription plan unavailable.");
    const existing = await db.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId: plan.creatorId } },
    });
    if (
      input.kind === "SUBSCRIPTION" &&
      existing?.status === "ACTIVE" &&
      existing.currentPeriodEnd > new Date()
    )
      throw new AppError(409, "You already have an active subscription.");
    if (
      input.kind === "RENEWAL" &&
      (!existing ||
        existing.currentPeriodEnd > new Date() ||
        existing.cancelAtPeriodEnd)
    )
      throw new AppError(409, "This subscription is not eligible for renewal.");
    creatorId = plan.creatorId;
    amount = plan.price;
  } else if (input.kind === "PPV") {
    const post = await db.creatorPost.findUnique({
      where: { id: input.targetId },
      include: { creator: true },
    });
    if (
      !post ||
      post.visibility !== "PPV" ||
      post.moderation !== "APPROVED" ||
      post.deletedAt ||
      !post.publishedAt ||
      post.publishedAt > new Date() ||
      (post.scheduledAt && post.scheduledAt > new Date()) ||
      post.creator.moderation !== "APPROVED" ||
      post.creator.deletedAt
    )
      throw new AppError(404, "Post unavailable.");
    const purchase = await db.purchase.findUnique({
      where: { userId_postId: { userId, postId: post.id } },
    });
    if (purchase?.status === "PAID")
      throw new AppError(409, "You already own this post.");
    creatorId = post.creatorId;
    amount = post.price;
  } else if (input.kind === "MESSAGE") {
    const message = await db.message.findUnique({
      where: { id: input.targetId },
      include: { conversation: true, unlocks: true },
    });
    if (
      !message ||
      message.conversation.userId !== userId ||
      message.conversation.deletedAt ||
      message.type !== "LOCKED" ||
      message.deletedAt ||
      message.moderation !== "APPROVED"
    )
      throw new AppError(404, "Message unavailable.");
    if (message.unlocks.some((u) => u.userId === userId && u.status === "PAID"))
      throw new AppError(409, "You already unlocked this message.");
    creatorId = message.conversation.creatorId;
    amount = message.price;
  } else {
    const creator = await db.creator.findUnique({
      where: { id: input.targetId },
      include: { settings: true },
    });
    if (
      !creator?.settings ||
      creator.moderation !== "APPROVED" ||
      creator.deletedAt
    )
      throw new AppError(404, "Creator unavailable.");
    creatorId = creator.id;
    if (input.kind === "TIP") {
      amount = input.amount || 0;
      if (
        !Number.isInteger(amount) ||
        amount < creator.settings.tipMin ||
        amount > creator.settings.tipMax
      )
        throw new AppError(400, "Tip outside the configured limits.");
    } else {
      if (!input.brief || input.brief.length < 10 || input.brief.length > 1000)
        throw new AppError(400, "Describe your request in 10–1000 characters.");
      if (!(await moderation.text(input.brief)).allowed)
        throw new AppError(
          422,
          "This request is outside the safe content policy.",
        );
      amount = creator.settings.requestStartingPrice;
    }
  }
  if (amount <= 0 || !Number.isSafeInteger(amount))
    throw new AppError(400, "Invalid configured price.");
  return { creatorId, amount };
}
export async function checkout(userId: string, input: CheckoutInput) {
  // Serialize checkout initiation per user to avoid double charges for a single entitlement.
  const intent = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const existing = await tx.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (
        existing.userId !== userId ||
        existing.kind !== input.kind ||
        existing.targetId !== input.targetId
      )
        throw new AppError(409, "Idempotency key already used.");
      return existing;
    }
    // Resolve using the same database while the advisory lock guards this user's checkout requests.
    const target = await resolveTarget(userId, input);
    const pending = await tx.payment.findFirst({
      where: {
        userId,
        kind: input.kind,
        targetId: input.targetId,
        status: "PENDING",
      },
    });
    if (pending)
      throw new AppError(409, "A payment for this item is already pending.");
    return tx.payment.create({
      data: {
        userId,
        ...target,
        kind: input.kind,
        targetId: input.targetId,
        idempotencyKey: input.idempotencyKey,
        metadata: input.brief ? { brief: input.brief } : {},
      },
    });
  });
  if (intent.status !== "PENDING")
    return { id: intent.id, status: intent.status };
  const result = input.simulateFailure
    ? { reference: `mock_${intent.id}`, status: "FAILED" as const }
    : await payments.charge(intent);
  await reconcile({
    eventId: `checkout_${intent.id}`,
    paymentId: intent.id,
    status: result.status,
    reference: result.reference,
    amount: intent.amount,
    currency: intent.currency,
  });
  return { id: intent.id, status: result.status };
}
export type VerifiedPaymentEvent = {
  eventId: string;
  paymentId: string;
  status: "PAID" | "FAILED";
  reference: string;
  amount: number;
  currency: string;
};
export async function reconcile(event: VerifiedPaymentEvent) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${event.paymentId}))`;
    if (
      await tx.paymentEvent.findUnique({
        where: { providerEventId: event.eventId },
      })
    )
      return { duplicate: true };
    const p = await tx.payment.findUnique({ where: { id: event.paymentId } });
    if (!p) throw new AppError(404, "Unknown payment.");
    if (
      event.amount !== p.amount ||
      event.currency !== p.currency ||
      event.reference !== `mock_${p.id}`
    )
      throw new AppError(400, "Payment reconciliation mismatch.");
    await tx.paymentEvent.create({
      data: {
        providerEventId: event.eventId,
        paymentId: p.id,
        type: event.status,
        payload: event,
      },
    });
    if (p.status !== "PENDING") return { duplicate: true };
    await tx.payment.update({
      where: { id: p.id },
      data: { status: event.status, providerRef: event.reference },
    });
    if (event.status !== "PAID") return { duplicate: false };
    await fulfill(tx, p);
    await tx.walletLedgerEntry.createMany({
      data: Object.entries(allocate(p.amount)).map(([kind, amount]) => ({
        userId: p.userId,
        paymentId: p.id,
        creatorId: p.creatorId,
        kind,
        amount,
      })),
    });
    await tx.notification.create({
      data: {
        userId: p.userId,
        type: "PURCHASE",
        title: "Your private world just expanded",
        body: `${p.kind.toLowerCase()} confirmed. Demo payment — no real money charged.`,
        href: "/app/purchases",
      },
    });
    await tx.analyticsEvent.create({
      data: {
        userId: p.userId,
        creatorId: p.creatorId,
        name:
          p.kind === "SUBSCRIPTION"
            ? "subscription_purchased"
            : p.kind === "TIP"
              ? "tip_sent"
              : "ppv_purchased",
        metadata: { paymentId: p.id, amount: p.amount },
      },
    });
    return { duplicate: false };
  });
}
async function fulfill(
  tx: Prisma.TransactionClient,
  p: {
    id: string;
    userId: string;
    creatorId: string;
    targetId: string;
    kind: string;
    amount: number;
    metadata: Prisma.JsonValue;
  },
) {
  if (p.kind === "SUBSCRIPTION" || p.kind === "RENEWAL") {
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await tx.subscription.upsert({
      where: { userId_creatorId: { userId: p.userId, creatorId: p.creatorId } },
      create: {
        userId: p.userId,
        creatorId: p.creatorId,
        planId: p.targetId,
        currentPeriodEnd,
      },
      update: {
        status: "ACTIVE",
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        planId: p.targetId,
      },
    });
  } else if (p.kind === "PPV")
    await tx.purchase.upsert({
      where: { userId_postId: { userId: p.userId, postId: p.targetId } },
      create: {
        userId: p.userId,
        postId: p.targetId,
        paymentId: p.id,
        amount: p.amount,
      },
      update: { status: "PAID", paymentId: p.id, amount: p.amount },
    });
  else if (p.kind === "MESSAGE")
    await tx.paidMessageUnlock.upsert({
      where: { userId_messageId: { userId: p.userId, messageId: p.targetId } },
      create: { userId: p.userId, messageId: p.targetId, paymentId: p.id },
      update: { status: "PAID", paymentId: p.id },
    });
  else if (p.kind === "TIP") {
    await tx.tip.create({
      data: {
        userId: p.userId,
        creatorId: p.creatorId,
        paymentId: p.id,
        amount: p.amount,
      },
    });
    const c = await tx.conversation.findUnique({
      where: { userId_creatorId: { userId: p.userId, creatorId: p.creatorId } },
    });
    if (c && !c.deletedAt)
      await tx.message.create({
        data: {
          conversationId: c.id,
          sender: "SYSTEM",
          type: "TIP",
          body: "A thoughtful tip was sent.",
          price: p.amount,
        },
      });
  } else if (p.kind === "REQUEST")
    await tx.contentRequest.create({
      data: {
        userId: p.userId,
        creatorId: p.creatorId,
        paymentId: p.id,
        amount: p.amount,
        brief: (p.metadata as { brief: string }).brief,
      },
    });
}
export async function refund(operatorId: string, paymentId: string) {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || !p.providerRef) throw new AppError(404, "Payment unavailable.");
  if (p.status === "REFUNDED") return;
  if (p.status !== "PAID")
    throw new AppError(409, "Only completed payments can be refunded.");
  await payments.refund(p.providerRef, p.amount);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentId}))`;
    const current = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    if (current.status === "REFUNDED") return;
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "REFUNDED" },
    });
    if (["SUBSCRIPTION", "RENEWAL"].includes(p.kind))
      await tx.subscription.updateMany({
        where: { userId: p.userId, creatorId: p.creatorId },
        data: { status: "REFUNDED", currentPeriodEnd: new Date() },
      });
    if (p.kind === "PPV")
      await tx.purchase.updateMany({
        where: { paymentId },
        data: { status: "REFUNDED" },
      });
    if (p.kind === "MESSAGE")
      await tx.paidMessageUnlock.updateMany({
        where: { paymentId },
        data: { status: "REFUNDED" },
      });
    if (p.kind === "TIP")
      await tx.tip.updateMany({
        where: { paymentId },
        data: { status: "REFUNDED" },
      });
    if (p.kind === "REQUEST")
      await tx.contentRequest.updateMany({
        where: { paymentId },
        data: { status: "REFUNDED" },
      });
    await tx.walletLedgerEntry.createMany({
      data: Object.entries(allocate(p.amount)).map(([kind, amount]) => ({
        userId: p.userId,
        paymentId: p.id,
        creatorId: p.creatorId,
        kind: `REFUND_${kind}`,
        amount: -amount,
      })),
    });
    await tx.auditLog.create({
      data: {
        operatorId,
        action: "REFUND",
        targetType: "PAYMENT",
        targetId: p.id,
      },
    });
  });
}
