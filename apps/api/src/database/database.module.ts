import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...dataSourceOptions(config.getOrThrow<string>('DATABASE_URL')),
        migrationsRun: config.get('DB_RUN_MIGRATIONS') === 'true',
      }),
    }),
  ],
})
export class DatabaseModule {}
