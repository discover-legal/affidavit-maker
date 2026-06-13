/**
 * @jest-environment node
 */
import { renderTemplate, formatAnswer } from '@/lib/marketplace/renderTemplate';
import type { TemplateConfig } from '@discover-legal/sdk';

const config: TemplateConfig = {
  questions: [
    { id: 'fullName', label: 'Full name', type: 'text', required: true },
    { id: 'agree', label: 'Do you agree?', type: 'boolean' },
    { id: 'state', label: 'State', type: 'select', options: ['TX', 'CA'] },
    { id: 'notes', label: 'Notes', type: 'textarea' },
  ],
  body: 'I, {{fullName}}, residing in {{ state }}, agree: {{agree}}.\nNotes: {{notes}}',
};

describe('formatAnswer', () => {
  it('renders booleans as Yes/No', () => {
    expect(formatAnswer({ id: 'a', label: '', type: 'boolean' }, true)).toBe('Yes');
    expect(formatAnswer({ id: 'a', label: '', type: 'boolean' }, false)).toBe('No');
  });
  it('stringifies text/number/date/select', () => {
    expect(formatAnswer({ id: 'a', label: '', type: 'number' }, 42)).toBe('42');
    expect(formatAnswer({ id: 'a', label: '', type: 'text' }, 'hi')).toBe('hi');
  });
  it('returns empty string for missing values', () => {
    expect(formatAnswer({ id: 'a', label: '', type: 'text' }, undefined)).toBe('');
  });
});

describe('renderTemplate', () => {
  it('substitutes placeholders, including whitespace variants', () => {
    const { document } = renderTemplate(config, {
      fullName: 'Jane Doe',
      state: 'TX',
      agree: true,
      notes: 'n/a',
    });
    expect(document).toContain('I, Jane Doe, residing in TX, agree: Yes.');
    expect(document).toContain('Notes: n/a');
    expect(document).not.toMatch(/\{\{/); // all placeholders resolved
  });

  it('flags unanswered required questions', () => {
    const { missingRequired } = renderTemplate(config, { state: 'TX' });
    expect(missingRequired).toContain('fullName');
  });

  it('does not flag optional unanswered questions', () => {
    const { missingRequired } = renderTemplate(config, { fullName: 'Jane' });
    expect(missingRequired).toEqual([]); // only fullName was required, and it is present
  });

  it('leaves a labeled blank for an unanswered placeholder', () => {
    const { document } = renderTemplate(config, { fullName: 'Jane', state: 'TX', agree: false });
    // notes unanswered -> blank, not literal {{notes}}
    expect(document).toContain('Notes: ');
    expect(document).not.toContain('{{notes}}');
  });

  it('falls back to a Q&A document when no body is authored', () => {
    const noBody: TemplateConfig = { questions: config.questions };
    const { document } = renderTemplate(noBody, { fullName: 'Jane', agree: false });
    expect(document).toMatch(/Full name:\s*Jane/);
    expect(document).toMatch(/Do you agree\?:\s*No/);
  });

  it('ignores placeholders that reference unknown ids (renders blank, no crash)', () => {
    const cfg: TemplateConfig = { questions: [], body: 'Hello {{ghost}}!' };
    const { document } = renderTemplate(cfg, {});
    expect(document).toBe('Hello !');
  });
});
