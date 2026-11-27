import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { connectionSettings } from './connection';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...dataSourceOptions(connectionSettings((key) => config.get<string>(key))),
        migrationsRun: config.get('DB_RUN_MIGRATIONS') === 'true',
      }),
    }),
  ],
})
export class DatabaseModule {}
