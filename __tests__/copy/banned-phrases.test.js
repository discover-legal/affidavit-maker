// __tests__/copy/banned-phrases.test.js
//
// Liability-posture guard: the product is a PREP tool, not the filing conduit.
// Copy that overstates that — "filing packet", "court-ready", "ready to file" —
// keeps sneaking back into UI/marketing text through partial sweeps. This
// grep-based test fails the build if any of those phrases show up in the
// user-facing source under components/, lib/, or app/. The sanctioned wording
// is "case packet"; drafts are "drafts".
//
// Runtime user-generated content (persona chat, extracted facts) is out of
// scope — this test scans SOURCE files only. app/api/**, __tests__/**, build
// artifacts, and vendor code are excluded because they don't render the copy.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const SCAN_DIRS = ['components', 'lib', 'app'];
const SCAN_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx', '.html']);
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '__tests__',
  'api', // app/api/** is API surface, not user-facing UI copy
]);
// The download filename in app/api/documents/packet/route.ts is API-layer
// (Content-Disposition); this test focuses on rendered UI copy, and app/api
// is excluded above. Analytics event names and JS identifiers written in
// snake_case / camelCase (filing_packet_downloaded, handleFilingPacket) are
// not word-boundary matches for these regexes.

const PATTERNS = [
  { name: 'filing packet', re: /\bfiling\s+packet\b/i },
  { name: 'court-ready',   re: /\bcourt[-\s]ready\b/i },
  { name: 'ready to file', re: /\bready\s+to\s+file\b/i },
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_err) {
    return out;
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && SCAN_EXTS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

describe('banned marketing/UI phrases never resurface in source', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));

  test.each(PATTERNS)('no source file contains "$name"', ({ re }) => {
    const hits = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      // Scan line by line so failure messages point to the exact spot.
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          hits.push(`${path.relative(ROOT, file)}:${i + 1}  ${lines[i].trim()}`);
        }
      }
    }
    if (hits.length > 0) {
      throw new Error(
        `Banned phrase leaked into source (use "case packet" / draft language instead):\n` +
          hits.join('\n'),
      );
    }
  });
});
