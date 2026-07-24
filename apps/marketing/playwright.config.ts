import { defineConfig, devices } from '@playwright/test';

/**
 * Perf-measurement E2E config (plan 063 Step 6, opt-in via `test:e2e:perf`).
 *
 * - Measures against a PRODUCTION build: the `test:e2e:perf` script runs
 *   `next build` first, and the webServer below is `next start` — dev-mode
 *   numbers are meaningless.
 * - Chromium only (CDP CPU throttling + event timing are Chromium features).
 *   The `.e2e.ts` suffix keeps these files OUT of `bun test`'s glob (which
 *   would otherwise pick up `.spec.`/`.test.` names in CI's marketing job).
 * - One worker, no parallelism, no retries: parallel load on the same
 *   server would contaminate latency samples.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3000',
    // Environments that pre-install a Chromium outside Playwright's registry
    // can point at it explicitly (e.g. PW_CHROMIUM=/opt/pw-browsers/chromium).
    ...(process.env.PW_CHROMIUM
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } }
      : {}),
  },
  webServer: {
    command: 'bun run start',
    url: 'http://127.0.0.1:3000',
    // Never reuse an already-running server: this harness measures the
    // PRODUCTION build (`test:e2e:perf` runs `next build` first), and reusing
    // a stray `next dev` or a stale `next start` would silently produce
    // invalid latency baselines. Always launch a fresh `next start`.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
