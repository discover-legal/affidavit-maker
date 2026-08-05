import { ARTICLES } from '@/lib/content/articles';
import { sanitizeArticlePromotions } from '@/lib/content/sanitizeArticle';

describe('resource article product claims', () => {
  it('removes historical branded promotion sections from every article', () => {
    for (const article of ARTICLES) {
      const rendered = sanitizeArticlePromotions(article.content);
      expect(rendered).not.toMatch(
        /## (?:How [^\n]*discover\.legal|discover\.legal (?:for|makes)|Where this site fits|Ready to (?:Create|Start|Prepare))/i,
      );
      expect(rendered).not.toContain('](#cta)');
      expect(rendered).not.toMatch(/legally valid affidavit in minutes/i);
      expect(rendered).not.toMatch(/generates? (?:the )?.*supporting documents/i);
    }
  });

  it('replaces alternate historical headings with the launch scope', () => {
    const content = `Intro

## discover.legal for Ontario

We generate every supporting form.

## Next section

Educational text.`;
    const rendered = sanitizeArticlePromotions(content);
    expect(rendered).toContain('petition and proposed decree draft');
    expect(rendered).not.toContain('every supporting form');
    expect(rendered).toContain('## Next section');
  });
});
