/** @jest-environment node */

import { resolveDatabaseSsl } from '@/lib/db';
const { resolveMigrationSsl } = require('../../scripts/databaseSsl');

describe('production database TLS trust', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    delete process.env.DATABASE_CA_CERT;
    delete process.env.DATABASE_CERT_SHA256;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fails closed without an out-of-band trust anchor', async () => {
    await expect(resolveDatabaseSsl()).rejects.toThrow(
      'Production requires DATABASE_CA_CERT or DATABASE_CERT_SHA256',
    );
  });

  it('accepts an escaped-newline PEM and enables verification', async () => {
    process.env.DATABASE_CA_CERT =
      '-----BEGIN CERTIFICATE-----\\nZmFrZQ==\\n-----END CERTIFICATE-----';
    await expect(resolveDatabaseSsl()).resolves.toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----',
    });
  });

  it('rejects a malformed CA value', async () => {
    process.env.DATABASE_CA_CERT = 'not-a-pem';
    await expect(resolveDatabaseSsl()).rejects.toThrow('must contain one or more PEM certificates');
  });

  it('applies the same fail-closed trust policy to predeploy migrations', async () => {
    await expect(resolveMigrationSsl({ NODE_ENV: 'production' })).rejects.toThrow(
      'Production migrations require DATABASE_CA_CERT or DATABASE_CERT_SHA256',
    );
    await expect(resolveMigrationSsl({
      NODE_ENV: 'production',
      DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\\nZmFrZQ==\\n-----END CERTIFICATE-----',
    })).resolves.toMatchObject({ rejectUnauthorized: true });
  });
});
