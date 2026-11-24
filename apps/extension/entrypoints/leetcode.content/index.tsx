import { LEETCODE_MATCHES } from "@/adapters/leetcode";
import { LEETCODE } from "@/adapters/sites";
import { mountPanel } from "./mount";

export default defineContentScript({
  matches: LEETCODE_MATCHES,
  cssInjectionMode: "ui",
  main: (ctx) => mountPanel(ctx, LEETCODE),
});
