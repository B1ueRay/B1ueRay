import { db } from "@/lib/db";
export async function GET() {
  const c = await db.siteConfiguration.findUnique({
    where: { key: "reportReasons" },
  });
  return Response.json(c?.value || []);
}
