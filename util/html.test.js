// Example unit test. Copy this pattern when adding tests for any pure module.
//   - Place tests next to the file they test, named *.test.js
//   - Run `npm test` to execute, `npm run test:watch` for live feedback
//   - Aim for: one describe per module, one it per behavior, plain assertions

import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeAttr } from './html.js';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<script>alert("hi" & \'bye\')</script>')).toBe(
      '&lt;script&gt;alert(&quot;hi&quot; &amp; \'bye\')&lt;/script&gt;'
    );
  });

  it('coerces non-strings without throwing', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
    expect(escapeHtml(undefined)).toBe('undefined');
  });

  it('escapes ampersands before other entities to avoid double-escaping', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('returns the empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('escapeAttr', () => {
  it('escapes &, ", and < (the chars that break double-quoted attributes)', () => {
    expect(escapeAttr('a"b&c<d')).toBe('a&quot;b&amp;c&lt;d');
  });

  it('leaves > untouched (allowed inside attribute values)', () => {
    expect(escapeAttr('a>b')).toBe('a>b');
  });

  it('escapes & first so existing entities are preserved as text', () => {
    expect(escapeAttr('&amp;')).toBe('&amp;amp;');
  });
});
