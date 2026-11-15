import { describe, expect, it, vi } from "vitest";
import type { AiConfig } from "./config";
import { createAiService } from "./index";
import { extractJson, userPrompt, type AnalysisInput } from "./prompt";
import { analyzeComplexity, generateTwists } from "./providers";

const input: AnalysisInput = {
  slug: "two-sum",
  frontendId: "1",
  title: "Two Sum",
  language: "python3",
  code: "class Solution: ...",
};

const openai: AiConfig = {
  preset: "deepseek",
  kind: "openai",
  baseUrl: "https://llm.example/v1/",
  model: "test-model",
  apiKey: "sk-test",
};
const anthropic: AiConfig = {
  preset: "anthropic",
  kind: "anthropic",
  baseUrl: "https://claude.example",
  model: "claude-haiku-5-5",
  apiKey: "sk-ant-test",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const chat = (content: string | null, finish_reason = "stop") =>
  json({ choices: [{ message: { content }, finish_reason }] });
const REPLY = '{"time":"O(N)","space":"O(N)","optimalTime":"O(n)","optimalSpace":"O(1)"}';

describe("prompt helpers", () => {
  it("names the problem and fences the code, without a problem statement", () => {
    const p = userPrompt(input);
    expect(p).toContain("Problem: 1. Two Sum (two-sum)");
    expect(p).toContain("```python3\nclass Solution: ...\n```");
  });
  it("finds JSON inside fences or prose", () => {
    expect(extractJson('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson("no json")).toThrow(/no JSON/);
  });
});

describe("OpenAI-compatible provider", () => {
  it("sends a JSON-mode chat request and normalises the reply", async () => {
    const fetchMock = vi.fn(async () => chat("```json\n" + REPLY + "\n```"));
    const s = await analyzeComplexity(openai, input, fetchMock);
    expect(s).toEqual({
      model: "test-model",
      time: "O(n)",
      space: "O(n)",
      optimalTime: "O(n)",
      optimalSpace: "O(1)",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://llm.example/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ model: "test-model", response_format: { type: "json_object" } });
  });
  it("retries without JSON mode when the server rejects it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "response_format unsupported" } }, 400))
      .mockResolvedValueOnce(chat(REPLY));
    await expect(analyzeComplexity(openai, input, fetchMock)).resolves.toMatchObject({
      time: "O(n)",
    });
    const second = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(second).not.toHaveProperty("response_format");
  });
  it("explains common failures", async () => {
    await expect(
      analyzeComplexity(openai, input, async () => json({ error: { message: "bad key" } }, 401)),
    ).rejects.toThrow("The API key was rejected.");
    await expect(
      analyzeComplexity(openai, input, async () => json({ error: "slow down" }, 429)),
    ).rejects.toThrow(/Rate limited.*slow down/);
    await expect(
      analyzeComplexity(openai, input, async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).rejects.toThrow(/Couldn't reach llm\.example/);
    await expect(
      analyzeComplexity(openai, input, async () => chat(null, "length")),
    ).rejects.toThrow(/cut off/);
    await expect(
      analyzeComplexity(openai, input, async () => chat('{"time":"O(n)"}')),
    ).rejects.toThrow(/expected format/);
  });
  it("refuses to send empty or oversized code", async () => {
    const fetchMock = vi.fn();
    await expect(analyzeComplexity(openai, { ...input, code: " " }, fetchMock)).rejects.toThrow();
    await expect(
      analyzeComplexity(openai, { ...input, code: "x".repeat(20_001) }, fetchMock),
    ).rejects.toThrow(/not sent/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Claude provider", () => {
  const message = (text: string, stop_reason = "end_turn") =>
    json({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-haiku-5-5",
      content: [{ type: "text", text }],
      stop_reason,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    });

  it("asks for a JSON schema and parses the structured reply", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => message(REPLY));
    const s = await analyzeComplexity(anthropic, input, fetchMock as unknown as typeof fetch);
    expect(s).toMatchObject({ model: "claude-haiku-5-5", time: "O(n)", optimalSpace: "O(1)" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("https://claude.example/v1/messages");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-ant-test");
    const body = JSON.parse(init.body as string) as {
      model: string;
      output_config: { format: { type: string; schema: { required: string[] } } };
    };
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema.required).toEqual([
      "time",
      "space",
      "optimalTime",
      "optimalSpace",
    ]);
  });
  it("reports a rejected key and a refusal plainly", async () => {
    const unauthorized = async () =>
      json(
        { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
        401,
      );
    await expect(
      analyzeComplexity(anthropic, input, unauthorized as unknown as typeof fetch),
    ).rejects.toThrow("The API key was rejected.");
    const refused = async () => message("", "refusal");
    await expect(
      analyzeComplexity(anthropic, input, refused as unknown as typeof fetch),
    ).rejects.toThrow(/declined/);
  });
});

describe("createAiService", () => {
  it("is off until configured", async () => {
    const off = createAiService(async () => null);
    await expect(off.getAiStatus()).resolves.toEqual({ enabled: false });
    await expect(off.analyzeComplexity(input)).rejects.toThrow(/turned off/);
  });
  it("labels the provider and model", async () => {
    const on = createAiService(
      async () => openai,
      async () => chat(REPLY),
    );
    await expect(on.getAiStatus()).resolves.toEqual({
      enabled: true,
      label: "DeepSeek · test-model",
    });
    await expect(on.analyzeComplexity(input)).resolves.toMatchObject({ space: "O(n)" });
  });
});

describe("twists", () => {
  it("sends only the problem's name and returns up to three twists", async () => {
    const fetchMock = vi.fn(async () =>
      chat(
        JSON.stringify({
          twists: ["What if the input were a stream?", "  ", "What if values repeat?", "a", "b"],
        }),
      ),
    );
    const twists = await generateTwists(openai, { slug: "two-sum", title: "Two Sum" }, fetchMock);
    expect(twists).toEqual(["What if the input were a stream?", "What if values repeat?", "a"]);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    ) as {
      messages: Array<{ content: string }>;
    };
    expect(body.messages[1]!.content).toBe("Problem: Two Sum (two-sum)");
    expect(JSON.stringify(body)).not.toContain("class Solution");
  });
});
