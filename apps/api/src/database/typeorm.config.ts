// Entry point for the TypeORM CLI (migration:generate/run/revert); the api uses DatabaseModule instead.
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

process.loadEnvFile?.('.env');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export default new DataSource(dataSourceOptions(url));
