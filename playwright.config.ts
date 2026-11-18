import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 5173);
const ci = !!process.env.CI;
/** Set (CI, gl-heavy step) to also start a Vite dev server: `glstage.spec.ts` imports a source module directly. */
const devPort = process.env.E2E_DEV_PORT ? Number(process.env.E2E_DEV_PORT) : null;

/** Tests whose title carries this tag run real WebGL work for seconds. They run alone, after everything else. */
const HEAVY = /@gl-heavy/;

const launchOptions = {
  // Software GL for Linux CI runners. On macOS WebGL2 works without flags (research
  // ANIMATIONS.md section 10), and these flags are harmless there.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

/**
 * Locally the e2e runs against the Vite dev server. On CI it runs against `vite preview` of the production build
 * (`npm run build` first), which is what ships and loads in a fraction of the time. CI runs two invocations:
 * `--project=default` in parallel, then `--project=gl-heavy --workers=1` (Playwright's worker count is global, so
 * serial execution of one project needs its own run). Retries are CI-only and reported by scripts/e2e-summary.mjs.
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
  webServer: [
    {
      command: ci
        ? `npm run preview -- --port ${port} --strictPort`
        : `npm run dev -- --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !ci,
      timeout: 60_000,
    },
    ...(ci && devPort
      ? [
          {
            command: `npm run dev -- --port ${devPort} --strictPort`,
            url: `http://localhost:${devPort}`,
            reuseExistingServer: false,
            timeout: 60_000,
          },
        ]
      : []),
  ],
});
