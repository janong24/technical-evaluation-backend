import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.mts";

const testsPath = path.join(__dirname, "tests/");

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      setupFiles: ["tests/setup/before-each-test-setup.ts"],
      // https://vitest.dev/guide/reporters.html
      reporters: ["verbose", "junit"],
      // https://vitest.dev/guide/coverage.html
      coverage: {
        enabled: true,
        provider: "v8",
        reporter: ["cobertura"],
        reportsDirectory: "./dist/artifacts/tests/coverage",
      },
      outputFile: {
        junit: "./dist/artifacts/tests/junit/junit.xml",
      },
    },
    resolve: {
      alias: {
        tests: testsPath,
      },
    },
  })
);
