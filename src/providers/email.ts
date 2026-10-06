import { db } from "@/lib/db";
/** Development-only inbox. Production requires an approved transactional email adapter. */
export async function sendEmail(email: string, subject: string, url: string) {
  if (process.env.DEMO_MODE !== "true")
    throw new Error(
      "Transactional email provider must be configured before enabling production authentication",
    );
  await db.siteConfiguration.upsert({
    where: { key: `dev-inbox:${email}` },
    create: { key: `dev-inbox:${email}`, value: { subject, url } },
    update: { value: { subject, url } },
  });
}
