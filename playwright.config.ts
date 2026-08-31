import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

// Runs against a production build (see scripts/preview-server.mjs — `vite
// preview` doesn't work with the netlify Nitro preset's output layout).
// `npm run test:e2e` builds first; CI or a manual `npx playwright test`
// run assumes `NITRO_PRESET=netlify npm run build` has already happened.
const PORT = Number(process.env["PORT"] ?? 8888);
const explicitBaseUrl = process.env["BASE_URL"];
const BASE_URL = explicitBaseUrl ?? `http://127.0.0.1:${PORT}`;
const isCI = !!process.env["CI"];

const webServer: PlaywrightTestConfig["webServer"] = explicitBaseUrl
  ? undefined
  : {
      command: "node scripts/preview-server.mjs",
      url: BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 30_000,
      env: { PORT: String(PORT) },
    };

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(webServer ? { webServer } : {}),
});
