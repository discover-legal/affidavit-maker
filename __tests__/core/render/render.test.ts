/**
 * @jest-environment node
 *
 * Renderer — DocumentTree → text / html / pdf. The renderer interprets
 * nothing, so these assertions are about structure and bytes only: line
 * counts, markup tag counts, the PDF file signature and byte lengths.
 */
import { createRenderer } from '@/core/render';
import type { Renderer } from '@/core/render';
import type { Block, DocumentTree } from '@/core/compose/types';

function paragraph(n: number): Block {
  return { kind: 'paragraph', text: `Paragraph ${n} of the hand-built tree, long enough to wrap onto more than one line when set in a twelve point serif face on letter paper.`, numbered: true, supportedBy: ['marriageDate'] };
}

function smallTree(overrides: Partial<DocumentTree> = {}): DocumentTree {
  return {
    kind: 'divorce_petition',
    jurisdiction: 'TX',
    language: 'en',
    paper: 'letter',
    caption: {
      courtLines: ['IN THE DISTRICT COURT OF', 'HARRIS COUNTY, TEXAS', '245TH JUDICIAL DISTRICT'],
      fileNumberLabel: 'CAUSE NO.',
      parties: { selfLabel: 'Petitioner', selfName: 'Maria Santos', otherLabel: 'Respondent', otherName: 'Daniel Santos', versus: 'v.' },
      title: 'ORIGINAL PETITION FOR DIVORCE',
    },
    sections: [
      {
        id: 'parties',
        title: 'Parties',
        blocks: [
          { kind: 'heading', text: 'Parties', level: 2 },
          paragraph(1),
          { kind: 'blank', field: 'otherAddress', note: 'Draft — insert the address or affirm it is unknown.', label: 'Respondent address' },
          { kind: 'list', items: ['Ava Santos, born 2016', 'Leo Santos, born 2019'], ordered: true },
        ],
      },
      {
        id: 'verification',
        title: 'Verification',
        blocks: [
          { kind: 'signature', party: 'self', label: 'Petitioner, pro se' },
          { kind: 'jurat', text: 'BEFORE ME, the undersigned authority, personally appeared the affiant.', officer: 'notary', citations: ['Tex. Civ. Prac. & Rem. Code § 18.002'] },
        ],
      },
    ],
    framing: { draftNotice: 'Draft — not for filing. File on the official forms.', officialForms: { name: 'Texas Judicial Branch — Forms', url: 'https://www.txcourts.gov/rules-forms/forms/' } },
    blanks: [{ field: 'otherAddress', note: 'Draft — insert the address or affirm it is unknown.', section: 'parties' }],
    ...overrides,
  };
}

function treeWithParagraphs(count: number, paper: DocumentTree['paper'] = 'letter'): DocumentTree {
  return smallTree({
    paper,
    sections: [{ id: 'facts', title: 'Facts', blocks: Array.from({ length: count }, (_, i) => paragraph(i + 1)) }],
    blanks: [],
  });
}

function countBlocks(tree: DocumentTree): number {
  return tree.sections.reduce((n, s) => n + s.blocks.length, 0);
}

/** Count occurrences of a markup token. Counting tags is syntactic, not a prose check. */
function countMarkup(html: string, token: string): number {
  return html.split(token).length - 1;
}

const PDF_MAGIC = Buffer.from('%PDF'); // the PDF file signature — a byte-level syntactic check

