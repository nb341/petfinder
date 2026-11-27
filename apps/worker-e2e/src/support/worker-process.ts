import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';

const workerMain = join(__dirname, '../../../../dist/apps/worker/main.js');

export interface WorkerExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export class WorkerProcess {
  private output = '';
  private readonly child: ChildProcess;
  private readonly exited: Promise<WorkerExit>;

  constructor() {
    this.child = spawn(process.execPath, [workerMain], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.child.stdout?.on('data', (chunk) => (this.output += chunk));
    this.child.stderr?.on('data', (chunk) => (this.output += chunk));
    this.exited = once(this.child, 'exit').then(([code, signal]) => ({ code, signal }));
  }

  get logs(): string {
    return this.output;
  }

  async waitForLog(text: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!this.output.includes(text)) {
      if (Date.now() > deadline) {
        throw new Error(`"${text}" not logged within ${timeoutMs}ms. Output:\n${this.output}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  waitForExit(timeoutMs: number): Promise<WorkerExit> {
    return Promise.race([
      this.exited,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Worker did not exit within ${timeoutMs}ms`)), timeoutMs).unref(),
      ),
    ]);
  }

  signal(signal: NodeJS.Signals): void {
    this.child.kill(signal);
  }

  async stop(): Promise<void> {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill('SIGKILL');
      await this.exited;
    }
  }
}
