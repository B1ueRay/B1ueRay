import { access, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
try {
  await access(".env");
  console.log("Existing .env preserved.");
} catch {
  let text = await readFile(".env.example", "utf8");
  for (const key of [
    "BETTER_AUTH_SECRET",
    "MEDIA_SIGNING_SECRET",
    "PAYMENT_WEBHOOK_SECRET",
  ])
    text = text.replace(
      new RegExp(`^${key}=.*$`, "m"),
      `${key}=${randomBytes(32).toString("hex")}`,
    );
  await writeFile(".env", text, { flag: "wx", mode: 0o600 });
  console.log("Created local .env with independent random secrets.");
}
