import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  LLMProvider,
  ModerationProvider,
  PaymentProvider,
  ImageGenerationProvider,
  VideoGenerationProvider,
  VoiceProvider,
  GeneratedMedia,
} from "./interfaces";
export const prohibitedPatterns = [
  /\b(minor\w*|underage|child\w*|teen\w*|schoolgirl|youthful|young.looking|incest|rape|traffick\w*|coerc\w*|exploit\w*|revenge porn|deepfake|celebrity|non.consensual)\b/i,
  /\b(nude|naked|explicit|porn|sexual)\b/i,
];
export const moderation: ModerationProvider = {
  async text(value) {
    const denied = prohibitedPatterns.some((p) => p.test(value));
    return {
      allowed: !denied,
      reasons: denied ? ["Content outside the safe demo policy."] : [],
      provider: "mock-safe-policy-v1",
    };
  },
  async media(_type, key) {
    return {
      allowed: key.startsWith("generated/"),
      reasons: key.startsWith("generated/") ? [] : ["Untrusted media source"],
      provider: "mock-safe-policy-v1",
    };
  },
};
export const llm: LLMProvider = {
  async respond(context, message) {
    const interest = context.interests[0] || "creative ideas";
    const name = context.memory.preferredName;
    const text =
      message.toLowerCase().includes("hello") ||
      message.toLowerCase().includes("hi ")
        ? `Hello${name ? `, ${name}` : ""}. I'm ${context.name}, your fictional AI creator. Tell me what has inspired you today — I have been exploring ${interest}.`
        : `${name ? `${name}, ` : ""}I like the curiosity in that. In my ${context.tone} little world, ${interest} always offers a new perspective. What would you most like to explore together? This is a simulated AI conversation.`;
    return { text, tokens: Math.ceil((message.length + text.length) / 4) };
  },
};
export function verifySignature(
  body: string,
  signature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}
export const payments: PaymentProvider = {
  async charge(intent) {
    if (process.env.DEMO_MODE !== "true")
      throw new Error("Mock payments disabled outside demo mode");
    return { reference: `mock_${intent.id}`, status: "PAID" };
  },
  async refund() {
    if (process.env.DEMO_MODE !== "true")
      throw new Error("Production payment provider required");
  },
  verifyWebhook(body, signature) {
    return (
      !!process.env.PAYMENT_WEBHOOK_SECRET &&
      verifySignature(body, signature, process.env.PAYMENT_WEBHOOK_SECRET)
    );
  },
};
export const imageGenerator: ImageGenerationProvider = {
  async generate(_brief, accent) {
    const safe = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#bca278";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200"><defs><radialGradient id="g"><stop stop-color="${safe}"/><stop offset="1" stop-color="#15151b"/></radialGradient></defs><rect width="1000" height="1200" fill="url(#g)"/><circle cx="500" cy="420" r="190" fill="none" stroke="#ffffff" stroke-opacity=".25" stroke-width="1"/><path d="M160 1000 Q500 150 840 1000" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/><text x="500" y="1080" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="24" letter-spacing="10">VELORA · AI ART STUDY</text></svg>`;
    return {
      bytes: Buffer.from(svg),
      mimeType: "image/svg+xml",
      extension: "svg",
    };
  },
};
export const videoGenerator: VideoGenerationProvider = {
  async generate() {
    throw new Error(
      "Mock video rendering is unavailable. Connect an approved video provider.",
    );
  },
};
export const voiceGenerator: VoiceProvider = {
  async generate(): Promise<GeneratedMedia> {
    // A two-second neutral audio tone, never a real-person voice imitation.
    const rate = 8000,
      length = rate * 2,
      buffer = Buffer.alloc(44 + length * 2);
    buffer.write("RIFF");
    buffer.writeUInt32LE(36 + length * 2, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24);
    buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(length * 2, 40);
    for (let i = 0; i < length; i++)
      buffer.writeInt16LE(
        Math.round(Math.sin((i / rate) * 440 * 2 * Math.PI) * 1000),
        44 + i * 2,
      );
    return { bytes: buffer, mimeType: "audio/wav", extension: "wav" };
  },
};
