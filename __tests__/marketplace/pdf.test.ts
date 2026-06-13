/**
 * @jest-environment node
 */
import { renderDocumentPdf } from '@/lib/marketplace/pdf';

describe('renderDocumentPdf', () => {
  it('produces a valid PDF buffer', async () => {
    const pdf = await renderDocumentPdf({
      title: 'Affidavit of Jane Doe',
      body: 'I, Jane Doe, state the following:\n\nParagraph one.\n\nParagraph two.',
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
    // PDF magic number
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('handles an empty body without throwing', async () => {
    const pdf = await renderDocumentPdf({ title: 'Empty', body: '' });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
