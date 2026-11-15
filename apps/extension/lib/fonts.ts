import geistSans from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?inline";
import geistMono from "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?inline";

/** Names the panel's CSS asks for; distinct so they never clash with fonts LeetCode loads. */
export const PANEL_FONTS = { sans: "LeetTrack Geist", mono: "LeetTrack Geist Mono" } as const;

const bytes = (dataUrl: string) =>
  Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0)).buffer;

/**
 * Register Geist for the log panel. A shadow root can't declare its own @font-face, so the faces
 * go on the page's font set. They're built from bytes bundled into the content script rather
 * than a URL, so LeetCode's content security policy has nothing to block. If anything fails the
 * panel just uses system fonts.
 */
export function loadPanelFonts(fonts: FontFaceSet = document.fonts) {
  try {
    if ([...fonts].some((f) => f.family.replace(/"/g, "") === PANEL_FONTS.sans)) return;
    for (const [family, data] of [
      [PANEL_FONTS.sans, geistSans],
      [PANEL_FONTS.mono, geistMono],
    ] as const) {
      fonts.add(new FontFace(family, bytes(data), { weight: "100 900", display: "swap" }));
    }
  } catch {
    // system fonts it is
  }
}
