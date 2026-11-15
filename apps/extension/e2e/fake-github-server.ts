import { createServer, type Server } from "node:http";
import { fakeGitHub } from "../lib/github/fake-github";

/** The port the extension is built against for E2E (see the e2e script). */
export const FAKE_GITHUB_PORT = 54330;

/** fakeGitHub over HTTP, with CORS, standing in for both github.com and api.github.com. */
export function fakeGitHubServer() {
  let gh = fakeGitHub();
  const server: Server = createServer((req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, OPTIONS");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    let raw = "";
    req.on("data", (c: Buffer) => (raw += c.toString()));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${FAKE_GITHUB_PORT}`);
      const r = gh.handle(
        req.method ?? "GET",
        url,
        raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
        req.headers.authorization ?? null,
      );
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(r.json === undefined ? "" : JSON.stringify(r.json));
    });
  });
  return {
    get gh() {
      return gh;
    },
    reset: () => void (gh = fakeGitHub()),
    start: () => new Promise<void>((r) => server.listen(FAKE_GITHUB_PORT, "127.0.0.1", r)),
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}
