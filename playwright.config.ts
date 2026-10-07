import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const database = join(mkdtempSync(join(tmpdir(), 'turno-e2e-')), 'db.sqlite');
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:4322/api/health',
    reuseExistingServer: false,
    env: {
      DATABASE_PATH: database,
      APP_ORIGIN: 'http://127.0.0.1:4322',
      WHATSAPP_ENABLED: 'false',
      HOST: '127.0.0.1',
      PORT: '4322',
      NODE_ENV: 'production',
    },
  },
});
