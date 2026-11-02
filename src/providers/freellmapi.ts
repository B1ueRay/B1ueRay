import type { ChatContext, LLMProvider } from "./interfaces";
import { llm as mockLlm } from "./mock";

// FreeLLMAPI (https://github.com/tashfeenahmed/freellmapi) is a self-hosted,
// OpenAI-compatible router over many free LLM tiers. This adapter speaks the
// standard /v1/chat/completions contract, so any OpenAI-compatible endpoint
// works too. Without configuration the deterministic mock stays in use.

export type FreeLlmApiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
};

const DEFAULT_TIMEOUT_MS = 25000;

export function freeLlmApiConfig(
  env: Record<string, string | undefined> = process.env,
): FreeLlmApiConfig | null {
  const baseUrl = env.FREELLMAPI_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.FREELLMAPI_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  const timeoutMs = Number(env.FREELLMAPI_TIMEOUT_MS);
  const maxTokens = Number(env.FREELLMAPI_MAX_TOKENS);
  return {
    baseUrl,
    apiKey,
    model: env.FREELLMAPI_MODEL?.trim() || "auto",
    timeoutMs:
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : DEFAULT_TIMEOUT_MS,
    maxTokens:
      Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : 400,
  };
}

export function systemPrompt(context: ChatContext) {
  const memory = Object.entries(context.memory)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  return [
    `You are ${context.name}, a fictional AI creator persona on VELORA. You are not a human and must say so if asked.`,
    `Tone: ${context.tone}.`,
    context.interests.length
      ? `Interests: ${context.interests.join(", ")}.`
      : "",
    context.languages.length
      ? `Reply in the member's language when it is one of: ${context.languages.join(", ")}.`
      : "",
    context.boundaries ? `Boundaries: ${context.boundaries}` : "",
    memory ? `Remembered about the member: ${memory}.` : "",
    "Keep replies short (1-4 sentences), warm and respectful. Never produce sexual or explicit content, never claim a real-world relationship, and do not give medical, financial or legal advice.",
  ]
    .filter(Boolean)
    .join("\n");
}

type ChatCompletion = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { total_tokens?: number };
  model?: string;
};

export function createFreeLlmApiProvider(
  config: FreeLlmApiConfig,
  fetchImpl: typeof fetch = fetch,
): LLMProvider {
  return {
    async respond(context, message) {
      const messages = [
        { role: "system", content: systemPrompt(context) },
        ...context.history.map((m) => ({
          role: m.sender === "USER" ? "user" : "assistant",
          content: m.body,
        })),
        { role: "user", content: message },
      ];
      const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: config.maxTokens,
          temperature: 0.8,
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!res.ok)
        throw new Error(
          `FreeLLMAPI responded ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
      const data = (await res.json()) as ChatCompletion;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("FreeLLMAPI returned an empty completion");
      return {
        text,
        tokens:
          data.usage?.total_tokens ??
          Math.ceil((message.length + text.length) / 4),
        provider: `freellmapi:${data.model || config.model}`,
      };
    },
  };
}

// The configured provider, falling back to the mock when FreeLLMAPI is not
// configured or a request fails, so chat keeps working in demo setups.
function selectLlm(): LLMProvider {
  const config = freeLlmApiConfig();
  if (!config)
    return {
      respond: async (c, m) => ({
        ...(await mockLlm.respond(c, m)),
        provider: "mock",
      }),
    };
  const remote = createFreeLlmApiProvider(config);
  return {
    async respond(context, message) {
      try {
        return await remote.respond(context, message);
      } catch (error) {
        console.error("[llm] FreeLLMAPI failed, using mock reply:", error);
        return {
          ...(await mockLlm.respond(context, message)),
          provider: "mock",
        };
      }
    },
  };
}

export const llm = selectLlm();

// Overall chat deadline: the request timeout plus room for the mock fallback.
const configured = freeLlmApiConfig();
export const llmDeadlineMs = configured ? configured.timeoutMs + 2000 : 10000;
