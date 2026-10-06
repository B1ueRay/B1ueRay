import { db } from "@/lib/db";
import { adultActor, safeError } from "@/lib/security";
export async function GET() {
  try {
    const u = await adultActor();
    const data = await db.user.findUnique({
      where: { id: u.id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        profile: true,
        settings: true,
        age: true,
        subscriptions: true,
        purchases: true,
        favorites: true,
        requests: true,
        conversations: {
          select: {
            id: true,
            creatorId: true,
            memory: true,
            messages: {
              where: {
                deletedAt: null,
                moderation: "APPROVED",
                OR: [
                  { type: { not: "LOCKED" } },
                  { unlocks: { some: { userId: u.id, status: "PAID" } } },
                ],
              },
              select: { sender: true, body: true, type: true, createdAt: true },
            },
          },
        },
        payments: {
          select: {
            id: true,
            kind: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
          },
        },
        acceptances: true,
      },
    });
    return Response.json(data, {
      headers: {
        "Content-Disposition": 'attachment; filename="velora-export.json"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return safeError(e);
  }
}
