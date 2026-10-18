import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  // The isolated account app compiles routes on first use. Allow the same
  // bounded wait as account requests instead of racing cold compilation.
  expect: { ...base.expect, timeout: 15000 },
  outputDir: ".cache/playwright-account-results",
  testMatch: "account.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:3191" },
  webServer: {
    command: "node tests/support/account-server.mjs",
    url: "http://127.0.0.1:3191/login",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
