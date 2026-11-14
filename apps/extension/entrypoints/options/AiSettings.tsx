import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import {
  AI_PRESETS,
  aiConfigSchema,
  analyzeComplexity,
  loadAiConfig,
  originPattern,
  presetById,
  saveAiConfig,
  type AiConfig,
} from "@/lib/ai";

const OFF = "off";

interface Form {
  preset: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const SAMPLE = {
  slug: "two-sum",
  frontendId: "1",
  title: "Two Sum",
  language: "python3",
  code: `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i`,
};

type Message = { kind: "ok" | "bad"; text: string } | null;

function toConfig(form: Form): AiConfig | string {
  const preset = presetById(form.preset);
  const parsed = aiConfigSchema.safeParse({
    preset: form.preset,
    kind: preset?.kind ?? "openai",
    baseUrl: form.baseUrl.trim(),
    model: form.model.trim(),
    apiKey: form.apiKey.trim(),
  });
  if (parsed.success) return parsed.data;
  const field = String(parsed.error.issues[0]?.path[0] ?? "");
  return field === "baseUrl"
    ? "Enter the provider's base URL, starting with https://."
    : field === "model"
      ? "Enter a model name."
      : "Enter your API key.";
}

/** Chrome only lets the extension call a provider's API once the user grants that site. */
async function requestAccess(baseUrl: string): Promise<boolean> {
  try {
    return await browser.permissions.request({ origins: [originPattern(baseUrl)] });
  } catch {
    return false;
  }
}

export function AiSettings() {
  const [form, setForm] = useState<Form>({ preset: OFF, baseUrl: "", model: "", apiKey: "" });
  const [saved, setSaved] = useState<AiConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    void loadAiConfig().then((c) => {
      setSaved(c);
      if (c) setForm({ preset: c.preset, baseUrl: c.baseUrl, model: c.model, apiKey: c.apiKey });
    });
  }, []);

  const choosePreset = (id: string) => {
    setMessage(null);
    if (id === OFF) return setForm((f) => ({ ...f, preset: OFF }));
    const p = presetById(id)!;
    // A key belongs to one provider: never carry it over, or it would be sent to another.
    const keep = saved?.preset === id ? saved : null;
    setForm({
      preset: id,
      baseUrl: keep?.baseUrl ?? p.baseUrl,
      model: keep?.model ?? p.model,
      apiKey: keep?.apiKey ?? "",
    });
  };
  const field = (k: keyof Form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setMessage(null);
    if (form.preset === OFF) {
      await saveAiConfig(null);
      setSaved(null);
      return setMessage({ kind: "ok", text: "Complexity suggestions are off." });
    }
    const config = toConfig(form);
    if (typeof config === "string") return setMessage({ kind: "bad", text: config });
    const granted = await requestAccess(config.baseUrl); // first, while the click still counts
    await saveAiConfig(config);
    setSaved(config);
    setMessage(
      granted
        ? { kind: "ok", text: "Saved. Your next Accepted solution gets a complexity suggestion." }
        : {
            kind: "bad",
            text: `Saved, but Chrome didn't grant access to ${new URL(config.baseUrl).host}, so requests may be blocked. Save again to retry.`,
          },
    );
  };

  const test = async () => {
    setMessage(null);
    const config = toConfig(form);
    if (typeof config === "string") return setMessage({ kind: "bad", text: config });
    await requestAccess(config.baseUrl);
    setBusy(true);
    try {
      const s = await analyzeComplexity(config, SAMPLE);
      setMessage({
        kind: "ok",
        text: `Works. Two Sum (hash map): ${s.time ?? "?"} time, ${s.space ?? "?"} space; best known ${s.optimalTime ?? "?"}.`,
      });
    } catch (e) {
      setMessage({ kind: "bad", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const on = form.preset !== OFF;
  return (
    <section className="card" aria-labelledby="ai-heading">
      <h2 id="ai-heading">Complexity suggestions</h2>
      <p className="muted">
        When a submission is accepted, LeetTrack can send that solution's code, with the problem's
        name, to a model you choose, and pre-select the time and space complexity for you. It uses
        your own API key, which stays in this browser and is not included in exports.
      </p>

      <label className="field">
        <span>Provider</span>
        <select value={form.preset} onChange={(e) => choosePreset(e.target.value)}>
          <option value={OFF}>Off</option>
          {AI_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {on && (
        <>
          <label className="field">
            <span>Model</span>
            <input value={form.model} onChange={field("model")} spellCheck={false} />
          </label>
          <label className="field">
            <span>API key</span>
            <input
              type="password"
              value={form.apiKey}
              onChange={field("apiKey")}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>Base URL</span>
            <input
              value={form.baseUrl}
              onChange={field("baseUrl")}
              placeholder="https://api.example.com/v1"
              spellCheck={false}
            />
          </label>
          <p className="muted small">
            {presetById(form.preset)?.kind === "anthropic"
              ? "Uses the Claude Messages API."
              : "Any OpenAI-compatible chat API works here, including a local server such as http://localhost:11434/v1."}{" "}
            Model names change; if the test fails with "not found", check the provider's model list.
          </p>
        </>
      )}

      <div className="row">
        <button className="btn btn-primary" onClick={() => void save()}>
          Save
        </button>
        {on && (
          <button className="btn" onClick={() => void test()} disabled={busy}>
            {busy ? "Testing…" : "Test with a sample"}
          </button>
        )}
      </div>
      {saved && !message && (
        <p className="muted small">
          On: {presetById(saved.preset)?.label ?? new URL(saved.baseUrl).host} · {saved.model}
        </p>
      )}
      {message && <p className={message.kind}>{message.text}</p>}
    </section>
  );
}
