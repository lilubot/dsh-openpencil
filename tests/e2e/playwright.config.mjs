import { defineConfig, devices } from '@playwright/test';

// Browser smoke against the real managed editor: global-setup.mjs boots the
// EditorHostController and the native op-host-web-server daemon from the
// staged npm/<platform>/ runtime, then the browser loads the daemon's page.
// Requires `pnpm run build` and a staged runtime (see the e2e-smoke CI job).
export default defineConfig({
  testDir: '.',
  outputDir: 'out/test-results',
  retries: 0,
  forbidOnly: true,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.mjs/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './global-setup.mjs',
  globalTeardown: './global-teardown.mjs',
});
