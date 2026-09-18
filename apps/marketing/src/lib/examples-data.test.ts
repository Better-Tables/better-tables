import { describe, expect, it } from 'bun:test';
import { EXAMPLE_ENTRIES } from './examples-data';

describe('EXAMPLE_ENTRIES', () => {
  it('has a unique, zero-padded id for every entry', () => {
    const ids = EXAMPLE_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^\d{2}$/);
    }
  });

  it('includes the admin navigator example linking to /examples/admin-navigator', () => {
    const entry = EXAMPLE_ENTRIES.find((e) => e.id === '06');
    expect(entry).toBeDefined();
    expect(entry?.title).toBe('Admin navigator');
    expect(entry?.href).toBe('/examples/admin-navigator');
    expect(entry?.anchor).toBeUndefined();
    expect(entry?.chips).toContain('TableNavigator');
  });

  it('every non-anchor entry links to a distinct /examples/* page', () => {
    const pageEntries = EXAMPLE_ENTRIES.filter((entry) => !entry.anchor);
    const hrefs = pageEntries.map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      expect(href.startsWith('/examples/')).toBe(true);
    }
  });
});
