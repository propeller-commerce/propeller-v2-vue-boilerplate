import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: 'html',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    // Auth setup projects — run first, produce storage-state JSON files
    {
      name: 'setup-contact',
      testMatch: /contact\.setup\.ts/,
    },
    {
      name: 'setup-customer',
      testMatch: /customer\.setup\.ts/,
    },
    // Anonymous — no auth
    {
      name: 'anonymous',
      testMatch: /anonymous\/.+\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Contact — depends on setup-contact
    {
      name: 'contact',
      testMatch: /contact\/.+\.spec\.ts/,
      dependencies: ['setup-contact'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/storage-state/contact.json',
      },
    },
    // Customer — depends on setup-customer
    {
      name: 'customer',
      testMatch: /customer\/.+\.spec\.ts/,
      dependencies: ['setup-customer'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/storage-state/customer.json',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
