/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';

describe('document save optimistic concurrency contract', () => {
  const root = process.cwd();
  const saveRoute = fs.readFileSync(
    path.join(root, 'app/api/documents/save/route.ts'),
    'utf8',
  );
  const context = fs.readFileSync(
    path.join(root, 'contexts/DocumentContext.js'),
    'utf8',
  );
  const migration = fs.readFileSync(
    path.join(root, 'migrations/019_document_edit_revisions.sql'),
    'utf8',
  );

  it('adds a durable, non-null edit revision', () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS edit_revision BIGINT NOT NULL DEFAULT 1/i,
    );
  });

  it('atomically compares and increments the revision on update', () => {
    expect(saveRoute).toMatch(/edit_revision = edit_revision \+ 1/i);
    expect(saveRoute).toMatch(
      /WHERE id = \$5 AND user_id = \$6 AND \(\$7::bigint IS NULL OR edit_revision = \$7\)/i,
    );
    expect(saveRoute).toContain("errorType: 'DocumentConflict'");
    expect(saveRoute).toContain('{ status: 409 }');
  });

  it('retains the server revision without persisting it into legal content', () => {
    expect(context).toContain("'serverRevision'");
    expect(context).toContain('expectedRevision: serverRevisionRef.current');
    expect(context).toContain('!stateRef.current.saveConflict');
  });
});
