import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WorkerLifecycle } from './worker-lifecycle';

describe('WorkerLifecycle', () => {
  const startWorker = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [WorkerLifecycle] }).compile();
    await moduleRef.init();
    return moduleRef;
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the process alive until the worker stops', async () => {
    vi.useFakeTimers();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await startWorker();

    expect(vi.getTimerCount()).toBe(1);

    await moduleRef.close('SIGTERM');

    expect(vi.getTimerCount()).toBe(0);
  });

  it('logs the signal when the worker stops', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await startWorker();

    await moduleRef.close('SIGTERM');

    expect(log).toHaveBeenCalledWith('Worker stopped (SIGTERM)');
  });
});
