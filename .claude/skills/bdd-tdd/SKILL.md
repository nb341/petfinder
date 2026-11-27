---
name: bdd-tdd
description: Behavior-driven and test-driven development workflow for petfinder. Use whenever implementing a feature, user story, endpoint, page, or bug fix in apps/ui or apps/api, or when the user mentions BDD, TDD, Gherkin, .feature files, step definitions, acceptance tests, red-green-refactor, or "test first".
---

# BDD + TDD Workflow

All behavior in petfinder is built **outside-in**:

1. A Gherkin **feature** describes the behavior.
2. That feature runs as an **acceptance test**.
3. **Unit tests** drive the implementation through red, green, refactor.

Never write production code without a failing test that requires it.

## The Loop

```
1. Write the .feature file          (BDD: agree on behavior)
2. Run it → RED (steps undefined)    nx e2e ui-e2e / nx e2e api-e2e
3. Write step definitions → RED      (fails for the right reason: feature missing)
4. Inner TDD loop, per unit:
     a. Write a failing unit test    nx test api / nx test ui → RED
     b. Write minimal code to pass   → GREEN
     c. Refactor, keep tests green   → REFACTOR
5. Re-run acceptance test → GREEN
6. Review the feature video          dist/feature-videos/<feature>/ (ui only)
7. Refactor across layers, run everything: npx nx affected -t lint test e2e
```

**Show each phase.** For every acceptance test and unit test, run it and confirm it fails before you write the code. A test that has never failed proves nothing. Report RED → GREEN in your summary.

## Where Things Live

| Layer | Feature files | Step definitions | Runner | Run |
| --- | --- | --- | --- | --- |
| UI acceptance | `apps/ui-e2e/src/features/*.feature` | `apps/ui-e2e/src/steps/*.steps.ts` | playwright-bdd | `npx nx e2e ui-e2e` |
| API acceptance | `apps/api-e2e/src/features/*.feature` | `apps/api-e2e/src/steps/*.steps.ts` | jest-cucumber | `npx nx e2e api-e2e` |
| UI unit | n/a | `apps/ui/src/**/*.spec.ts` | Vitest | `npx nx test ui` |
| API ↔ database | `apps/api/src/database/features/*.feature` | `apps/api/src/**/*.int.spec.ts` | jest-cucumber on Vitest, real Postgres | `npx nx test-integration api` |
| API unit | n/a | `apps/api/src/**/*.spec.ts` | Vitest | `npx nx test api` |
| Shared lib unit | n/a | `libs/shared/models/src/**/*.spec.ts` | Jest | `npx nx test models` |

## UI Features (playwright-bdd)

- Import `Given`, `When` and `Then` from `apps/ui-e2e/src/steps/fixtures.ts`. Add page objects and custom fixtures there with `test.extend(...)`.
- Step text uses Cucumber expressions, for example `{string}`, `{int}` or `{word}`.
- `nx e2e ui-e2e` runs `bddgen` first. It generates Playwright specs into `.features-gen/`, which is git-ignored. Never edit those files.
- Steps are matched globally. Reuse existing steps before you write new ones. To find undefined steps, run `npx bddgen` in `apps/ui-e2e`, which prints snippets for missing steps.
- Prefer user-facing locators: `getByRole`, `getByLabel` and `getByText`.

```ts
import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

When('I search for {string}', async ({ page }, term: string) => {
  await page.getByRole('searchbox').fill(term);
  await page.getByRole('button', { name: 'Search' }).click();
});
```

### Videos

Every UI scenario is recorded (`video: 'on'`). After a run:
- **Per feature:** `dist/feature-videos/<feature>/<scenario> [<browser>].webm`
- **HTML report**, with a video, screenshots and steps for each scenario: `npx playwright show-report dist/.playwright/apps/ui-e2e/playwright-report`

When you finish a UI feature, run its e2e tests. In the summary and the PR "How to test" section, give the path to its video folder.

## API Features (jest-cucumber)

- Each `*.steps.ts` loads its own feature with `loadFeature(join(__dirname, '../features/<name>.feature'))`.
- `defineFeature` must cover **every** scenario in the file, and each `test(...)` must define **every** step, in order. jest-cucumber fails on any mismatch, and that failure is your first RED.
- Use regexes for parameters, for example `/^I send GET "(.*)"$/`.
- For error scenarios, pass `validateStatus: () => true` to axios so non-2xx responses can be asserted.
- `nx e2e api-e2e` builds and serves the api automatically.

## Unit TDD Rules

- Test one behavior per `it(...)`. Name the test after the behavior, for example `it('rejects an adoption request for an adopted pet')`, not after the method.
- Test through public interfaces such as NestJS services and controllers or Angular components. Don't test private internals.
- For NestJS, use `Test.createTestingModule` and replace external dependencies such as the DB and HTTP with fakes.
- For Angular, use `TestBed` and component harnesses or DOM queries, and stub HTTP with `provideHttpClientTesting`.
- Write the minimal code to go green. Don't write code that no current test needs.
- For a bug fix, first write a test that reproduces the bug and watch it fail. Then fix the bug.

## Done Means

- [ ] A `.feature` file describes the behavior, with happy, edge and error scenarios
- [ ] Every acceptance test passes: `npx nx e2e ui-e2e` / `npx nx e2e api-e2e`
- [ ] New logic has unit tests, and you saw each one fail first
- [ ] `npx nx affected -t lint test e2e` is green
- [ ] UI features have a recorded video in `dist/feature-videos/`
- [ ] The PR's Gherkin acceptance criteria match the `.feature` files
