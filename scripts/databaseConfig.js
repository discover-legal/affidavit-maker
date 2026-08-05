'use strict';

function databasePoolConfig() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const config = { connectionString: process.env.DATABASE_URL };
  if (process.env.NODE_ENV !== 'production') return config;

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n');
  if (!ca || !ca.includes('BEGIN CERTIFICATE')) {
    throw new Error('DATABASE_CA_CERT containing the trusted PostgreSQL CA is required');
  }
  return {
    ...config,
    ssl: { rejectUnauthorized: true, ca },
  };
}

module.exports = { databasePoolConfig };
