// Public surface of the NeetCode adapter. Code outside this folder imports only from here
// (the MAIN-world entrypoint imports the interceptor directly to stay small).
export * from "./url";
export { fetchNeetcodeMetadata, leettrackSlugFor } from "./metadata";
export { createNeetcodeDetector } from "./detector";
export { installNeetcodeInterceptor } from "./interceptor";
