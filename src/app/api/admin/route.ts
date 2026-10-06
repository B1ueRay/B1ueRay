import {
  adultActor,
  sameOrigin,
  safeError,
  limit,
  AppError,
} from "@/lib/security";
import { adminSchema } from "@/lib/admin-schema";
import { executeAdmin } from "@/services/admin";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const u = await adultActor(["ADMIN", "CREATOR_MANAGER", "MODERATOR"]);
    await limit(`admin:${u.id}`, 60);
    const input = adminSchema.safeParse(await request.json());
    if (!input.success)
      throw new AppError(400, "Check the form fields and try again.");
    return Response.json(await executeAdmin(u, input.data));
  } catch (e) {
    return safeError(e);
  }
}
