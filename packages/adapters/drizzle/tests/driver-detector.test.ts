import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { detectDriver } from '../src/utils/driver-detector';

describe('detectDriver (plan 051)', () => {
  it('detects sqlite from a real bun:sqlite drizzle instance', () => {
    const db = drizzle(new Database(':memory:'));
    expect(detectDriver(db)).toBe('sqlite');
  });

  it('returns null for an uninitialized drizzle shell seen during Next build-time collection', () => {
    // Next imports route modules during page-data collection; a partially
    // constructed native-backed drizzle instance can expose `_` without a
    // populated session/dialect. Lazy request-time factories avoid this path.
    expect(detectDriver({ _: { session: {} } })).toBeNull();
    expect(detectDriver({})).toBeNull();
  });
});
