import { defineConfig } from "@playwright/test";
const port = Number(process.env.FAITHQUEST_E2E_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Choose a valid local browser-test port.");
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: ".cache/playwright-demo-results",
  testMatch: "journey.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    viewport: { width: 1440, height: 1100 },
    timezoneId: "Asia/Kuala_Lumpur",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60000,
  },
  reporter: "list",
});
