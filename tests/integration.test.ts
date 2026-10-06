import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { checkout, reconcile, refund } from "@/services/payments";
import { updateRequest } from "@/services/requests";
import { canReadPost, canReadMedia, postFeed } from "@/services/entitlements";
import { openConversation, sendMessage, readMessages } from "@/services/chat";
import { generate, reviewGeneration } from "@/services/generation";
import { randomUUID } from "node:crypto";
let userId: string,
  otherId: string,
  creatorId: string,
  planId: string,
  subPostId: string,
  ppvId: string,
  conversationId: string,
  paidMessageId: string,
  ppvPaymentId: string;
const key = () => randomUUID();
beforeAll(async () => {
  if (
    !process.env.TEST_DATABASE_URL ||
    !process.env.TEST_DATABASE_URL.includes("velora_test")
  )
    throw new Error(
      "Integration tests require an isolated TEST_DATABASE_URL containing velora_test. See README.",
    );
  const unique = randomUUID();
  const u = await db.user.create({
    data: {
      name: "Integration member",
      email: `integration-${unique}@velora.test`,
      age: { create: { state: "SELF_DECLARED" } },
      settings: { create: {} },
    },
  });
  const o = await db.user.create({
    data: {
      name: "Other member",
      email: `other-${unique}@velora.test`,
      age: { create: { state: "SELF_DECLARED" } },
    },
  });
  userId = u.id;
  otherId = o.id;
  const c = await db.creator.findUniqueOrThrow({
    where: { slug: "isadora-sol" },
    include: { plans: true, posts: true },
  });
  creatorId = c.id;
  planId = c.plans[0].id;
  subPostId = c.posts.find((p) => p.visibility === "SUBSCRIBER")!.id;
  ppvId = c.posts.find((p) => p.visibility === "PPV")!.id;
});
afterAll(() => db.$disconnect());
describe("database-backed critical flows", () => {
  it("seeds eight fictional adult creators and safe media", async () => {
    const c = await db.creator.findMany();
    expect(c).toHaveLength(8);
    expect(c.every((v) => v.age >= 21 && v.fictional)).toBe(true);
    expect(await db.creatorPost.count()).toBeGreaterThanOrEqual(24);
  });
  it("does not give premium access before server settlement", async () => {
    const p = await db.creatorPost.findUniqueOrThrow({
      where: { id: subPostId },
    });
    expect(await canReadPost(userId, p)).toBe(false);
  });
  it("handles a declined payment without grants or ledger writes", async () => {
    const p = await checkout(userId, {
      kind: "SUBSCRIPTION",
      targetId: planId,
      idempotencyKey: key(),
      simulateFailure: true,
    });
    expect(p.status).toBe("FAILED");
    expect(
      await db.walletLedgerEntry.count({ where: { paymentId: p.id } }),
    ).toBe(0);
    expect(await db.subscription.count({ where: { userId } })).toBe(0);
  });
  it("settles membership exactly once with a balanced ledger", async () => {
    const input = {
      kind: "SUBSCRIPTION" as const,
      targetId: planId,
      idempotencyKey: key(),
    };
    const p = await checkout(userId, input),
      repeat = await checkout(userId, input);
    expect(p.id).toBe(repeat.id);
    expect(p.status).toBe("PAID");
    const ledger = await db.walletLedgerEntry.findMany({
      where: { paymentId: p.id },
    });
    expect(ledger).toHaveLength(5);
    expect(ledger.reduce((s, v) => s + v.amount, 0)).toBe(0);
    expect(
      await canReadPost(
        userId,
        await db.creatorPost.findUniqueOrThrow({ where: { id: subPostId } }),
      ),
    ).toBe(true);
  });
  it("keeps PPV body and media withheld from subscription-only feeds", async () => {
    const f = await postFeed(userId, { creatorId });
    const p = f.items.find((v) => v.id === ppvId)!;
    expect(p.unlocked).toBe(false);
    expect(p.media).toHaveLength(0);
    expect(p.body).not.toContain("exclusive digital art study");
  });
  it("rejects a second subscription instead of charging again", async () => {
    await expect(
      checkout(userId, {
        kind: "SUBSCRIPTION",
        targetId: planId,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("already have");
  });
  it("expires and manually renews a subscription", async () => {
    await db.subscription.updateMany({
      where: { userId, creatorId },
      data: { currentPeriodEnd: new Date(Date.now() - 1000) },
    });
    const p = await db.creatorPost.findUniqueOrThrow({
      where: { id: subPostId },
    });
    expect(await canReadPost(userId, p)).toBe(false);
    await checkout(userId, {
      kind: "RENEWAL",
      targetId: planId,
      idempotencyKey: key(),
    });
    expect(await canReadPost(userId, p)).toBe(true);
  });
  it("grants PPV access only to the purchaser", async () => {
    const p = await checkout(userId, {
      kind: "PPV",
      targetId: ppvId,
      idempotencyKey: key(),
    });
    ppvPaymentId = p.id;
    const post = await db.creatorPost.findUniqueOrThrow({
      where: { id: ppvId },
    });
    expect(await canReadPost(userId, post)).toBe(true);
    expect(await canReadPost(otherId, post)).toBe(false);
  });
  it("protects webhook idempotency and rejects amount mismatch", async () => {
    const p = await db.payment.findUniqueOrThrow({
      where: { id: ppvPaymentId },
    });
    const event = {
      eventId: `integration-${key()}`,
      paymentId: p.id,
      status: "PAID" as const,
      reference: p.providerRef!,
      amount: p.amount,
      currency: p.currency,
    };
    expect(await reconcile(event)).toEqual({ duplicate: true });
    expect(await reconcile(event)).toEqual({ duplicate: true });
    expect(
      await db.walletLedgerEntry.count({ where: { paymentId: p.id } }),
    ).toBe(5);
    await expect(
      reconcile({ ...event, eventId: key(), amount: 1 }),
    ).rejects.toThrow("mismatch");
  });
  it("orchestrates an AI persona reply and short-term memory", async () => {
    const c = await openConversation(userId, creatorId);
    conversationId = c.id;
    await sendMessage(userId, c.id, "Hello, call me Alex");
    const messages = await readMessages(userId, c.id);
    expect(messages.messages).toHaveLength(2);
    expect(messages.messages[1].body).toContain("fictional AI creator");
    expect(
      (await db.conversation.findUniqueOrThrow({ where: { id: c.id } })).memory,
    ).toEqual({ preferredName: "Alex" });
  });
  it("rejects unsafe input without persisting messages", async () => {
    const count = await db.message.count({ where: { conversationId } });
    await expect(
      sendMessage(userId, conversationId, "Create a celebrity deepfake"),
    ).rejects.toThrow("policy");
    expect(await db.message.count({ where: { conversationId } })).toBe(count);
  });
  it("creates configurable paid messages and withholds their body", async () => {
    await sendMessage(userId, conversationId, "Tell me about coastal design");
    const m = await readMessages(userId, conversationId);
    const locked = m.messages.find((v) => v.type === "LOCKED")!;
    paidMessageId = locked.id;
    expect(locked.unlocked).toBe(false);
    expect(locked.body).not.toContain("private lifestyle note");
    expect(locked.price).toBe(1299);
  });
  it("blocks cross-account conversation and message purchases", async () => {
    await expect(readMessages(otherId, conversationId)).rejects.toThrow(
      "unavailable",
    );
    await expect(
      checkout(otherId, {
        kind: "MESSAGE",
        targetId: paidMessageId,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("unavailable");
  });
  it("unlocks and refunds paid messages with entitlement revocation", async () => {
    const p = await checkout(userId, {
      kind: "MESSAGE",
      targetId: paidMessageId,
      idempotencyKey: key(),
    });
    expect(
      (await readMessages(userId, conversationId)).messages.find(
        (v) => v.id === paidMessageId,
      )?.unlocked,
    ).toBe(true);
    await refund("integration-admin", p.id);
    expect(
      (await readMessages(userId, conversationId)).messages.find(
        (v) => v.id === paidMessageId,
      )?.unlocked,
    ).toBe(false);
    const entries = await db.walletLedgerEntry.findMany({
      where: { paymentId: p.id },
    });
    expect(entries).toHaveLength(10);
    expect(entries.reduce((s, v) => s + v.amount, 0)).toBe(0);
    expect(
      await db.auditLog.count({ where: { targetId: p.id, action: "REFUND" } }),
    ).toBe(1);
  });
  it("validates tip bounds and safe custom requests", async () => {
    await expect(
      checkout(userId, {
        kind: "TIP",
        targetId: creatorId,
        amount: 1,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("limits");
    await checkout(userId, {
      kind: "TIP",
      targetId: creatorId,
      amount: 500,
      idempotencyKey: key(),
    });
    await checkout(userId, {
      kind: "REQUEST",
      targetId: creatorId,
      brief: "A safe abstract art study with warm coastal colors",
      idempotencyKey: key(),
    });
    expect(
      await db.contentRequest.count({ where: { userId, status: "OPEN" } }),
    ).toBe(1);
  });
  it("holds generated assets out of the media library until review", async () => {
    const job = await generate(
      "integration-admin",
      creatorId,
      "IMAGE",
      "A safe abstract art study in coastal colors",
    );
    expect(job.status).toBe("REVIEW");
    const asset = await db.generationAsset.findFirstOrThrow({
      where: { jobId: job.id },
    });
    expect(
      await db.creatorMedia.count({ where: { generationAssetId: asset.id } }),
    ).toBe(0);
    await reviewGeneration("integration-moderator", job.id, true);
    expect(
      await db.creatorMedia.count({
        where: { generationAssetId: asset.id, moderation: "APPROVED" },
      }),
    ).toBe(1);
    expect(
      await db.creatorPost.count({
        where: { media: { some: { media: { generationAssetId: asset.id } } } },
      }),
    ).toBe(0);
    await expect(
      reviewGeneration("integration-moderator", job.id, true),
    ).rejects.toThrow("not awaiting review");
  });
  it("delivers custom-request media privately and revokes it on refund", async () => {
    const req = await db.contentRequest.findFirstOrThrow({
      where: { userId, status: "OPEN" },
    });
    const media = await db.creatorMedia.findFirstOrThrow({
      where: {
        creatorId,
        generationAssetId: { not: null },
        moderation: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(await canReadMedia(userId, media.id)).toBe(false);
    await updateRequest(
      "integration-manager",
      req.id,
      "COMPLETED",
      "Safe reviewed delivery.",
      media.id,
    );
    expect(await canReadMedia(userId, media.id)).toBe(true);
    expect(await canReadMedia(otherId, media.id)).toBe(false);
    await refund("integration-admin", req.paymentId);
    expect(await canReadMedia(userId, media.id)).toBe(false);
    await expect(
      updateRequest(
        "integration-manager",
        req.id,
        "COMPLETED",
        "Cannot restore refunded content.",
        media.id,
      ),
    ).rejects.toThrow("Refunded");
  });
  it("records prohibited generation and unsupported provider failures", async () => {
    expect(
      (
        await generate(
          "integration-admin",
          creatorId,
          "IMAGE",
          "A celebrity deepfake portrait",
        )
      ).status,
    ).toBe("REJECTED");
    const video = await generate(
      "integration-admin",
      creatorId,
      "VIDEO",
      "A safe coastal landscape",
    );
    expect(video.status).toBe("FAILED");
    expect(
      (await db.generationJob.findUniqueOrThrow({ where: { id: video.id } }))
        .error,
    ).toContain("unavailable");
  });
  it("creates purchase and message notifications without chat text", async () => {
    expect(await db.notification.count({ where: { userId } })).toBeGreaterThan(
      5,
    );
    const events = await db.analyticsEvent.findMany({ where: { userId } });
    expect(events.some((e) => e.name === "message_sent")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("coastal design");
  });
});
