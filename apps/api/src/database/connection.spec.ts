import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectionSettings } from './connection';

const from = (env: Record<string, string>) => connectionSettings((key) => env[key]);

const separate = {
  DB_HOST: 'db.internal',
  DB_NAME: 'petfinder',
  DB_USERNAME: 'petfinder',
  DB_PASSWORD: 'p@ss:w/rd#?%1',
};

describe('connectionSettings', () => {
  it('uses DATABASE_URL when it is set', () => {
    expect(from({ ...separate, DATABASE_URL: 'postgresql://u:p@localhost:5432/petfinder' })).toEqual({
      url: 'postgresql://u:p@localhost:5432/petfinder',
      ssl: false,
    });
  });

  it('passes separate settings through without encoding the password', () => {
    expect(from({ ...separate, DB_PORT: '6543' })).toEqual({
      host: 'db.internal',
      port: 6543,
      database: 'petfinder',
      username: 'petfinder',
      password: 'p@ss:w/rd#?%1',
      ssl: false,
    });
  });

  it('defaults the port to 5432', () => {
    expect(from(separate)).toMatchObject({ port: 5432 });
  });

  it('names every missing setting', () => {
    expect(() => from({ DB_HOST: 'db.internal' })).toThrow('DB_NAME, DB_USERNAME, DB_PASSWORD');
  });

  it('rejects a port that is not a number in range', () => {
    expect(() => from({ ...separate, DB_PORT: 'abc' })).toThrow('DB_PORT');
    expect(() => from({ ...separate, DB_PORT: '70000' })).toThrow('DB_PORT');
  });

  it('verifies the server certificate when DB_SSL is true', () => {
    expect(from({ ...separate, DB_SSL: 'true' })).toMatchObject({ ssl: { rejectUnauthorized: true } });
  });

  it('trusts the CA bundle named by DB_SSL_CA', () => {
    const ca = join(mkdtempSync(join(tmpdir(), 'ca-')), 'bundle.pem');
    writeFileSync(ca, '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n');
    expect(from({ ...separate, DB_SSL: 'true', DB_SSL_CA: ca })).toMatchObject({
      ssl: { rejectUnauthorized: true, ca: expect.stringContaining('BEGIN CERTIFICATE') },
    });
  });

  it('rejects a DB_SSL value other than true or false', () => {
    expect(() => from({ ...separate, DB_SSL: 'yes' })).toThrow('DB_SSL');
  });
});
