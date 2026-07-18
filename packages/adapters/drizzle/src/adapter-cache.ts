/**
 * @fileoverview In-memory LRU cache for Drizzle adapter fetch results
 * @module @better-tables/drizzle-adapter/adapter-cache
 */

import type { FetchDataParams, FilterState } from '@better-tables/core';

export interface AdapterCacheOptions {
  cache?: {
    enabled?: boolean;
    ttl?: number;
    maxSize?: number;
  };
}

type CacheEntry<TValue> = {
  value: TValue;
  timestamp: number;
  ttl: number;
};

/**
 * LRU cache with TTL for adapter fetchData results.
 */
export class AdapterCache<TValue> {
  private cache = new Map<string, CacheEntry<TValue>>();

  constructor(private options?: AdapterCacheOptions) {}

  getKey(
    params: FetchDataParams & {
      computedFields?: string[];
      computedFieldFilters?: FilterState[];
    }
  ): string {
    return JSON.stringify(params);
  }

  get(key: string): TValue | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    const ttl = cached.ttl || this.options?.cache?.ttl || 300000;
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // LRU: re-insert so this key is most-recently-used.
    this.cache.delete(key);
    this.cache.set(key, cached);
    return cached.value;
  }

  set(key: string, value: TValue, ttl?: number): void {
    if (this.options?.cache?.enabled === false) {
      return;
    }

    const maxSize = this.options?.cache?.maxSize ?? 500;
    // Non-positive / non-finite capacity means no-cache (clear any residual).
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      this.cache.clear();
      return;
    }

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    while (this.cache.size >= maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.options?.cache?.ttl || 300000, // 5 minutes default
    });
  }

  isExpired(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return true;

    const ttl = cached.ttl || this.options?.cache?.ttl || 300000;
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  invalidate(): void {
    this.cache.clear();
  }

  /** Test/introspection helper — current in-memory cache entry count. */
  getSizeForTests(): number {
    return this.cache.size;
  }
}
