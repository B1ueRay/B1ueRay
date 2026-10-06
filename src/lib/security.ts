import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { Role } from "@prisma/client";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function actor(roles?: Role[]) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AppError(401, "Sign in to continue.");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { age: true, settings: true },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt)
    throw new AppError(403, "This account is unavailable.");
  if (roles && !roles.includes(user.role))
    throw new AppError(403, "You do not have access to this action.");
  return user;
}
export async function adultActor(roles?: Role[]) {
  const user = await actor(roles);
  if (!user.age || !["SELF_DECLARED", "VERIFIED"].includes(user.age.state))
    throw new AppError(403, "Confirm that you are 18 or older to continue.");
  const h = await headers();
  const country =
    process.env.TRUST_COUNTRY_HEADER === "true"
      ? h.get("x-verified-country")
      : null;
  const blocked = (process.env.BLOCKED_COUNTRIES || "")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  if (blocked.length && !country)
    throw new AppError(451, "Verified jurisdiction information is required.");
  if (country && blocked.includes(country.toUpperCase()))
    throw new AppError(
      451,
      "This service is unavailable in your jurisdiction.",
    );
  return user;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
  if (!origin || origin !== expected)
    throw new AppError(403, "Invalid request origin.");
}
export async function limit(key: string, max = 30, seconds = 60) {
  const expires = new Date(Date.now() + seconds * 1000);
  const result = await db.$queryRaw<
    Array<{ count: number }>
  >`INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${key},1,${expires}) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."expiresAt" < NOW() THEN 1 ELSE "RateLimit"."count"+1 END, "expiresAt"=CASE WHEN "RateLimit"."expiresAt" < NOW() THEN ${expires} ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (result[0].count > max)
    throw new AppError(429, "Please slow down and try again shortly.");
}
export async function audit(
  operatorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, string | number | boolean> = {},
) {
  return db.auditLog.create({
    data: { operatorId, action, targetType, targetId, metadata },
  });
}
export function safeError(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "VELORA operation failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
