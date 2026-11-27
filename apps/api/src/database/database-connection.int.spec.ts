import { join } from 'node:path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { connectionSettings } from './connection';
import { dataSourceOptions } from './data-source';
import { testDatabaseUrl } from './testing/test-database';

const feature = loadFeature(join(__dirname, 'features/database-connection.feature'));

const TEST_ROLE = 'petfinder_connection_test';

defineFeature(feature, (test) => {
  const target = new URL(testDatabaseUrl());
  let env: Record<string, string | undefined>;
  let db: DataSource | undefined;
  let error: unknown;

  const separateSettings = (username: string, password: string) => ({
    DB_HOST: target.hostname,
    DB_PORT: target.port || '5432',
    DB_NAME: target.pathname.slice(1),
    DB_USERNAME: username,
    DB_PASSWORD: password
  });

  const admin = async <T>(fn: (client: Client) => Promise<T>) => {
    const client = new Client({ connectionString: testDatabaseUrl() });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  };

  beforeEach(() => {
    env = {};
    db = undefined;
    error = undefined;
  });

  afterEach(async () => {
    await db?.destroy();
    await admin((client) => client.query(`drop role if exists ${TEST_ROLE}`));
  });

  const connect = async () => {
    try {
      db = await new DataSource(dataSourceOptions(connectionSettings((key) => env[key]))).initialize();
    } catch (e) {
      error = e;
    }
  };

  const givenSeparateSettings = (given: (text: string, fn: () => void) => void) =>
    given('the database settings are set separately', () => {
      env = separateSettings(decodeURIComponent(target.username), decodeURIComponent(target.password));
    });

  const whenConnecting = (when: (text: string, fn: () => Promise<void>) => void) =>
    when('the api connects to the database', connect);

  const thenQuerySucceeds = (then: (text: RegExp, fn: (sql: string) => Promise<void>) => void) =>
    then(/^the query "(.*)" succeeds$/, async (sql) => {
      expect(error).toBeUndefined();
      await expect(db!.query(sql)).resolves.toBeDefined();
    });

  test('Connect with separate settings', ({ given, when, then }) => {
    givenSeparateSettings(given);
    whenConnecting(when);
    thenQuerySucceeds(then);
  });

  test('A password with URL-unsafe characters', ({ given, and, when, then }) => {
    let password = '';
    given(/^a database user whose password is "(.*)"$/, async (value) => {
      password = value;
      await admin(async (client) => {
        await client.query(`drop role if exists ${TEST_ROLE}`);
        await client.query(`create role ${TEST_ROLE} login password '${password.replace(/'/g, "''")}'`);
      });
    });
    and('the database settings are set separately for that user', () => {
      env = separateSettings(TEST_ROLE, password);
    });
    whenConnecting(when);
    thenQuerySucceeds(then);
  });

  test('TLS is required when DB_SSL is true', ({ given, and, when, then }) => {
    givenSeparateSettings(given);
    and(/^DB_SSL is "(.*)"$/, (value) => {
      env.DB_SSL = value;
    });
    whenConnecting(when);
    then('the connection fails because the server does not support SSL', () => {
      expect(String(error)).toMatch(/does not support SSL/);
    });
  });

  test('Missing settings are reported', ({ given, when, then }) => {
    given('only DB_HOST is set', () => {
      env = { DB_HOST: target.hostname };
    });
    when('the api reads its database settings', () => {
      try {
        connectionSettings((key) => env[key]);
      } catch (e) {
        error = e;
      }
    });
    then(/^it fails naming "(.*)"$/, (names) => {
      expect(String(error)).toContain(names);
    });
  });
});
