import { describe, expect, it, vi } from 'vitest';
import copy from '../../docs/content/copy.json';
import { EXTRA, EXTRA_FALLBACK, mergeExtra } from './strings';

function leaves(node: unknown, path: string, out: Map<string, string>): void {
  if (typeof node === 'string') {
    out.set(path, node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => leaves(item, `${path}[${index}]`, out));
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) leaves(value, path ? `${path}.${key}` : key, out);
  }
}

function tokens(value: string): string[] {
  return [...value.matchAll(/\{[a-zA-Z]+\}/g)].map((match) => match[0]).sort();
}

describe('copy.json extra', () => {
  const fallback = new Map<string, string>();
  const edited = new Map<string, string>();
  const resolved = new Map<string, string>();
  leaves(EXTRA_FALLBACK, '', fallback);
  leaves(copy.extra, '', edited);
  leaves(EXTRA, '', resolved);

  it('reads every leftover string from copy.json extra, exactly', () => {
    const missing = [...fallback.keys()].filter((path) => !edited.has(path));
    expect(missing, 'copy.json extra is missing keys').toEqual([]);
    for (const [path, value] of fallback) {
      expect(tokens(edited.get(path) ?? ''), path).toEqual(tokens(value));
      expect(resolved.get(path), path).toBe(edited.get(path));
    }
  });

  it('warns and keeps the built-in string when a key is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const merged = mergeExtra({ hud: { fit: 'Fit' }, note: 'built in' }, { hud: { fit: 'Fit the garden' } });
    expect(merged).toEqual({ hud: { fit: 'Fit the garden' }, note: 'built in' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('extra.note');
    warn.mockRestore();
  });
});
