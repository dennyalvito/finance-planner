import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e-pwa",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:5000",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:5000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
