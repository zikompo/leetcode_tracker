import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "./config";
import {
  ANALYSIS_JSON_SCHEMA,
  MAX_CODE_CHARS,
  SYSTEM_PROMPT,
  analysisSchema,
  extractJson,
  toSuggestion,
  userPrompt,
  type AnalysisInput,
  type ComplexitySuggestion,
} from "./prompt";

type FetchLike = typeof fetch;
const TIMEOUT_MS = 60_000;

/** Claude via the official SDK, with a JSON schema so the reply always parses. */
async function analyzeWithAnthropic(
  config: AiConfig,
  input: AnalysisInput,
  fetchImpl?: FetchLike,
): Promise<ComplexitySuggestion> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    // The key is the user's own, typed into this extension's settings and kept in
    // chrome.storage.local. There is no server to hold it for them.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
    timeout: TIMEOUT_MS,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  try {
    // create() rather than parse(): a refusal has no JSON to parse, and must be reported as such.
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(input) }],
      output_config: { format: { type: "json_schema", schema: ANALYSIS_JSON_SCHEMA } },
    });
    if (response.stop_reason === "refusal")
      throw new Error("The model declined to analyse this code.");
    if (response.stop_reason === "max_tokens") throw new Error("The model's reply was cut off.");
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = analysisSchema.safeParse(extractJson(text));
    if (!parsed.success) throw new Error("The model's reply didn't match the expected format.");
    return toSuggestion(parsed.data, config.model);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("The API key was rejected.");
    if (err instanceof Anthropic.PermissionDeniedError)
      throw new Error("This API key can't use that model.");
    if (err instanceof Anthropic.NotFoundError)
      throw new Error(`Model "${config.model}" not found.`);
    if (err instanceof Anthropic.RateLimitError)
      throw new Error("Rate limited, or out of credit. Try again later.");
    if (err instanceof Anthropic.APIConnectionError)
      throw new Error(`Couldn't reach ${new URL(config.baseUrl).host}.`);
    if (err instanceof Anthropic.APIError) throw new Error(`HTTP ${err.status}: ${err.message}`);
    throw err;
  }
}

function httpError(status: number, body: string): Error {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    detail =
      (typeof parsed.error === "string" ? parsed.error : parsed.error?.message) ??
      parsed.message ??
      "";
  } catch {
    detail = body.slice(0, 200);
  }
  if (status === 401 || status === 403) return new Error("The API key was rejected.");
  if (status === 404) return new Error(`Not found: check the base URL and model. ${detail}`.trim());
  if (status === 402 || status === 429)
    return new Error(`Rate limited, or out of credit (HTTP ${status}). ${detail}`.trim());
  return new Error(`HTTP ${status}: ${detail || "request failed"}`);
}

/** Any OpenAI-compatible chat endpoint (DeepSeek, Qwen, GLM, Kimi, local servers…). */
async function analyzeWithOpenAICompatible(
  config: AiConfig,
  input: AnalysisInput,
  fetchImpl: FetchLike = fetch,
): Promise<ComplexitySuggestion> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const base = {
    model: config.model,
    max_tokens: 8192,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(input) },
    ],
  };
  const post = async (body: object) => {
    try {
      return await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const host = new URL(config.baseUrl).host;
      if (err instanceof DOMException && err.name === "TimeoutError")
        throw new Error(`${host} took too long to answer.`);
      throw new Error(
        `Couldn't reach ${host}. Check the base URL, and save the settings again so Chrome asks for access to it.`,
      );
    }
  };

  let res = await post({ ...base, response_format: { type: "json_object" } });
  // Not every compatible server supports JSON mode; the prompt alone still asks for JSON.
  if (res.status === 400 || res.status === 422) res = await post(base);
  const text = await res.text();
  if (!res.ok) throw httpError(res.status, text);

  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  };
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error(
      choice?.finish_reason === "length"
        ? "The model's reply was cut off."
        : "The model sent an empty reply.",
    );
  }
  const parsed = analysisSchema.safeParse(extractJson(content));
  if (!parsed.success) throw new Error("The model's reply didn't match the expected format.");
  return toSuggestion(parsed.data, config.model);
}

/** Estimate the complexity of one solution with the configured provider. */
export async function analyzeComplexity(
  config: AiConfig,
  input: AnalysisInput,
  fetchImpl?: FetchLike,
): Promise<ComplexitySuggestion> {
  if (!input.code.trim()) throw new Error("No code to analyse.");
  if (input.code.length > MAX_CODE_CHARS) {
    throw new Error(
      `The solution is over ${MAX_CODE_CHARS.toLocaleString()} characters; not sent.`,
    );
  }
  return config.kind === "anthropic"
    ? analyzeWithAnthropic(config, input, fetchImpl)
    : analyzeWithOpenAICompatible(config, input, fetchImpl);
}
