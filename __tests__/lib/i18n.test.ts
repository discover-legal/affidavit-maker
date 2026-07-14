/**
 * lib/i18n — the tiny EN/ES helper behind the /profile language toggle.
 * Runs in jsdom so window/localStorage/navigator behave like a browser.
 */

import {
  LANG_STORAGE_KEY,
  STRINGS,
  getInitialLang,
  setLang,
  t,
} from '@/lib/i18n';

function setNavigatorLanguage(value: string) {
  Object.defineProperty(window.navigator, 'language', {
    value,
    configurable: true,
  });
}

describe('t', () => {
  test('returns the string for the requested language', () => {
    expect(t('en', 'header.title')).toBe('Your life story');
    expect(t('es', 'header.title')).toBe('La historia de tu vida');
  });

  test('falls back to English for a key missing in Spanish', () => {
    const key = '__test_only_en_key__';
    STRINGS.en[key] = 'only in english';
    try {
      expect(t('es', key)).toBe('only in english');
    } finally {
      delete STRINGS.en[key];
    }
  });

  test('returns the key itself when it exists nowhere', () => {
    expect(t('en', 'no.such.key')).toBe('no.such.key');
    expect(t('es', 'no.such.key')).toBe('no.such.key');
  });

  test('interpolates {placeholders} from vars, including repeats', () => {
    expect(t('en', 'meter.progress', { known: 3, total: 9 })).toBe(
      '3 of 9 story details shared',
    );
    expect(t('es', 'meter.progress', { known: 3, total: 9 })).toBe(
      '3 de 9 detalles de tu historia compartidos',
    );
    expect(t('es', 'children.many', { n: 4 })).toBe('Tienes 4 hijos.');
  });

  test('every Spanish key exists in English (EN is the fallback source)', () => {
    for (const key of Object.keys(STRINGS.es)) {
      expect(STRINGS.en[key]).toBeDefined();
    }
  });

  test('every English key has a Spanish translation (page is fully bilingual)', () => {
    for (const key of Object.keys(STRINGS.en)) {
      expect(STRINGS.es[key]).toBeDefined();
    }
  });
});

describe('getInitialLang', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setNavigatorLanguage('en-US');
  });

  test('defaults to en with no saved preference and an English browser', () => {
    expect(getInitialLang()).toBe('en');
  });

  test('detects a Spanish browser language', () => {
    setNavigatorLanguage('es-MX');
    expect(getInitialLang()).toBe('es');
    setNavigatorLanguage('es');
    expect(getInitialLang()).toBe('es');
  });

  test('a saved preference wins over the browser language', () => {
    setNavigatorLanguage('es-MX');
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en');
    expect(getInitialLang()).toBe('en');

    setNavigatorLanguage('en-US');
    window.localStorage.setItem(LANG_STORAGE_KEY, 'es');
    expect(getInitialLang()).toBe('es');
  });

  test('ignores garbage in storage and falls back to detection', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'fr');
    expect(getInitialLang()).toBe('en');
    setNavigatorLanguage('es-419');
    expect(getInitialLang()).toBe('es');
  });

  test('survives a throwing localStorage (private browsing)', () => {
    const original = window.localStorage.getItem.bind(window.localStorage);
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    try {
      setNavigatorLanguage('es-ES');
      expect(getInitialLang()).toBe('es');
    } finally {
      jest.restoreAllMocks();
      expect(original).toBeDefined();
    }
  });
});

describe('setLang', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('persists the choice under dl_lang', () => {
    setLang('es');
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('es');
    setLang('en');
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
  });

  test('round-trips through getInitialLang', () => {
    setLang('es');
    expect(getInitialLang()).toBe('es');
  });

  test('does not throw when localStorage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    try {
      expect(() => setLang('es')).not.toThrow();
    } finally {
      jest.restoreAllMocks();
    }
  });
});
