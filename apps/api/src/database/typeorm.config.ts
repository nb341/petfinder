// Entry point for the TypeORM CLI (migration:generate/run/revert); the api uses DatabaseModule instead.
import { DataSource } from 'typeorm';
import { connectionSettings } from './connection';
import { dataSourceOptions } from './data-source';

process.loadEnvFile?.('.env');

export default new DataSource(dataSourceOptions(connectionSettings((key) => process.env[key])));
