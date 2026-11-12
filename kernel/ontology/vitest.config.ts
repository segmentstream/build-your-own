import { defineConfig } from "vitest/config";

// Each test file migrates its own in-process database, so the first test of a file takes a few
// seconds. Copied verbatim from the build-your-own kernel.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
