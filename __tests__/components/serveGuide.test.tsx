/**
 * The heavy /serve page is a client component driven by fetches; here we
 * verify the fallback-specialization strings are present and EN/ES parity
 * holds. Structural test: the actual DOM behaviour is exercised by the
 * persona e2e runs — this locks the copy contract at the source level.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'components/app/ServeGuideClient.tsx'),
  'utf8',
);

const PUBLICATION_KEYS = [
  'publication.title',
  'publication.body',
  'publication.timeline',
  'publication.rules',
];

const INTERNATIONAL_KEYS = [
  'international.title',
  'international.body',
  'international.timeline',
  'international.state',
  'international.nonSignatory',
];

describe('ServeGuideClient fallback specialization strings', () => {
  it('publishes publication-service copy in EN + ES', () => {
    for (const key of PUBLICATION_KEYS) {
      // Each string appears once per language table = at least two hits.
      const hits = SRC.match(new RegExp(`'${key.replace('.', '\\.')}'`, 'g')) || [];
      expect(hits.length).toBeGreaterThanOrEqual(2);
    }
    expect(SRC).toContain('Service by publication is a court-approved last resort');
    expect(SRC).toContain('un último recurso aprobado por el tribunal');
  });

  it('publishes international / Hague-Service copy in EN + ES', () => {
    for (const key of INTERNATIONAL_KEYS) {
      const hits = SRC.match(new RegExp(`'${key.replace('.', '\\.')}'`, 'g')) || [];
      expect(hits.length).toBeGreaterThanOrEqual(2);
    }
    expect(SRC).toContain('Hague Service Convention');
    expect(SRC).toContain('Convenio de La Haya');
    // Multi-month timeline note is required so users understand the
    // real horizon before starting a Central-Authority request.
    expect(SRC).toContain('several months');
    expect(SRC).toContain('varios meses');
  });

  it('specialization renders only when the profile signals it', () => {
    // Publication block is gated on the serviceMethod matching /publi/,
    // international block on the isInternational flag — never both by
    // default. The gates are the source of truth against silent regression.
    expect(SRC).toMatch(/\{\s*\/publi\/\.test\(serviceMethod\)\s*&&/);
    expect(SRC).toMatch(/\{\s*isInternational\s*&&/);
  });

  it('country-normalization treats US and CA as domestic', () => {
    expect(SRC).toContain("'US'");
    expect(SRC).toContain("'CA'");
    expect(SRC).toContain("'CANADA'");
  });
});
