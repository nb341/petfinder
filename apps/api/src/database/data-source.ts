import { DataSourceOptions } from 'typeorm';
import { ConnectionSettings } from './connection';
import { entities } from './entities';
import { migrations } from './migrations';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export const dataSourceOptions = (connection: ConnectionSettings): DataSourceOptions => ({
  type: 'postgres',
  ...connection,
  // gen_random_uuid() is built into Postgres 13+, so no uuid-ossp extension is needed.
  uuidExtension: 'pgcrypto',
  installExtensions: false,
  entities,
  migrations,
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
});
