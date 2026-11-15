import { loadAiConfig, presetById, type AiConfig } from "./config";
import type { AnalysisInput, ComplexitySuggestion } from "./prompt";
import { analyzeComplexity, generateTwists } from "./providers";
import type { TwistInput } from "./twists";

export * from "./config";
export * from "./prompt";
export * from "./twists";
export { analyzeComplexity, generateTwists } from "./providers";

export interface AiStatus {
  enabled: boolean;
  /** e.g. "DeepSeek · deepseek-flash" */
  label?: string;
}

/** Background-side handlers for complexity suggestions. */
export function createAiService(
  load: () => Promise<AiConfig | null> = loadAiConfig,
  fetchImpl?: typeof fetch,
) {
  return {
    async getAiStatus(): Promise<AiStatus> {
      const config = await load();
      if (!config) return { enabled: false };
      const name = presetById(config.preset)?.label ?? new URL(config.baseUrl).host;
      return { enabled: true, label: `${name} · ${config.model}` };
    },
    async analyzeComplexity(input: AnalysisInput): Promise<ComplexitySuggestion> {
      const config = await load();
      if (!config) throw new Error("Complexity suggestions are turned off.");
      return analyzeComplexity(config, input, fetchImpl);
    },
    async generateTwists(input: TwistInput): Promise<string[]> {
      const config = await load();
      if (!config) throw new Error("AI suggestions are turned off.");
      return generateTwists(config, input, fetchImpl);
    },
  };
}
