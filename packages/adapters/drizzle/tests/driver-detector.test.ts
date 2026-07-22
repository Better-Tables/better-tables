import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { detectDriver } from '../src/utils/driver-detector';

describe('detectDriver (plan 051)', () => {
  it('detects sqlite from a real bun:sqlite drizzle instance', () => {
    const db = drizzle(new Database(':memory:'));
    expect(detectDriver(db)).toBe('sqlite');
  });

  it('detects sqlite even when the class name is mangled by minification', () => {
    // Production bundlers rename class names, so `db.constructor.name` becomes
    // something like "t" — the old class-name fallback then failed. A real
    // SQLite drizzle instance still exposes the run/all/get/values method
    // signature, which minification preserves, so detection must succeed.
    const db = drizzle(new Database(':memory:'));
    Object.defineProperty(db.constructor, 'name', { value: 't', configurable: true });
    expect(db.constructor.name).toBe('t');
    expect(detectDriver(db)).toBe('sqlite');
  });

  it('detects sqlite from the method signature alone (run/all/get/values)', () => {
    // No dialect, no session, no meaningful constructor name — only the shape
    // shared by every SQLite driver that extends BaseSQLiteDatabase.
    const shape = { run() {}, all() {}, get() {}, values() {}, select() {} };
    expect(detectDriver(shape)).toBe('sqlite');
  });

  it('does not classify a postgres-shaped instance as sqlite', () => {
    // Postgres/MySQL expose `execute` and lack the SQLite result accessors.
    const pgShape = { query: {}, execute() {}, select() {} };
    expect(detectDriver(pgShape)).toBe('postgres');
  });

  it('returns null for an uninitialized drizzle shell seen during Next build-time collection', () => {
    // Next imports route modules during page-data collection; a partially
    // constructed native-backed drizzle instance can expose `_` without a
    // populated session/dialect. Lazy request-time factories avoid this path.
    expect(detectDriver({ _: { session: {} } })).toBeNull();
    expect(detectDriver({})).toBeNull();
    // A partial SQLite shape (missing accessors) must not false-positive.
    expect(detectDriver({ run() {}, all() {} })).toBeNull();
  });
});
