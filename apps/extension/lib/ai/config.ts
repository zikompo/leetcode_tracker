import { browser } from "wxt/browser";
import { z } from "zod";

/** "anthropic" uses the Claude Messages API; "openai" is any OpenAI-compatible chat endpoint. */
export type ProviderKind = "anthropic" | "openai";

export interface AiPreset {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  /** Suggested default; the user can change it. */
  model: string;
}

/**
 * Providers offered in settings. Base URLs were checked against each provider's docs on
 * 2026-11-14; the non-Claude model ids are best guesses from public price lists, so the
 * settings page lets the user edit them and run a test.
 */
export const AI_PRESETS: AiPreset[] = [
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-haiku-5-5",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
  },
  {
    id: "qwen",
    label: "Qwen (Alibaba Cloud, Singapore)",
    kind: "openai",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    model: "qwen-flash",
  },
  {
    id: "zai",
    label: "GLM (Z.ai)",
    kind: "openai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    model: "glm-5.3-flash",
  },
  { id: "custom", label: "Other (OpenAI-compatible)", kind: "openai", baseUrl: "", model: "" },
];

export const presetById = (id: string) => AI_PRESETS.find((p) => p.id === id);

export const aiConfigSchema = z.object({
  preset: z.string(),
  kind: z.enum(["anthropic", "openai"]),
  baseUrl: z.url(),
  model: z.string().min(1),
  apiKey: z.string().min(1),
});
export type AiConfig = z.infer<typeof aiConfigSchema>;

/**
 * Kept in chrome.storage.local, apart from Settings, so the API key never leaves this
 * browser: it isn't synced and isn't part of the JSON export.
 */
const STORAGE_KEY = "leettrack:ai";

export async function loadAiConfig(): Promise<AiConfig | null> {
  const stored = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  const parsed = aiConfigSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

export async function saveAiConfig(config: AiConfig | null): Promise<void> {
  if (config) await browser.storage.local.set({ [STORAGE_KEY]: aiConfigSchema.parse(config) });
  else await browser.storage.local.remove(STORAGE_KEY);
}

/** Host-permission pattern for a provider, e.g. "https://api.deepseek.com/*". */
export const originPattern = (baseUrl: string) => `${new URL(baseUrl).origin}/*`;
