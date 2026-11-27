import { expect } from '@playwright/test';
import { Then, When } from './fixtures';

When('I open the home page', async ({ page }) => {
  await page.goto('/');
});

Then('I see a heading containing {string}', async ({ page }, text: string) => {
  await expect(page.locator('h1')).toContainText(text);
});