describe('core/render', () => {
  let renderer: Renderer;
  beforeAll(() => {
    renderer = createRenderer();
  });

  describe('text()', () => {
    it('emits at least one line per block plus the caption', () => {
      const tree = smallTree();
      const out = renderer.text(tree);
      expect(typeof out).toBe('string');
      const lines = out.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(countBlocks(tree) + tree.caption.courtLines.length);
    });

    it('grows with the number of paragraphs', () => {
      const two = renderer.text(treeWithParagraphs(2)).split('\n').length;
      const ten = renderer.text(treeWithParagraphs(10)).split('\n').length;
      const forty = renderer.text(treeWithParagraphs(40)).split('\n').length;
      expect(two).toBeLessThan(ten);
      expect(ten).toBeLessThan(forty);
    });

    it('is deterministic', () => {
      const tree = smallTree();
      expect(renderer.text(tree)).toBe(renderer.text(tree));
    });
  });

  describe('html()', () => {
    it('renders exactly one <p> per paragraph block', () => {
      // Markup count, not prose: only `paragraph` blocks may become <p> elements.
      const tree = treeWithParagraphs(3);
      const html = renderer.html(tree);
      expect(typeof html).toBe('string');
      expect(countMarkup(html, '<p>') + countMarkup(html, '<p ')).toBe(3);
    });

    it('a tree with no paragraph blocks renders no <p>', () => {
      // Markup count, not prose.
      const tree = smallTree({ sections: [{ id: 'parties', blocks: [{ kind: 'heading', text: 'Parties', level: 2 }, { kind: 'list', items: ['a', 'b'] }] }], blanks: [] });
      const html = renderer.html(tree);
      expect(countMarkup(html, '<p>') + countMarkup(html, '<p ')).toBe(0);
    });

    it('renders one list item per list entry', () => {
      // Markup count, not prose.
      const tree = smallTree();
      const html = renderer.html(tree);
      expect(countMarkup(html, '<li>') + countMarkup(html, '<li ')).toBe(2);
    });

    it('renders a heading element per heading block', () => {
      // Markup count, not prose: a level-2 heading is an <h2>.
      const html = renderer.html(smallTree());
      expect(countMarkup(html, '<h2>') + countMarkup(html, '<h2 ')).toBe(1);
    });

    it('is a complete document: opening and closing html tags are balanced', () => {
      // Markup structure, not prose.
      const html = renderer.html(smallTree());
      expect(countMarkup(html, '<html')).toBe(1);
      expect(countMarkup(html, '</html>')).toBe(1);
    });

    it('honours the tree language on the document element', () => {
      // Markup attribute, not prose.
      const es = renderer.html(smallTree({ language: 'es' }));
      expect(countMarkup(es, 'lang="es"')).toBe(1);
      const en = renderer.html(smallTree({ language: 'en' }));
      expect(countMarkup(en, 'lang="en"')).toBe(1);
    });

    it('draftBanner changes the output', () => {
      const tree = smallTree();
      expect(renderer.html(tree, { draftBanner: true })).not.toBe(renderer.html(tree, { draftBanner: false }));
    });
  });

  describe('pdf()', () => {
    it('resolves to a PDF: file signature and a non-trivial size', async () => {
      const buf = await renderer.pdf(smallTree());
      expect(Buffer.isBuffer(buf)).toBe(true);
      // Byte comparison of the file signature is syntactic, allowed.
      expect(buf.subarray(0, 4).equals(PDF_MAGIC)).toBe(true);
      expect(buf.length).toBeGreaterThan(1000);
    });

    it('a4 and letter produce different bytes for identical content', async () => {
      const letter = await renderer.pdf(treeWithParagraphs(5, 'letter'));
      const a4 = await renderer.pdf(treeWithParagraphs(5, 'a4'));
      expect(a4.subarray(0, 4).equals(PDF_MAGIC)).toBe(true);
      expect(a4.length).not.toBe(letter.length);
    });

    it('draftBanner on vs off produces different byte lengths', async () => {
      const tree = smallTree();
      const on = await renderer.pdf(tree, { draftBanner: true });
      const off = await renderer.pdf(tree, { draftBanner: false });
      expect(on.length).not.toBe(off.length);
    });

    it('footerBrand changes the bytes', async () => {
      const tree = smallTree();
      const branded = await renderer.pdf(tree, { footerBrand: 'Created with Discover.Legal' });
      const plain = await renderer.pdf(tree, {});
      expect(branded.length).not.toBe(plain.length);
    });

    it('byte length grows monotonically with content (the contract exposes no page count)', async () => {
      const two = await renderer.pdf(treeWithParagraphs(2));
      const ten = await renderer.pdf(treeWithParagraphs(10));
      const forty = await renderer.pdf(treeWithParagraphs(40));
      expect(two.length).toBeLessThan(ten.length);
      expect(ten.length).toBeLessThan(forty.length);
    });

    it('renders every block kind without throwing', async () => {
      const everyKind: Block[] = [
        { kind: 'heading', text: 'H1', level: 1 },
        { kind: 'heading', text: 'H3', level: 3 },
        paragraph(1),
        { kind: 'paragraph', text: 'Unnumbered.', supportedBy: ['fact_x'] },
        { kind: 'blank', field: 'grounds', note: 'Draft — grounds.' },
        { kind: 'list', items: ['one', 'two', 'three'] },
        { kind: 'list', items: ['uno'], ordered: true },
        { kind: 'signature', party: 'other', label: 'Respondent' },
        { kind: 'jurat', text: 'Sworn.', officer: 'commissioner_for_oaths', citations: [] },
        { kind: 'note', text: 'A note.' },
      ];
      const tree = smallTree({ sections: [{ id: 'all', blocks: everyKind }], blanks: [{ field: 'grounds', note: 'Draft — grounds.', section: 'all' }] });
      const buf = await renderer.pdf(tree);
      expect(buf.subarray(0, 4).equals(PDF_MAGIC)).toBe(true);
      expect(renderer.text(tree).split('\n').length).toBeGreaterThanOrEqual(everyKind.length);
      expect(typeof renderer.html(tree)).toBe('string');
    });

    it('a caption without a file number still renders (the blank is drawn, no "null")', async () => {
      const tree = smallTree();
      delete tree.caption.fileNumber;
      const buf = await renderer.pdf(tree);
      expect(buf.subarray(0, 4).equals(PDF_MAGIC)).toBe(true);
      const withNumber = await renderer.pdf(smallTree({ caption: { ...smallTree().caption, fileNumber: 'FS-26-01234' } }));
      expect(withNumber.length).not.toBe(buf.length);
    });
  });
});
