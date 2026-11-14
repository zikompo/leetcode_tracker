import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["adapters/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
