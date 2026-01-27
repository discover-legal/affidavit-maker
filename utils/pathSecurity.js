// utils/pathSecurity.js - Path traversal prevention utilities
const path = require('path');

/**
 * Validate that a resolved path stays within a base directory
 * Prevents path traversal attacks (e.g., ../../etc/passwd)
 *
 * @param {string} basePath - The allowed base directory
 * @param {string} relativePath - The user-provided relative path
 * @returns {string} The validated, resolved absolute path
 * @throws {Error} If path would escape base directory
 */
function validatePath(basePath, relativePath) {
  if (!basePath || !relativePath) {
    throw new Error('Invalid path parameters');
  }

  // Resolve both paths to absolute
  const resolvedBase = path.resolve(basePath);
  const resolvedFull = path.resolve(basePath, relativePath);

  // Ensure the resolved path starts with the base path
  // Add path.sep to prevent partial matches (e.g., /base-other matching /base)
  const normalizedBase = resolvedBase + path.sep;

  if (!resolvedFull.startsWith(normalizedBase) && resolvedFull !== resolvedBase) {
    throw new Error('Path traversal attempt blocked');
  }

  return resolvedFull;
}

/**
 * Validate a filename/key contains only safe characters
 * Allows: alphanumeric, underscore, hyphen, dot, forward slash
 *
 * @param {string} filename - The filename or key to validate
 * @param {number} maxLength - Maximum allowed length (default 200)
 * @returns {boolean} True if valid
 */
function isValidFilename(filename, maxLength = 200) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  if (filename.length > maxLength) {
    return false;
  }

  // Block path traversal sequences
  if (filename.includes('..')) {
    return false;
  }

  // Allow only safe characters
  return /^[\w.\-\/]+$/.test(filename);
}

/**
 * Sanitize a filename for use in HTTP headers
 * Removes/replaces unsafe characters
 *
 * @param {string} filename - The original filename
 * @param {number} maxLength - Maximum length (default 100)
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename, maxLength = 100) {
  if (!filename || typeof filename !== 'string') {
    return 'file';
  }

  return filename
    .replace(/[^\w.\-]/g, '_')  // Replace unsafe chars with underscore
    .replace(/_{2,}/g, '_')     // Collapse multiple underscores
    .substring(0, maxLength);
}

module.exports = {
  validatePath,
  isValidFilename,
  sanitizeFilename
};
