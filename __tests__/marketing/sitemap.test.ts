import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { ARTICLES } from '@/lib/content/articles';

describe('marketing sitemap', () => {
  const entries = sitemap();

  it('includes the static marketing routes', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://discover.legal/',
        'https://discover.legal/services',
        'https://discover.legal/tools/documents',
        'https://discover.legal/tools/biglaw',
        'https://discover.legal/research',
        'https://discover.legal/resources',
        'https://discover.legal/privacy',
        'https://discover.legal/tos',
        'https://discover.legal/brand',
      ]),
    );
  });

  it('includes every article slug', () => {
    const urls = entries.map((e) => e.url);
    for (const article of ARTICLES) {
      expect(urls).toContain(`https://discover.legal/resources/${article.slug}`);
    }
  });

  it('canonicalizes everything to the apex (no make/www)', () => {
    for (const entry of entries) {
      expect(entry.url.startsWith('https://discover.legal/')).toBe(true);
    }
  });
});

describe('robots.txt', () => {
  const value = robots();

  it('points sitemap at the apex', () => {
    expect(value.sitemap).toBe('https://discover.legal/sitemap.xml');
    expect(value.host).toBe('https://discover.legal');
  });

  it('disallows authenticated routes', () => {
    const rules = Array.isArray(value.rules) ? value.rules : [value.rules];
    const wildcard = rules.find((r) => r.userAgent === '*');
    expect(wildcard).toBeDefined();
    const disallow = Array.isArray(wildcard!.disallow)
      ? wildcard!.disallow
      : [wildcard!.disallow ?? ''];
    expect(disallow).toEqual(
      expect.arrayContaining(['/api/', '/dashboard', '/editor/', '/payment-success']),
    );
  });
});
