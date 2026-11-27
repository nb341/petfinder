import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { getReadyUrl, workspaceRoot } from '@nx/devkit';
import { defineBddConfig } from 'playwright-bdd';

const isCI = !!process.env['CI'];
// For CI, you may want to set BASE_URL to the deployed application.
// getReadyUrl moves the address to the port the dev server task reported.
const baseURL = process.env['BASE_URL'] || getReadyUrl('http://localhost:4200');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
/**
 * BDD: Gherkin features in src/features, step definitions in src/steps.
 * `bddgen` turns them into Playwright tests in .features-gen (git-ignored).
 */
const testDir = defineBddConfig({
  features: 'src/features/**/*.feature',
  steps: 'src/steps/**/*.ts',
});

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir }),
  reporter: [
    ['list'],
    // One video per scenario, grouped by feature: dist/feature-videos/<feature>/<scenario>.webm
    ['./feature-videos-reporter.ts', { outputDir: `${workspaceRoot}/dist/feature-videos` }],
    // Report (with videos per scenario): npx playwright show-report dist/.playwright/apps/ui-e2e/playwright-report
    ['html', { outputFolder: '../../dist/.playwright/apps/ui-e2e/playwright-report', open: 'never' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Record a video of every scenario so each feature can be seen working. */
    video: 'on',
    screenshot: 'on',
  },
  webServer: {
    command: isCI ? 'npx nx run ui:serve-static' : 'npx nx run ui:serve',
    url: getReadyUrl('http://localhost:4200'),
    reuseExistingServer: true,
    cwd: workspaceRoot
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // Add firefox/webkit here to run on more browsers (each records its own videos).

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
