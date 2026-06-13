/**
 * @jest-environment node
 */
import { serializeTemplate, type TemplateRow } from '@/lib/marketplace/serialize';

const baseRow: TemplateRow = {
  id: 1,
  slug: 'simple-affidavit-tx',
  title: 'Simple Affidavit (TX)',
  short_description: 'A general-purpose Texas affidavit',
  description: 'Full description',
  matter_type: 'affidavit',
  practice_area: 'civil',
  jurisdictions: ['TX'],
  price_cents: 100,
  cover_image_url: null,
  tags: ['affidavit', 'texas'],
  estimated_minutes: 10,
  difficulty_level: 'basic',
  total_purchases: 42,
  // pg returns NUMERIC as a string
  avg_rating: '4.70',
  rating_count: 12,
  published_at: new Date('2026-06-01T00:00:00.000Z'),
  lawyer_id: 7,
  lawyer_name: 'Jane Counsel',
};

describe('serializeTemplate', () => {
  it('maps snake_case row columns to the camelCase DTO', () => {
    const dto = serializeTemplate(baseRow);
    expect(dto).toMatchObject({
      id: 1,
      slug: 'simple-affidavit-tx',
      title: 'Simple Affidavit (TX)',
      shortDescription: 'A general-purpose Texas affidavit',
      matterType: 'affidavit',
      practiceArea: 'civil',
      jurisdictions: ['TX'],
      priceCents: 100,
      tags: ['affidavit', 'texas'],
      estimatedMinutes: 10,
      difficultyLevel: 'basic',
      totalPurchases: 42,
      ratingCount: 12,
    });
  });

  it('coerces the NUMERIC avg_rating string to a number', () => {
    expect(serializeTemplate(baseRow).avgRating).toBe(4.7);
  });

  it('renders published_at as an ISO string', () => {
    expect(serializeTemplate(baseRow).publishedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('passes through a null published_at', () => {
    expect(serializeTemplate({ ...baseRow, published_at: null }).publishedAt).toBeNull();
  });

  it('builds a lawyer summary, or null when unjoined', () => {
    expect(serializeTemplate(baseRow).lawyer).toEqual({ id: 7, displayName: 'Jane Counsel' });
    expect(serializeTemplate({ ...baseRow, lawyer_id: null, lawyer_name: null }).lawyer).toBeNull();
  });

  it('never leaks template_config or internal-only columns', () => {
    const dto = serializeTemplate(baseRow) as unknown as Record<string, unknown>;
    expect(dto).not.toHaveProperty('template_config');
    expect(dto).not.toHaveProperty('total_revenue_cents');
    expect(dto).not.toHaveProperty('search_vector');
    expect(dto).not.toHaveProperty('deleted_at');
  });
});
