import { readFileSync } from 'node:fs';
import { TlsOptions } from 'node:tls';

export interface ConnectionSettings {
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean | TlsOptions;
}

type Read = (key: string) => string | undefined;

const REQUIRED = ['DB_HOST', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'] as const;

/**
 * DATABASE_URL for local work, or separate DB_* settings on AWS. ECS injects the RDS-managed
 * password as its own value, and it may contain characters a URL would need escaped.
 */
export function connectionSettings(read: Read): ConnectionSettings {
  const ssl = sslSettings(read);
  const url = read('DATABASE_URL');
  if (url) return { url, ssl };

  const missing = REQUIRED.filter((key) => !read(key));
  if (missing.length) {
    throw new Error(`Set DATABASE_URL, or ${REQUIRED.join(', ')}. Missing: ${missing.join(', ')}`);
  }

  const port = Number(read('DB_PORT') ?? 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DB_PORT must be a port number, got "${read('DB_PORT')}"`);
  }

  return {
    host: read('DB_HOST'),
    port,
    database: read('DB_NAME'),
    username: read('DB_USERNAME'),
    password: read('DB_PASSWORD'),
    ssl,
  };
}

function sslSettings(read: Read): ConnectionSettings['ssl'] {
  const value = read('DB_SSL') ?? 'false';
  if (value === 'false') return false;
  if (value !== 'true') throw new Error(`DB_SSL must be "true" or "false", got "${value}"`);

  // RDS certificates chain to Amazon's own roots, which aren't in Node's default trust store.
  const caPath = read('DB_SSL_CA');
  return caPath ? { rejectUnauthorized: true, ca: readFileSync(caPath, 'utf8') } : { rejectUnauthorized: true };
}
