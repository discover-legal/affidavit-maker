#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const storagePath = path.resolve(process.env.DOCUMENTS_PATH || '/app/documents');
const requireMount = process.env.REQUIRE_PERSISTENT_STORAGE === 'true';

function unescapeMountPath(value) {
  return value.replace(/\\040/g, ' ').replace(/\\011/g, '\t').replace(/\\134/g, '\\');
}

function isMountPoint(target) {
  const mounts = fs.readFileSync('/proc/self/mountinfo', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => unescapeMountPath(line.split(' ')[4]));
  return mounts.includes(target);
}

if (requireMount && !isMountPoint(storagePath)) {
  throw new Error(`Refusing to start: persistent storage is not mounted at ${storagePath}`);
}
fs.mkdirSync(storagePath, { recursive: true, mode: 0o750 });
fs.chownSync(storagePath, 1001, 1001);
fs.chmodSync(storagePath, 0o750);
const marker = path.join(storagePath, '.affidavit-storage');
fs.writeFileSync(marker, 'storage-v1\n', { mode: 0o640 });
fs.chownSync(marker, 1001, 1001);
console.log(`Persistent storage prepared at ${storagePath}`);
