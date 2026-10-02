import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4321',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4321/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
