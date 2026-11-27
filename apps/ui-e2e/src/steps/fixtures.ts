import { test as base, createBdd } from 'playwright-bdd';

// Extend `base` with custom fixtures (page objects, test data, etc.) as needed.
export const test = base;

export const { Given, When, Then } = createBdd(test);
