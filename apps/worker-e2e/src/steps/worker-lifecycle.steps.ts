import { defineFeature, loadFeature } from 'jest-cucumber';
import { join } from 'node:path';
import { WorkerProcess } from '../support/worker-process';

const feature = loadFeature(join(__dirname, '../features/worker-lifecycle.feature'));

defineFeature(feature, (test) => {
  let worker: WorkerProcess | undefined;

  afterEach(async () => {
    await worker?.stop();
    worker = undefined;
  });

  test('The worker starts', ({ when, then }) => {
    when('I start the worker', () => {
      worker = new WorkerProcess();
    });

    then(/^it logs "(.*)" within (\d+) seconds$/, async (text: string, seconds: string) => {
      await worker!.waitForLog(text, Number(seconds) * 1000);
    });
  });

  test('The worker shuts down gracefully', ({ given, when, then, and }) => {
    given('the worker is running', async () => {
      worker = new WorkerProcess();
      await worker.waitForLog('Worker started', 10_000);
    });

    when(/^it receives (SIG\w+)$/, (signal: NodeJS.Signals) => {
      worker!.signal(signal);
    });

    then(/^it logs "(.*)"$/, async (text: string) => {
      await worker!.waitForLog(text, 10_000);
    });

    and(/^it exits within (\d+) seconds$/, async (seconds: string) => {
      await worker!.waitForExit(Number(seconds) * 1000);
    });
  });
});
