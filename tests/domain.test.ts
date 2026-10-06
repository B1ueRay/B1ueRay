import { describe, it, expect } from "vitest";
import { entitled } from "@/services/entitlements";
import { allocate } from "@/services/payments";
import { verifySignature, moderation } from "@/providers/mock";
import { ageToken, validAgeToken } from "@/lib/age";
import { score } from "@/services/recommendations";
import { createHmac } from "node:crypto";
describe("central entitlements", () => {
  it("permits public previews", () =>
    expect(entitled("PUBLIC", false, false)).toBe(true));
  it("requires a live subscription for subscriber posts", () => {
    expect(entitled("SUBSCRIBER", false, false)).toBe(false);
    expect(entitled("SUBSCRIBER", true, false)).toBe(true);
  });
  it("requires a separate PPV purchase even for subscribers", () => {
    expect(entitled("PPV", true, false)).toBe(false);
    expect(entitled("PPV", false, true)).toBe(true);
  });
  it("fails closed for unknown visibility", () =>
    expect(entitled("UNKNOWN", true, true)).toBe(false));
});
describe("ledger and cryptography", () => {
  it.each([1, 99, 499, 1499, 50000])(
    "balances integer ledger allocations for %i cents",
    (amount) => {
      const a = allocate(amount);
      expect(Object.values(a).reduce((s, v) => s + v, 0)).toBe(0);
      expect(Object.values(a).every(Number.isInteger)).toBe(true);
    },
  );
  it("rejects forged payment signatures", () => {
    const body = '{"payment":"test"}',
      signature = createHmac("sha256", "test").update(body).digest("hex");
    expect(verifySignature(body, signature, "test")).toBe(true);
    expect(verifySignature(body + "x", signature, "test")).toBe(false);
    expect(verifySignature(body, "", "test")).toBe(false);
  });
  it("validates age declaration tokens and rejects tampering", () => {
    const token = ageToken();
    expect(validAgeToken(token)).toBe(true);
    expect(validAgeToken(token.replace(/^\d+/, "99999999999999"))).toBe(false);
    expect(validAgeToken(undefined)).toBe(false);
  });
});
describe("safe mock moderation and recommendations", () => {
  it.each([
    "underage character",
    "celebrity deepfake",
    "explicit imagery",
    "trafficking scene",
  ])("rejects prohibited brief: %s", async (text) =>
    expect((await moderation.text(text)).allowed).toBe(false),
  );
  it("accepts a safe creative brief", async () =>
    expect(
      (
        await moderation.text(
          "A fully clothed fictional adult in a coastal art study",
        )
      ).allowed,
    ).toBe(true));
  it("ranks matching interests deterministically", () => {
    const c = {
      popularity: 50,
      featured: false,
      tags: ["art"],
      languages: ["English"],
    };
    expect(score(c, { tags: ["art"], languages: ["English"] })).toBeGreaterThan(
      score(c, { tags: [], languages: [] }),
    );
  });
});

describe("external upload adapter validation", () => {
  it("rejects SVG and HTML uploads even when a filename looks safe", async () => {
    const { validateUpload } = await import("@/lib/uploads");
    expect(() =>
      validateUpload(
        Buffer.from('<svg onload="alert(1)"></svg>'),
        "image/svg+xml",
      ),
    ).toThrow("Unsupported");
  });
  it("rejects forged image MIME types", async () => {
    const { validateUpload } = await import("@/lib/uploads");
    expect(() =>
      validateUpload(Buffer.from("not really a png file"), "image/png"),
    ).toThrow("signature");
  });
  it("generates an opaque safe filename for a valid signature", async () => {
    const { validateUpload } = await import("@/lib/uploads");
    const bytes = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      Buffer.alloc(8),
    ]);
    expect(validateUpload(bytes, "image/png").key).toMatch(
      /^uploads\/[a-f0-9-]+\.png$/,
    );
  });
});
