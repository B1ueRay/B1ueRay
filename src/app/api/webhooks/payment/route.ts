import { z } from "zod";
import { payments } from "@/providers/mock";
import { reconcile } from "@/services/payments";
import { safeError, AppError } from "@/lib/security";
const event = z.object({
  eventId: z.string().min(1).max(200),
  paymentId: z.string().max(100),
  status: z.enum(["PAID", "FAILED"]),
  reference: z.string().max(200),
  amount: z.number().int().positive(),
  currency: z.literal("EUR"),
});
export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 20000) throw new AppError(413, "Event too large.");
    if (
      !payments.verifyWebhook(
        body,
        request.headers.get("x-payment-signature") || "",
      )
    )
      throw new AppError(401, "Invalid webhook signature.");
    const parsed = event.safeParse(JSON.parse(body));
    if (!parsed.success) throw new AppError(400, "Invalid payment event.");
    return Response.json(await reconcile(parsed.data));
  } catch (e) {
    return safeError(e);
  }
}
