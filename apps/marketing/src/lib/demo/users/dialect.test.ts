import { afterEach, describe, expect, it } from 'bun:test';
import { dialectMeta, getPreferredUsersDialect, hasDatabaseUrl } from './dialect';

const originalUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalUrl;
  }
});

describe('users dialect preference', () => {
  it('prefers postgres when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgres://example.invalid/db';
    expect(hasDatabaseUrl()).toBe(true);
    expect(getPreferredUsersDialect()).toBe('postgres');
    expect(dialectMeta('postgres').supportsReset).toBe(false);
  });

  it('prefers sqlite when DATABASE_URL is missing or blank', () => {
    delete process.env.DATABASE_URL;
    expect(hasDatabaseUrl()).toBe(false);
    expect(getPreferredUsersDialect()).toBe('sqlite');

    process.env.DATABASE_URL = '   ';
    expect(hasDatabaseUrl()).toBe(false);
    expect(getPreferredUsersDialect()).toBe('sqlite');
    expect(dialectMeta('sqlite').supportsReset).toBe(true);
  });
});
