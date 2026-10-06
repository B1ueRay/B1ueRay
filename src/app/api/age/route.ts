import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ageToken } from "@/lib/age";
import { sameOrigin, safeError, AppError } from "@/lib/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (body.confirmed !== true || body.acceptTerms !== true)
      throw new AppError(
        400,
        "Adult declaration and terms acceptance are required.",
      );
    const blocked = (process.env.BLOCKED_COUNTRIES || "")
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean);
    const country =
      process.env.TRUST_COUNTRY_HEADER === "true"
        ? (await headers()).get("x-verified-country")
        : null;
    if (blocked.length && (!country || blocked.includes(country.toUpperCase())))
      throw new AppError(
        451,
        "This service is unavailable in your jurisdiction.",
      );
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) {
      await db.$transaction(async (tx) => {
        const existing = await tx.ageVerificationStatus.findUnique({
          where: { userId: session.user.id },
        });
        if (existing?.state === "REJECTED")
          throw new AppError(
            403,
            "This account requires an age-verification review.",
          );
        await tx.ageVerificationStatus.upsert({
          where: { userId: session.user.id },
          create: {
            userId: session.user.id,
            state: "SELF_DECLARED",
            declaredAt: new Date(),
          },
          update:
            existing?.state === "VERIFIED"
              ? {}
              : { state: "SELF_DECLARED", declaredAt: new Date() },
        });
        const docs = await tx.legalDocument.findMany({
          where: { active: true },
        });
        for (const d of docs)
          await tx.legalAcceptance.upsert({
            where: {
              userId_documentId: { userId: session.user.id, documentId: d.id },
            },
            create: { userId: session.user.id, documentId: d.id },
            update: {},
          });
      });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set("velora-adult", ageToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.BETTER_AUTH_URL?.startsWith("https://") === true,
      maxAge: 30 * 86400,
      path: "/",
    });
    return response;
  } catch (e) {
    return safeError(e);
  }
}
