import { db } from "@/lib/db";
import { AppError } from "@/lib/security";
import {
  moderation,
  imageGenerator,
  videoGenerator,
  voiceGenerator,
} from "@/providers/mock";
import { storage } from "@/providers/storage";
import type { MediaType } from "@prisma/client";
export async function generate(
  operatorId: string,
  creatorId: string,
  type: MediaType,
  brief: string,
  negativePrompt?: string,
) {
  const c = await db.creator.findUnique({ where: { id: creatorId } });
  if (!c || c.deletedAt) throw new AppError(404, "Creator unavailable.");
  const job = await db.generationJob.create({
    data: {
      creatorId,
      operatorId,
      type,
      prompt: { create: { prompt: brief, negativePrompt } },
      requestMetadata: { safeDemo: true },
      status: "QUEUED",
    },
  });
  await db.auditLog.create({
    data: {
      operatorId,
      action: "GENERATION_CREATED",
      targetType: "GENERATION",
      targetId: job.id,
      metadata: { type },
    },
  });
  try {
    await db.generationJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", startedAt: new Date() },
    });
    const check = await moderation.text(brief);
    if (!check.allowed) {
      await db.generationJob.update({
        where: { id: job.id },
        data: {
          status: "REJECTED",
          moderationResult: check,
          completedAt: new Date(),
        },
      });
      return { id: job.id, status: "REJECTED" };
    }
    const provider =
      type === "IMAGE"
        ? imageGenerator
        : type === "VOICE"
          ? voiceGenerator
          : videoGenerator;
    const result = await provider.generate(brief, c.accent);
    const storageKey = `generated/${job.id}.${result.extension}`;
    await storage.put(storageKey, result.bytes);
    await db.generationJob.update({
      where: { id: job.id },
      data: { status: "MODERATION" },
    });
    const reviewed = await moderation.media(type, storageKey);
    await db.generationJob.update({
      where: { id: job.id },
      data: {
        status: reviewed.allowed ? "REVIEW" : "REJECTED",
        moderationResult: reviewed,
        completedAt: new Date(),
        assets: {
          create: {
            storageKey,
            mimeType: result.mimeType,
            size: result.bytes.length,
            moderation: reviewed.allowed ? "REVIEW" : "REJECTED",
          },
        },
      },
    });
    await db.auditLog.create({
      data: {
        operatorId,
        action: "GENERATION_SUBMITTED",
        targetType: "GENERATION",
        targetId: job.id,
        metadata: { type },
      },
    });
    return { id: job.id, status: reviewed.allowed ? "REVIEW" : "REJECTED" };
  } catch (error) {
    await db.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Provider failed",
        completedAt: new Date(),
      },
    });
    return { id: job.id, status: "FAILED" };
  }
}
export async function reviewGeneration(
  operatorId: string,
  jobId: string,
  approve: boolean,
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${jobId}))`;
    const job = await tx.generationJob.findUnique({
      where: { id: jobId },
      include: { assets: true },
    });
    if (!job || job.status !== "REVIEW")
      throw new AppError(409, "This job is not awaiting review.");
    await tx.generationJob.update({
      where: { id: jobId },
      data: { status: approve ? "APPROVED" : "REJECTED" },
    });
    for (const a of job.assets) {
      await tx.generationAsset.update({
        where: { id: a.id },
        data: { moderation: approve ? "APPROVED" : "REJECTED" },
      });
      if (approve)
        await tx.creatorMedia.create({
          data: {
            creatorId: job.creatorId,
            type: job.type,
            storageKey: a.storageKey,
            size: a.size,
            mimeType: a.mimeType,
            title: "Reviewed AI art study",
            tags: ["generated"],
            moderation: "APPROVED",
            generationAssetId: a.id,
            ownerId: operatorId,
          },
        });
    }
    await tx.auditLog.create({
      data: {
        operatorId,
        action: approve ? "GENERATION_APPROVED" : "GENERATION_REJECTED",
        targetType: "GENERATION",
        targetId: jobId,
      },
    });
    return { ok: true };
  });
}
