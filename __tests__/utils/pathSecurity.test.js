const path = require('path');
const {
  validatePath,
  isValidFilename,
  sanitizeFilename
} = require('../../utils/pathSecurity');

describe('pathSecurity', () => {
  // ---------------------------------------------------------------------------
  // validatePath
  // ---------------------------------------------------------------------------
  describe('validatePath', () => {
    const basePath = path.resolve('/tmp/templates');

    it('should return resolved absolute path for a valid relative path', () => {
      const result = validatePath(basePath, 'states/TX/metadata.json');
      expect(result).toBe(path.join(basePath, 'states', 'TX', 'metadata.json'));
    });

    it('should allow a path that equals the basePath exactly', () => {
      // relativePath of '.' resolves to basePath itself
      const result = validatePath(basePath, '.');
      expect(result).toBe(path.resolve(basePath));
    });

    it('should handle a relative path with ./ prefix', () => {
      const result = validatePath(basePath, './states/CA');
      expect(result).toBe(path.join(basePath, 'states', 'CA'));
    });

    it('should allow deeply nested valid paths', () => {
      const result = validatePath(basePath, 'a/b/c/d/e/f.txt');
      expect(result).toBe(path.join(basePath, 'a', 'b', 'c', 'd', 'e', 'f.txt'));
    });

    // --- traversal attacks ---

    it('should throw on ../ traversal', () => {
      expect(() => validatePath(basePath, '../etc/passwd'))
        .toThrow('Path traversal attempt blocked');
    });

    it('should throw on ..\\ traversal (Windows-style)', () => {
      expect(() => validatePath(basePath, '..\\etc\\passwd'))
        .toThrow('Path traversal attempt blocked');
    });

    it('should throw on deeply nested traversal', () => {
      expect(() => validatePath(basePath, '../../../../../../etc/passwd'))
        .toThrow('Path traversal attempt blocked');
    });

    it('should throw when traversal is hidden inside a valid-looking path', () => {
      expect(() => validatePath(basePath, 'states/../../etc/shadow'))
        .toThrow('Path traversal attempt blocked');
    });

    // --- null / empty / missing parameters ---

    it('should throw on null basePath', () => {
      expect(() => validatePath(null, 'file.txt'))
        .toThrow('Invalid path parameters');
    });

    it('should throw on empty string basePath', () => {
      expect(() => validatePath('', 'file.txt'))
        .toThrow('Invalid path parameters');
    });

    it('should throw on null relativePath', () => {
      expect(() => validatePath(basePath, null))
        .toThrow('Invalid path parameters');
    });

    it('should throw on empty string relativePath', () => {
      expect(() => validatePath(basePath, ''))
        .toThrow('Invalid path parameters');
    });

    it('should throw on undefined basePath', () => {
      expect(() => validatePath(undefined, 'file.txt'))
        .toThrow('Invalid path parameters');
    });

    it('should throw on undefined relativePath', () => {
      expect(() => validatePath(basePath, undefined))
        .toThrow('Invalid path parameters');
    });
  });

  // ---------------------------------------------------------------------------
  // isValidFilename
  // ---------------------------------------------------------------------------
  describe('isValidFilename', () => {
    // --- valid filenames ---

    it('should return true for a simple filename', () => {
      expect(isValidFilename('file.txt')).toBe(true);
    });

    it('should return true for a filename with hyphens and underscores', () => {
      expect(isValidFilename('my-file_v2.pdf')).toBe(true);
    });

    it('should return true for a path with forward slashes', () => {
      expect(isValidFilename('path/to/file.js')).toBe(true);
    });

    it('should return true for a purely alphanumeric filename', () => {
      expect(isValidFilename('report2024')).toBe(true);
    });

    it('should return true for a filename at exactly maxLength', () => {
      const name = 'a'.repeat(200);
      expect(isValidFilename(name)).toBe(true);
    });

    // --- invalid: empty / null / non-string ---

    it('should return false for null', () => {
      expect(isValidFilename(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidFilename(undefined)).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(isValidFilename('')).toBe(false);
    });

    it('should return false for a number', () => {
      expect(isValidFilename(42)).toBe(false);
    });

    it('should return false for an object', () => {
      expect(isValidFilename({})).toBe(false);
    });

    // --- invalid: contains .. ---

    it('should return false when filename contains ..', () => {
      expect(isValidFilename('../etc/passwd')).toBe(false);
    });

    it('should return false when .. appears mid-path', () => {
      expect(isValidFilename('foo/../bar')).toBe(false);
    });

    // --- invalid: exceeds maxLength ---

    it('should return false when filename exceeds default maxLength (200)', () => {
      const name = 'a'.repeat(201);
      expect(isValidFilename(name)).toBe(false);
    });

    it('should return false when filename exceeds custom maxLength', () => {
      const name = 'a'.repeat(11);
      expect(isValidFilename(name, 10)).toBe(false);
    });

    // --- invalid: special / unsafe characters ---

    it('should return false for a filename containing spaces', () => {
      expect(isValidFilename('my file.txt')).toBe(false);
    });

    it('should return false for a filename containing double quotes', () => {
      expect(isValidFilename('file"name.txt')).toBe(false);
    });

    it('should return false for a filename containing single quotes', () => {
      expect(isValidFilename("file'name.txt")).toBe(false);
    });

    it('should return false for a filename containing semicolons', () => {
      expect(isValidFilename('file;name.txt')).toBe(false);
    });

    it('should return false for a filename containing pipes', () => {
      expect(isValidFilename('file|name.txt')).toBe(false);
    });

    it('should return false for a filename containing backticks', () => {
      expect(isValidFilename('file`name.txt')).toBe(false);
    });

    it('should return false for a filename containing angle brackets', () => {
      expect(isValidFilename('file<name>.txt')).toBe(false);
    });

    it('should return false for a filename containing ampersand', () => {
      expect(isValidFilename('file&name.txt')).toBe(false);
    });

    it('should return false for a filename containing dollar sign', () => {
      expect(isValidFilename('file$name.txt')).toBe(false);
    });

    // --- custom maxLength ---

    it('should accept a filename within custom maxLength', () => {
      expect(isValidFilename('short', 10)).toBe(true);
    });

    it('should accept a filename at exactly custom maxLength', () => {
      expect(isValidFilename('abcde', 5)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // sanitizeFilename
  // ---------------------------------------------------------------------------
  describe('sanitizeFilename', () => {
    // --- passthrough for safe filenames ---

    it('should pass through a normal filename unchanged', () => {
      expect(sanitizeFilename('report.pdf')).toBe('report.pdf');
    });

    it('should pass through a filename with hyphens and dots', () => {
      expect(sanitizeFilename('my-file.v2.txt')).toBe('my-file.v2.txt');
    });

    it('should pass through a filename with underscores', () => {
      expect(sanitizeFilename('data_backup_2024.csv')).toBe('data_backup_2024.csv');
    });

    // --- special chars replaced with underscore ---

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('my file name.txt')).toBe('my_file_name.txt');
    });

    it('should replace special characters with underscores', () => {
      expect(sanitizeFilename('file@#%.txt')).toBe('file_.txt');
    });

    it('should replace forward slashes with underscores', () => {
      expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    });

    // --- consecutive underscores collapsed ---

    it('should collapse multiple consecutive underscores', () => {
      expect(sanitizeFilename('file!!!name.txt')).toBe('file_name.txt');
    });

    it('should collapse underscores from multiple adjacent special chars', () => {
      expect(sanitizeFilename('a   b')).toBe('a_b');
    });

    // --- truncation ---

    it('should truncate to default maxLength of 100', () => {
      const longName = 'a'.repeat(150);
      const result = sanitizeFilename(longName);
      expect(result).toHaveLength(100);
      expect(result).toBe('a'.repeat(100));
    });

    it('should truncate to custom maxLength', () => {
      const longName = 'a'.repeat(50);
      const result = sanitizeFilename(longName, 20);
      expect(result).toHaveLength(20);
    });

    it('should not truncate a filename shorter than maxLength', () => {
      expect(sanitizeFilename('short.txt', 50)).toBe('short.txt');
    });

    // --- null / empty / non-string returns 'file' ---

    it('should return "file" for null input', () => {
      expect(sanitizeFilename(null)).toBe('file');
    });

    it('should return "file" for undefined input', () => {
      expect(sanitizeFilename(undefined)).toBe('file');
    });

    it('should return "file" for empty string input', () => {
      expect(sanitizeFilename('')).toBe('file');
    });

    it('should return "file" for a number input', () => {
      expect(sanitizeFilename(42)).toBe('file');
    });

    // --- custom maxLength ---

    it('should respect custom maxLength of 10', () => {
      const result = sanitizeFilename('a-very-long-filename.txt', 10);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should respect custom maxLength of 5 with special chars', () => {
      const result = sanitizeFilename('hello world!!', 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});
