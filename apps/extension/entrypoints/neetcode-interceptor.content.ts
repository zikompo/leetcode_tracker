// Import the interceptor directly (not the adapter index) to keep this page-world bundle tiny.
import { installNeetcodeInterceptor } from "@/adapters/neetcode/interceptor";
import { NEETCODE_MATCHES } from "@/adapters/neetcode/url";

// Page-world script on neetcode.io: watches Submit to see the user's own submissions.
// Registered at runtime with the panel script (see lib/neetcode.ts).
export default defineContentScript({
  matches: NEETCODE_MATCHES,
  registration: "runtime",
  world: "MAIN",
  runAt: "document_start",
  main() {
    installNeetcodeInterceptor(window, { record: import.meta.env.DEV });
  },
});
