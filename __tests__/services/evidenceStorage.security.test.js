/** @jest-environment node */
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');

const storage = require('../../services/evidenceStorage');

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe('EvidenceStorage security boundaries', () => {
  let root;
  let originalBasePath;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-security-'));
    originalBasePath = storage.basePath;
    storage.basePath = path.join(root, 'evidence');
    await fs.mkdir(storage.basePath, { recursive: true });
  });

  afterEach(async () => {
    storage.basePath = originalBasePath;
    await fs.rm(root, { recursive: true, force: true });
  });

  test('uses detected content type for the stored extension', async () => {
    const staged = path.join(root, 'staged.bin');
    await fs.writeFile(staged, pngHeader(100, 100));

    const result = await storage.uploadEvidence(
      { path: staged, originalname: 'misleading.pdf', mimetype: 'application/pdf' },
      17,
      42,
      'proof'
    );

    expect(result.fileKey.replace(/\\/g, '/')).toBe('17/42/proof.png');
    expect(result.fileType).toBe('png');
    expect(result.thumbnailKey).toBeNull();
    const listed = await storage.listEvidenceForDocument(17, 42);
    expect(listed.map(item => item.filename)).toEqual(['proof.png']);
  });

  test('rejects a compressed image header with unsafe dimensions and cleans it up', async () => {
    const staged = path.join(root, 'oversized.png');
    await fs.writeFile(staged, pngHeader(12000, 12000));

    await expect(storage.uploadEvidence(
      { path: staged, originalname: 'small.png', mimetype: 'image/png' },
      17,
      42,
      'oversized'
    )).rejects.toThrow('Image exceeds safe dimensions');

    await expect(fs.access(path.join(storage.basePath, '17', '42', 'oversized.png')))
      .rejects.toThrow();
  });

  test('rejects a real object-stream PDF with more than 500 pages', async () => {
    const { PDFDocument } = require('pdf-lib');
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 501; i += 1) pdf.addPage([72, 72]);
    const staged = path.join(root, 'many-pages.pdf');
    await fs.writeFile(staged, await pdf.save({ useObjectStreams: true }));
    await expect(storage.uploadEvidence(
      { path: staged, originalname: 'many-pages.pdf', mimetype: 'application/pdf' },
      17,
      42,
      'many-pages'
    )).rejects.toThrow('maximum allowed pages');
  });

  test('deletes namespaced derivatives without touching unowned legacy globals', async () => {
    const documentDir = path.join(storage.basePath, '17', '42');
    const legacyDir = path.join(root, 'thumbnails');
    await fs.mkdir(documentDir, { recursive: true });
    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(documentDir, 'proof.png'), 'evidence');
    await fs.writeFile(path.join(documentDir, 'proof_thumb.jpg'), 'thumbnail');
    await fs.writeFile(path.join(legacyDir, 'proof_thumb.jpg'), 'legacy thumbnail');

    await storage.deleteEvidence(17, 42, '17/42/proof.png');

    await expect(fs.access(path.join(documentDir, 'proof.png'))).rejects.toThrow();
    await expect(fs.access(path.join(documentDir, 'proof_thumb.jpg'))).rejects.toThrow();
    await expect(fs.access(path.join(legacyDir, 'proof_thumb.jpg'))).resolves.toBeUndefined();
  });

  test('enforces per-document storage quotas before moving the staged file', async () => {
    const previousLimit = process.env.EVIDENCE_DOCUMENT_MAX_BYTES;
    process.env.EVIDENCE_DOCUMENT_MAX_BYTES = '30';
    const documentDir = path.join(storage.basePath, '17', '42');
    await fs.mkdir(documentDir, { recursive: true });
    await fs.writeFile(path.join(documentDir, 'existing.png'), Buffer.alloc(20));
    const staged = path.join(root, 'new.png');
    await fs.writeFile(staged, pngHeader(1, 1));
    try {
      await expect(storage.uploadEvidence(
        { path: staged, originalname: 'new.png', mimetype: 'image/png' },
        17,
        42,
        'new'
      )).rejects.toThrow('Evidence storage quota exceeded');
    } finally {
      if (previousLimit === undefined) delete process.env.EVIDENCE_DOCUMENT_MAX_BYTES;
      else process.env.EVIDENCE_DOCUMENT_MAX_BYTES = previousLimit;
    }
  });

  test('removes the complete owned evidence directory when a document is deleted', async () => {
    const documentDir = path.join(storage.basePath, '17', '42');
    await fs.mkdir(documentDir, { recursive: true });
    await fs.writeFile(path.join(documentDir, 'proof.png'), 'sensitive');
    await storage.deleteDocumentEvidence(17, 42);
    await expect(fs.access(documentDir)).rejects.toThrow();
  });

  test('document deletion keeps cleanup retryable by removing evidence before the DB row', async () => {
    const source = await fs.readFile(path.join(
      process.cwd(), 'app', 'api', 'documents', '[id]', 'route.ts'
    ), 'utf8');
    expect(source.indexOf('await evidenceStorage.deleteDocumentEvidence'))
      .toBeLessThan(source.indexOf("'DELETE FROM documents"));
  });
});
