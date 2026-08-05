/** @jest-environment node */

const { checksum, normalizeMigration } = require('../../scripts/migrate');

describe('migration normalization', () => {
  test('removes one outer transaction without touching PL/pgSQL BEGIN blocks', () => {
    const sql = `BEGIN;
CREATE FUNCTION example() RETURNS void AS $$
BEGIN
  RETURN;
END;
$$ LANGUAGE plpgsql;
COMMIT;`;
    const normalized = normalizeMigration(sql, '001_example');
    expect(normalized).not.toMatch(/^BEGIN;/m);
    expect(normalized).not.toMatch(/^COMMIT;/m);
    expect(normalized).toContain('BEGIN\n  RETURN;');
  });

  test('rejects transaction shapes that cannot be made atomic safely', () => {
    expect(() => normalizeMigration('BEGIN;\nSELECT 1;\nCOMMIT;\nBEGIN;\nSELECT 2;\nCOMMIT;', 'bad'))
      .toThrow(/unsupported transaction control/);
    expect(() => normalizeMigration('ROLLBACK;', 'bad')).toThrow(/unsupported transaction control/);
  });

  test('checksum is deterministic and content sensitive', () => {
    expect(checksum('SELECT 1')).toBe(checksum('SELECT 1'));
    expect(checksum('SELECT 1')).not.toBe(checksum('SELECT 2'));
  });
});
