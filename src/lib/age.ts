import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { verifySignature } from "@/providers/mock";
import { AppError } from "./security";
const secret = () => process.env.MEDIA_SIGNING_SECRET || "";
export function ageToken() {
  if (!secret()) throw new Error("MEDIA_SIGNING_SECRET required");
  const value = String(Date.now() + 30 * 86400000);
  return `${value}.${createHmac("sha256", secret()).update(value).digest("hex")}`;
}
export function validAgeToken(token: string | undefined) {
  if (!secret() || !token) return false;
  const [expiry, signature] = token.split(".");
  return (
    Number(expiry) > Date.now() &&
    !!signature &&
    verifySignature(expiry, signature, secret())
  );
}
export async function requireGate() {
  if (!validAgeToken((await cookies()).get("velora-adult")?.value))
    throw new AppError(403, "Adult confirmation required.");
  const blocked = (process.env.BLOCKED_COUNTRIES || "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  if (!blocked.length) return;
  const country =
    process.env.TRUST_COUNTRY_HEADER === "true"
      ? (await headers()).get("x-verified-country")
      : null;
  if (!country || blocked.includes(country.toUpperCase()))
    throw new AppError(
      451,
      "This service is unavailable in your jurisdiction.",
    );
}
