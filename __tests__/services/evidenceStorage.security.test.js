/** @jest-environment node */

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs').promises;

describe('EvidenceStorage filesystem isolation', () => {
  let root;
  let storage;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-storage-test-'));
    process.env.DOCUMENTS_PATH = root;
    jest.resetModules();
    storage = require('../../services/evidenceStorage');
  });

  afterEach(async () => {
    delete process.env.DOCUMENTS_PATH;
    await fs.rm(root, { recursive: true, force: true });
  });

  test('generates opaque server IDs and never uses a client-selected filename', async () => {
    const staged = path.join(root, 'client-selected-name.pdf');
    await fs.writeFile(staged, Buffer.from('%PDF-1.7\n/Type /Page\n'));

    const uploaded = await storage.uploadEvidence(
      {
        path: staged,
        originalname: 'statement.pdf',
        mimetype: 'application/pdf',
        size: 22,
      },
      7,
      42,
    );

    expect(uploaded.evidenceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(uploaded.fileKey).toBe(`7/42/${uploaded.evidenceId}.pdf`);
    await expect(fs.access(staged)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('document cleanup removes only the exact user/document sandbox', async () => {
    const target = storage.getUserEvidenceDir(7, 42);
    const sibling = storage.getUserEvidenceDir(7, 420);
    await fs.mkdir(target, { recursive: true });
    await fs.mkdir(sibling, { recursive: true });
    await fs.writeFile(path.join(target, 'remove.pdf'), 'x');
    await fs.writeFile(path.join(sibling, 'keep.pdf'), 'x');

    await storage.deleteEvidenceForDocument(7, 42);

    await expect(fs.access(target)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.readFile(path.join(sibling, 'keep.pdf'), 'utf8')).resolves.toBe('x');
  });
});
