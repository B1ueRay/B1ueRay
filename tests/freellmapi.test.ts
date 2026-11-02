import { describe, it, expect, vi } from "vitest";
import {
  createFreeLlmApiProvider,
  freeLlmApiConfig,
  systemPrompt,
} from "@/providers/freellmapi";
import type { ChatContext } from "@/providers/interfaces";

const context: ChatContext = {
  name: "Aria Wells",
  tone: "warm",
  interests: ["travel", "music"],
  languages: ["English"],
  boundaries: "No explicit content.",
  history: [
    { sender: "USER", body: "Hi" },
    { sender: "CREATOR", body: "Hello there" },
  ],
  memory: { preferredName: "Sam" },
  subscribed: false,
};

describe("FreeLLMAPI adapter", () => {
  it("is disabled without base URL and key", () => {
    expect(freeLlmApiConfig({})).toBeNull();
    expect(freeLlmApiConfig({ FREELLMAPI_BASE_URL: "http://x/v1" })).toBeNull();
  });

  it("parses configuration with defaults", () => {
    expect(
      freeLlmApiConfig({
        FREELLMAPI_BASE_URL: "http://localhost:3001/v1/",
        FREELLMAPI_API_KEY: "k",
      }),
    ).toEqual({
      baseUrl: "http://localhost:3001/v1",
      apiKey: "k",
      model: "auto",
      timeoutMs: 25000,
      maxTokens: 400,
    });
  });

  it("builds a disclosed, safe persona prompt", () => {
    const prompt = systemPrompt(context);
    expect(prompt).toContain("Aria Wells");
    expect(prompt).toContain("fictional AI");
    expect(prompt).toContain("preferredName: Sam");
  });

  it("calls the OpenAI-compatible endpoint and maps history", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            model: "llama-3.3-70b",
            choices: [{ message: { content: " Hey Sam! " } }],
            usage: { total_tokens: 42 },
          }),
          { status: 200 },
        ),
    );
    const provider = createFreeLlmApiProvider(
      {
        baseUrl: "http://router/v1",
        apiKey: "secret",
        model: "auto",
        timeoutMs: 1000,
        maxTokens: 100,
      },
      fetchMock,
    );
    const result = await provider.respond(context, "How are you?");
    expect(result).toEqual({
      text: "Hey Sam!",
      tokens: 42,
      provider: "freellmapi:llama-3.3-70b",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://router/v1/chat/completions");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer secret",
    );
    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe("auto");
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
  });

  it("throws on upstream errors", async () => {
    const provider = createFreeLlmApiProvider(
      {
        baseUrl: "http://router/v1",
        apiKey: "k",
        model: "auto",
        timeoutMs: 1000,
        maxTokens: 100,
      },
      (async () =>
        new Response("rate limited", { status: 429 })) as typeof fetch,
    );
    await expect(provider.respond(context, "hi")).rejects.toThrow("429");
  });
});
