// MAIN-world only: reads the Monaco editor LeetCode exposes on `window.monaco`.
// Verified 2026-11-14: `monaco.editor.getEditors()` returns the code editor (language e.g. "cpp")
// plus a plaintext testcase editor.

interface MonacoModel {
  getValue(): string;
  getLanguageId(): string;
}
interface MonacoLike {
  editor?: {
    getEditors?: () => Array<{ getModel(): MonacoModel | null }>;
    getModels?: () => MonacoModel[];
  };
}

export function readEditorCode(win: Window): { code?: string; lang?: string } {
  const monaco = (win as unknown as { monaco?: MonacoLike }).monaco;
  if (!monaco?.editor) return {};
  const models: MonacoModel[] =
    monaco.editor.getEditors?.().flatMap((e) => {
      const m = e.getModel();
      return m ? [m] : [];
    }) ??
    monaco.editor.getModels?.() ??
    [];
  const model = models.find((m) => m.getLanguageId() !== "plaintext");
  return model ? { code: model.getValue(), lang: model.getLanguageId() } : {};
}
