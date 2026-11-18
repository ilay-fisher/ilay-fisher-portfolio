import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 5173);
const ci = !!process.env.CI;
/** `E2E_PREVIEW=1` runs against `vite preview` of `dist/` locally too (always on CI). Needs `npm run build` first. */
const preview = ci || !!process.env.E2E_PREVIEW;

/** Specs whose title carries this tag run seconds of real WebGL work or depend on real smooth-scroll timing. */
const HEAVY = /@gl-heavy/;

const launchOptions = {
  // Software GL for Linux CI runners. On macOS WebGL2 works without flags (research
  // ANIMATIONS.md section 10), and these flags are harmless there.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

/**
 * Two projects. `default` holds the ordinary specs and runs in parallel. `gl-heavy` holds everything that does seconds
 * of real WebGL work, or whose subject is real-time smooth scrolling; it must run alone so it never starves anything
 * (and is never starved). Playwright's worker count is global, so `scripts/e2e.mjs` (npm run e2e, and CI) runs the two
 * projects one after the other, the second with `--workers=1`.
 *
 * Locally the e2e runs against the Vite dev server; on CI against `vite preview` of the production build. Retries are
 * CI-only (one), the trace is kept on the first retry, and scripts/e2e-summary.mjs lists every test that needed one.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: ci
    ? [
        ['list'],
        ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? 'e2e-results.json' }],
      ]
    : [['list'], ['html', { open: 'never' }]],
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 3 : undefined,
  // Software GL is slow: a generous per-test budget, assertions still fail at their own timeout.
  timeout: ci ? 90_000 : 60_000,
  expect: { timeout: ci ? 15_000 : 10_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: ci ? 'on-first-retry' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'default',
      grepInvert: HEAVY,
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
    {
      name: 'gl-heavy',
      grep: HEAVY,
      fullyParallel: false,
      timeout: ci ? 150_000 : 90_000,
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
  ],
  webServer: {
    command: preview
      ? `npm run preview -- --port ${port} --strictPort`
      : `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !ci,
    timeout: 60_000,
  },
});
