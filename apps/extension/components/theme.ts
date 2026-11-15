// Geist for extension pages (bundled with the extension; nothing is fetched from the web).
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";

/**
 * Extension pages follow the system's light or dark setting. Pages can't run inline scripts
 * (the extension's content security policy), so this runs first thing in each page's module.
 */
export function followSystemTheme() {
  const light = matchMedia("(prefers-color-scheme: light)");
  const apply = () => {
    document.documentElement.dataset.theme = light.matches ? "light" : "dark";
  };
  apply();
  light.addEventListener("change", apply);
}
