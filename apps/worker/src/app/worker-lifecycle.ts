import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class WorkerLifecycle implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerLifecycle.name);
  // An application context has no server, so without an active handle Node exits right after bootstrap.
  private keepAlive?: NodeJS.Timeout;

  onApplicationBootstrap() {
    this.keepAlive = setInterval(() => undefined, 2 ** 30);
  }

  onApplicationShutdown(signal?: string) {
    clearInterval(this.keepAlive);
    this.logger.log(`Worker stopped (${signal})`);
  }
}
