// Import the interceptor directly (not the adapter index) to keep this page-world bundle tiny.
import { installInterceptor } from "@/adapters/leetcode/interceptor";

// Page-world script: wraps fetch/XHR to observe the user's own submissions.
export default defineContentScript({
  matches: ["https://leetcode.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    installInterceptor(window, { record: import.meta.env.DEV });
  },
});
