'use strict';

const fs = require('node:fs').promises;

// Detect only formats accepted by the evidence feature. A narrow parser keeps
// attacker-controlled uploads out of unrelated and historically vulnerable
// multimedia container parsers.
function fromBuffer(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  if (buffer.length >= 5 && buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return { mime: 'application/pdf', ext: 'pdf' };
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  return undefined;
}

async function fromFile(filepath) {
  const handle = await fs.open(filepath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return fromBuffer(buffer.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

module.exports = { fromBuffer, fromFile };
