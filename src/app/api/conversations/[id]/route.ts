import { adultActor, safeError } from "@/lib/security";
import { readMessages } from "@/services/chat";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await readMessages((await adultActor()).id, (await params).id),
    );
  } catch (e) {
    return safeError(e);
  }
}
