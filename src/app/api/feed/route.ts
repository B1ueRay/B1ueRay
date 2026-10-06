import { adultActor, safeError } from "@/lib/security";
import { postFeed } from "@/services/entitlements";
export async function GET(r: Request) {
  try {
    const u = await adultActor();
    return Response.json(
      await postFeed(u.id, {
        following: true,
        cursor: new URL(r.url).searchParams.get("cursor") || undefined,
      }),
    );
  } catch (e) {
    return safeError(e);
  }
}
