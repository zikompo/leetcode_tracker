import { NEETCODE_MATCHES } from "@/adapters/neetcode";
import { NEETCODE } from "@/adapters/sites";
import { mountPanel } from "../leetcode.content/mount";

// Registered at runtime, only once the user turns on NeetCode in Settings and Chrome grants
// access to neetcode.io (see lib/neetcode.ts). It's the same log panel as on LeetCode.
export default defineContentScript({
  matches: NEETCODE_MATCHES,
  registration: "runtime",
  cssInjectionMode: "ui",
  main: (ctx) => mountPanel(ctx, NEETCODE),
});
