export type ModerationResult = {
  allowed: boolean;
  reasons: string[];
  provider: string;
};
export interface ModerationProvider {
  text(value: string): Promise<ModerationResult>;
  media(
    type: "IMAGE" | "VIDEO" | "VOICE",
    key: string,
  ): Promise<ModerationResult>;
}
export type ChatContext = {
  name: string;
  tone: string;
  interests: string[];
  languages: string[];
  boundaries: string;
  history: { sender: string; body: string }[];
  memory: Record<string, string>;
  subscribed: boolean;
};
export interface LLMProvider {
  respond(
    context: ChatContext,
    message: string,
  ): Promise<{ text: string; tokens: number }>;
}
export type GeneratedMedia = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
};
export interface ImageGenerationProvider {
  generate(brief: string, accent: string): Promise<GeneratedMedia>;
}
export interface VideoGenerationProvider {
  generate(brief: string, accent: string): Promise<GeneratedMedia>;
}
export interface VoiceProvider {
  generate(brief: string, accent: string): Promise<GeneratedMedia>;
}
export interface StorageProvider {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}
export type PaymentIntent = {
  id: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
};
export type PaymentResult = { reference: string; status: "PAID" | "FAILED" };
export interface PaymentProvider {
  charge(intent: PaymentIntent): Promise<PaymentResult>;
  refund(reference: string, amount: number): Promise<void>;
  verifyWebhook(body: string, signature: string): boolean;
}
export interface NotificationDelivery {
  deliver(userId: string, title: string, body: string): Promise<void>;
}
export interface LongTermMemoryProvider {
  summarize(history: ChatContext["history"]): Promise<Record<string, string>>;
}
