# @better-tables/adapters - Architecture and Implementation Guide

## Overview

The Better Tables adapter system provides a standardized interface for connecting tables to various data sources. Adapters abstract away the complexity of data fetching, filtering, sorting, and pagination, allowing the same table components to work with different backends.

## Table of Contents

- [Adapter Architecture](#adapter-architecture)
- [Core Adapter Interface](#core-adapter-interface)
- [Adapter Types](#adapter-types)
- [Implementation Patterns](#implementation-patterns)
- [Memory Adapter](#memory-adapter)
- [REST Adapter](#rest-adapter)
- [Drizzle Adapter](#drizzle-adapter)
- [Custom Adapter Development](#custom-adapter-development)
- [Testing Adapters](#testing-adapters)
- [Performance Considerations](#performance-considerations)

## Adapter Architecture

### Design Principles

1. **Unified Interface**: All adapters implement the same `TableAdapter` interface
2. **Type Safety**: Full TypeScript support with generic data types
3. **Performance**: Optimized for large datasets with efficient querying
4. **Extensibility**: Easy to create custom adapters for specific needs
5. **Caching**: Built-in caching strategies for improved performance
6. **Error Handling**: Comprehensive error handling and recovery

### Core Components

```typescript
// Core adapter interface
interface TableAdapter<TData = unknown> {
  fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>>;
  getFilterOptions(columnId: string): Promise<FilterOption[]>;
  getFacetedValues(columnId: string): Promise<Map<string, number>>;
  getMinMaxValues(columnId: string): Promise<[number, number]>;
  createRecord?(data: Partial<TData>): Promise<TData>;
  updateRecord?(id: string, data: Partial<TData>): Promise<TData>;
  deleteRecord?(id: string): Promise<void>;
  bulkUpdate?(ids: string[], data: Partial<TData>): Promise<TData[]>;
  bulkDelete?(ids: string[]): Promise<void>;
  exportData?(params: ExportParams): Promise<ExportResult>;
  subscribe?(callback: (event: DataEvent<TData>) => void): () => void;
  meta: AdapterMeta;
}
```

## Core Adapter Interface

### FetchDataParams

```typescript
interface FetchDataParams {
  /** Current filters */
  filters?: FilterState[];
  /** Pagination parameters */
  pagination?: PaginationParams;
  /** Sorting parameters */
  sorting?: SortingParams[];
  /** Additional query parameters */
  params?: Record<string, unknown>;
}
```

### FetchDataResult

```typescript
interface FetchDataResult<TData = any> {
  /** The actual data */
  data: TData[];
  /** Total count of items (for pagination) */
  total: number;
  /** Pagination information */
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  /** Additional metadata */
  meta?: Record<string, any>;
}
```

### AdapterMeta

```typescript
interface AdapterMeta {
  /** Adapter name */
  name: string;
  /** Adapter version */
  version: string;
  /** Supported features */
  features: AdapterFeatures;
  /** Configuration options */
  config: AdapterConfig;
}
```

### AdapterFeatures

```typescript
interface AdapterFeatures {
  /** Whether the adapter supports filtering */
  filtering: boolean;
  /** Whether the adapter supports sorting */
  sorting: boolean;
  /** Whether the adapter supports pagination */
  pagination: boolean;
  /** Whether the adapter supports real-time updates */
  realtime: boolean;
  /** Whether the adapter supports CRUD operations */
  crud: boolean;
  /** Whether the adapter supports bulk operations */
  bulk: boolean;
  /** Whether the adapter supports export */
  export: boolean;
  /** Whether the adapter supports faceted search */
  faceted: boolean;
}
```

## Adapter Types

### 1. Memory Adapter

**Purpose**: In-memory data storage for testing, demos, and small datasets.

**Features**:

- Fast in-memory operations
- No external dependencies
- Perfect for testing and development
- Supports all table features

**Use Cases**:

- Development and testing
- Small datasets (< 10,000 records)
- Demo applications
- Prototyping

### 2. REST Adapter

**Purpose**: Connect to REST APIs and GraphQL endpoints.

**Features**:

- HTTP/HTTPS communication
- Authentication support
- Error handling and retry logic
- Request/response transformation
- Caching strategies

**Use Cases**:

- REST APIs
- GraphQL endpoints
- Microservices
- Third-party integrations

### 3. Drizzle Adapter

**Purpose**: Direct database integration using Drizzle ORM.

**Features**:

- Type-safe database queries
- Multiple database support (PostgreSQL, MySQL, SQLite)
- Query optimization
- Transaction support
- Schema introspection

**Use Cases**:

- Direct database access
- High-performance applications
- Complex queries
- Enterprise applications

## Implementation Patterns

### Base Adapter Class

```typescript
abstract class BaseAdapter<TData = unknown> implements TableAdapter<TData> {
  meta: AdapterMeta;
  protected config: AdapterConfig;
  protected cache: Map<string, any> = new Map();
  protected subscribers: Array<(event: DataEvent<TData>) => void> = [];

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  // Abstract methods that must be implemented
  abstract fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>>;
  abstract getFilterOptions(columnId: string): Promise<FilterOption[]>;

  // Optional methods with default implementations
  getFacetedValues(columnId: string): Promise<Map<string, number>> {
    // Default implementation
    return Promise.resolve(new Map());
  }

  getMinMaxValues(columnId: string): Promise<[number, number]> {
    // Default implementation
    return Promise.resolve([0, 100]);
  }

  // Utility methods
  protected buildQuery(params: FetchDataParams): QueryBuilder {
    // Common query building logic
  }

  protected applyFilters(
    query: QueryBuilder,
    filters: FilterState[]
  ): QueryBuilder {
    // Common filter application logic
  }

  protected applySorting(
    query: QueryBuilder,
    sorting: SortingParams[]
  ): QueryBuilder {
    // Common sorting application logic
  }

  protected applyPagination(
    query: QueryBuilder,
    pagination: PaginationParams
  ): QueryBuilder {
    // Common pagination application logic
  }

  // Caching utilities
  protected getCacheKey(params: FetchDataParams): string {
    return JSON.stringify(params);
  }

  protected getFromCache(key: string): any {
    const cached = this.cache.get(key);
    return cached ? cached.value : undefined;
  }

  protected setCache(key: string, value: any, ttl?: number): void {
    this.cache.set(key, {
      value: value,
      timestamp: Date.now(),
      ttl: ttl || 300000, // 5 minutes default
    });
  }

  // Event system
  subscribe(callback: (event: DataEvent<TData>) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  protected emit(event: DataEvent<TData>): void {
    this.subscribers.forEach((callback) => callback(event));
  }
}
```

### Query Builder Pattern

```typescript
interface QueryBuilder {
  select(fields: string[]): QueryBuilder;
  from(table: string): QueryBuilder;
  where(condition: string, params?: any[]): QueryBuilder;
  orderBy(field: string, direction: "asc" | "desc"): QueryBuilder;
  limit(count: number): QueryBuilder;
  offset(count: number): QueryBuilder;
  build(): { sql: string; params: any[] };
}
```

## Memory Adapter

### Implementation

```typescript
import { BaseAdapter } from "./base-adapter";
import type {
  TableAdapter,
  FetchDataParams,
  FetchDataResult,
} from "@better-tables/core";

export class MemoryAdapter<TData = any> extends BaseAdapter<TData> {
  private data: TData[] = [];
  private idField: string = "id";

  constructor(config: MemoryAdapterConfig) {
    super(config);
    this.idField = config.idField || "id";
  }

  setData(data: TData[]): void {
    this.data = [...data];
    this.emit({ type: "data_changed", data: this.data });
  }

  addData(item: TData): void {
    this.data.push(item);
    this.emit({ type: "record_created", record: item });
  }

  updateData(id: string, updates: Partial<TData>): void {
    const index = this.data.findIndex((item) => this.getId(item) === id);
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...updates };
      this.emit({ type: "record_updated", record: this.data[index] });
    }
  }

  removeData(id: string): void {
    const index = this.data.findIndex((item) => this.getId(item) === id);
    if (index !== -1) {
      const removed = this.data.splice(index, 1)[0];
      this.emit({ type: "record_deleted", record: removed });
    }
  }

  async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    let filteredData = [...this.data];

    // Apply filters
    if (params.filters) {
      filteredData = this.applyFiltersToData(filteredData, params.filters);
    }

    // Apply sorting
    if (params.sorting) {
      filteredData = this.applySortingToData(filteredData, params.sorting);
    }

    // Apply pagination
    const total = filteredData.length;
    let paginatedData = filteredData;

    if (params.pagination) {
      const { page, limit } = params.pagination;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      paginatedData = filteredData.slice(startIndex, endIndex);
    }

    return {
      data: paginatedData,
      total,
      pagination: params.pagination
        ? {
            page: params.pagination.page,
            limit: params.pagination.limit,
            totalPages: Math.ceil(total / params.pagination.limit),
            hasNext: params.pagination.page * params.pagination.limit < total,
            hasPrev: params.pagination.page > 1,
          }
        : undefined,
    };
  }

  async getFilterOptions(columnId: string): Promise<FilterOption[]> {
    const values = this.data.map((item) => item[columnId]).filter(Boolean);
    const uniqueValues = [...new Set(values)];

    return uniqueValues.map((value) => ({
      value,
      label: String(value),
      count: values.filter((v) => v === value).length,
    }));
  }

  async getFacetedValues(columnId: string): Promise<Map<string, number>> {
    const values = this.data.map((item) => item[columnId]).filter(Boolean);
    const facetMap = new Map<string, number>();

    values.forEach((value) => {
      const key = String(value);
      facetMap.set(key, (facetMap.get(key) || 0) + 1);
    });

    return facetMap;
  }

  async getMinMaxValues(columnId: string): Promise<[number, number]> {
    const values = this.data
      .map((item) => item[columnId])
      .filter((value) => typeof value === "number");

    if (values.length === 0) return [0, 100];

    return [Math.min(...values), Math.max(...values)];
  }

  // CRUD operations
  async createRecord(data: Partial<TData>): Promise<TData> {
    const newRecord = {
      ...data,
      [this.idField]: this.generateId(),
    } as TData;

    this.addData(newRecord);
    return newRecord;
  }

  async updateRecord(id: string, data: Partial<TData>): Promise<TData> {
    this.updateData(id, data);
    const updated = this.data.find((item) => this.getId(item) === id);
    if (!updated) throw new Error("Record not found");
    return updated;
  }

  async deleteRecord(id: string): Promise<void> {
    this.removeData(id);
  }

  async bulkUpdate(ids: string[], data: Partial<TData>): Promise<TData[]> {
    const updated: TData[] = [];

    ids.forEach((id) => {
      const index = this.data.findIndex((item) => this.getId(item) === id);
      if (index !== -1) {
        this.data[index] = { ...this.data[index], ...data };
        updated.push(this.data[index]);
      }
    });

    this.emit({ type: "bulk_updated", records: updated });
    return updated;
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const deleted: TData[] = [];

    ids.forEach((id) => {
      const index = this.data.findIndex((item) => this.getId(item) === id);
      if (index !== -1) {
        deleted.push(this.data[index]);
        this.data.splice(index, 1);
      }
    });

    this.emit({ type: "bulk_deleted", records: deleted });
  }

  // Helper methods
  private getId(item: TData): string {
    return String(item[this.idField]);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private applyFiltersToData(data: TData[], filters: FilterState[]): TData[] {
    return data.filter((item) => {
      return filters.every((filter) => {
        const value = item[filter.columnId];
        return this.evaluateFilter(value, filter);
      });
    });
  }

  private evaluateFilter(value: any, filter: FilterState): boolean {
    // Implementation of filter evaluation logic
    switch (filter.operator) {
      case "equals":
        return value === filter.values[0];
      case "notEquals":
        return value !== filter.values[0];
      case "contains":
        return String(value)
          .toLowerCase()
          .includes(String(filter.values[0]).toLowerCase());
      case "startsWith":
        return String(value)
          .toLowerCase()
          .startsWith(String(filter.values[0]).toLowerCase());
      case "endsWith":
        return String(value)
          .toLowerCase()
          .endsWith(String(filter.values[0]).toLowerCase());
      case "gt":
        return Number(value) > Number(filter.values[0]);
      case "gte":
        return Number(value) >= Number(filter.values[0]);
      case "lt":
        return Number(value) < Number(filter.values[0]);
      case "lte":
        return Number(value) <= Number(filter.values[0]);
      case "between":
        return (
          Number(value) >= Number(filter.values[0]) &&
          Number(value) <= Number(filter.values[1])
        );
      case "in":
        return filter.values.includes(value);
      case "notIn":
        return !filter.values.includes(value);
      case "isNull":
        return value === null || value === undefined;
      case "isNotNull":
        return value !== null && value !== undefined;
      default:
        return true;
    }
  }

  private applySortingToData(data: TData[], sorting: SortingParams[]): TData[] {
    return [...data].sort((a, b) => {
      for (const sort of sorting) {
        const aValue = a[sort.columnId];
        const bValue = b[sort.columnId];

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;

        if (comparison !== 0) {
          return sort.direction === "desc" ? -comparison : comparison;
        }
      }
      return 0;
    });
  }
}
```

### Configuration

```typescript
interface MemoryAdapterConfig extends AdapterConfig {
  /** Field name used as unique identifier */
  idField?: string;
  /** Initial data */
  initialData?: TData[];
  /** Whether to enable real-time updates */
  enableRealtime?: boolean;
}
```

## REST Adapter

### Implementation

```typescript
import { BaseAdapter } from "./base-adapter";
import type {
  TableAdapter,
  FetchDataParams,
  FetchDataResult,
} from "@better-tables/core";

export class RestAdapter<TData = any> extends BaseAdapter<TData> {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(config: RestAdapterConfig) {
    super(config);
    this.baseUrl = config.baseUrl;
    this.headers = config.headers || {};
    this.timeout = config.timeout || 30000;
  }

  async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    const cacheKey = this.getCacheKey(params);
    const cached = this.getFromCache(cacheKey);

    if (cached && !this.isCacheExpired(cacheKey)) {
      return cached;
    }

    try {
      const queryParams = this.buildQueryParams(params);
      const url = `${this.baseUrl}/data?${queryParams}`;

      const response = await this.makeRequest(url, {
        method: "GET",
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Cache the result
      this.setCache(cacheKey, result, this.config.cacheTtl);

      return result;
    } catch (error) {
      throw new Error(`Failed to fetch data: ${error.message}`);
    }
  }

  async getFilterOptions(columnId: string): Promise<FilterOption[]> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/filter-options/${columnId}`,
        {
          method: "GET",
          headers: this.headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get filter options: ${error.message}`);
    }
  }

  async getFacetedValues(columnId: string): Promise<Map<string, number>> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/facets/${columnId}`,
        {
          method: "GET",
          headers: this.headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const facets = await response.json();
      return new Map(Object.entries(facets));
    } catch (error) {
      throw new Error(`Failed to get faceted values: ${error.message}`);
    }
  }

  async getMinMaxValues(columnId: string): Promise<[number, number]> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/minmax/${columnId}`,
        {
          method: "GET",
          headers: this.headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const { min, max } = await response.json();
      return [min, max];
    } catch (error) {
      throw new Error(`Failed to get min/max values: ${error.message}`);
    }
  }

  // CRUD operations
  async createRecord(data: Partial<TData>): Promise<TData> {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/data`, {
        method: "POST",
        headers: {
          ...this.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.emit({ type: "record_created", record: result });
      return result;
    } catch (error) {
      throw new Error(`Failed to create record: ${error.message}`);
    }
  }

  async updateRecord(id: string, data: Partial<TData>): Promise<TData> {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/data/${id}`, {
        method: "PUT",
        headers: {
          ...this.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.emit({ type: "record_updated", record: result });
      return result;
    } catch (error) {
      throw new Error(`Failed to update record: ${error.message}`);
    }
  }

  async deleteRecord(id: string): Promise<void> {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/data/${id}`, {
        method: "DELETE",
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.emit({ type: "record_deleted", recordId: id });
    } catch (error) {
      throw new Error(`Failed to delete record: ${error.message}`);
    }
  }

  async bulkUpdate(ids: string[], data: Partial<TData>): Promise<TData[]> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/data/bulk-update`,
        {
          method: "PUT",
          headers: {
            ...this.headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids, data }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.emit({ type: "bulk_updated", records: result });
      return result;
    } catch (error) {
      throw new Error(`Failed to bulk update records: ${error.message}`);
    }
  }

  async bulkDelete(ids: string[]): Promise<void> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/data/bulk-delete`,
        {
          method: "DELETE",
          headers: {
            ...this.headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.emit({ type: "bulk_deleted", recordIds: ids });
    } catch (error) {
      throw new Error(`Failed to bulk delete records: ${error.message}`);
    }
  }

  // Helper methods
  private buildQueryParams(params: FetchDataParams): string {
    const searchParams = new URLSearchParams();

    if (params.filters) {
      searchParams.set("filters", JSON.stringify(params.filters));
    }

    if (params.pagination) {
      searchParams.set("page", String(params.pagination.page));
      searchParams.set("limit", String(params.pagination.limit));
    }

    if (params.sorting) {
      searchParams.set("sorting", JSON.stringify(params.sorting));
    }

    // Add any additional parameters
    Object.entries(params).forEach(([key, value]) => {
      if (!["filters", "pagination", "sorting"].includes(key)) {
        searchParams.set(key, String(value));
      }
    });

    return searchParams.toString();
  }

  private async makeRequest(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw error;
    }
  }

  private isCacheExpired(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return true;

    const ttl = cached.ttl || this.config.cacheTtl || 300000; // 5 minutes default
    return Date.now() - cached.timestamp > ttl;
  }
}
```

### Configuration

```typescript
interface RestAdapterConfig extends AdapterConfig {
  /** Base URL for the REST API */
  baseUrl: string;
  /** HTTP headers to include with requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Authentication configuration */
  auth?: {
    type: "bearer" | "basic" | "api-key";
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
  };
}
```

## Drizzle Adapter

### Implementation

```typescript
import { BaseAdapter } from "./base-adapter";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, or, gte, lte, like, ilike, inArray, sql } from "drizzle-orm";
import type {
  TableAdapter,
  FetchDataParams,
  FetchDataResult,
} from "@better-tables/core";

export class DrizzleAdapter<TData = any> extends BaseAdapter<TData> {
  private db: any;
  private table: any;
  private schema: any;

  constructor(config: DrizzleAdapterConfig) {
    super(config);
    this.db = drizzle(config.connection);
    this.table = config.table;
    this.schema = config.schema;
  }

  async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    const cacheKey = this.getCacheKey(params);
    const cached = this.getFromCache(cacheKey);

    if (cached && !this.isCacheExpired(cacheKey)) {
      return cached;
    }

    try {
      let query = this.db.select().from(this.table);

      // Apply filters
      if (params.filters) {
        query = this.applyFilters(query, params.filters);
      }

      // Apply sorting
      if (params.sorting) {
        query = this.applySorting(query, params.sorting);
      }

      // Get total count for pagination
      const countQuery = this.db
        .select({ count: sql`count(*)` })
        .from(this.table);
      if (params.filters) {
        countQuery = this.applyFilters(countQuery, params.filters);
      }
      const [{ count: total }] = await countQuery;

      // Apply pagination
      if (params.pagination) {
        const { page, limit } = params.pagination;
        const offset = (page - 1) * limit;
        query = query.limit(limit).offset(offset);
      }

      const data = await query;

      const result = {
        data,
        total: Number(total),
        pagination: params.pagination
          ? {
              page: params.pagination.page,
              limit: params.pagination.limit,
              totalPages: Math.ceil(Number(total) / params.pagination.limit),
              hasNext:
                params.pagination.page * params.pagination.limit <
                Number(total),
              hasPrev: params.pagination.page > 1,
            }
          : undefined,
      };

      // Cache the result
      this.setCache(cacheKey, result, this.config.cacheTtl);

      return result;
    } catch (error) {
      throw new Error(`Failed to fetch data: ${error.message}`);
    }
  }

  async getFilterOptions(columnId: string): Promise<FilterOption[]> {
    try {
      const column = this.table[columnId];
      if (!column) {
        throw new Error(`Column ${columnId} not found`);
      }

      const query = this.db
        .select({
          value: column,
          count: sql`count(*)`,
        })
        .from(this.table)
        .where(sql`${column} IS NOT NULL`)
        .groupBy(column)
        .orderBy(column);

      const results = await query;

      return results.map((row) => ({
        value: row.value,
        label: String(row.value),
        count: Number(row.count),
      }));
    } catch (error) {
      throw new Error(`Failed to get filter options: ${error.message}`);
    }
  }

  async getFacetedValues(columnId: string): Promise<Map<string, number>> {
    try {
      const column = this.table[columnId];
      if (!column) {
        throw new Error(`Column ${columnId} not found`);
      }

      const query = this.db
        .select({
          value: column,
          count: sql`count(*)`,
        })
        .from(this.table)
        .where(sql`${column} IS NOT NULL`)
        .groupBy(column);

      const results = await query;
      const facetMap = new Map<string, number>();

      results.forEach((row) => {
        facetMap.set(String(row.value), Number(row.count));
      });

      return facetMap;
    } catch (error) {
      throw new Error(`Failed to get faceted values: ${error.message}`);
    }
  }

  async getMinMaxValues(columnId: string): Promise<[number, number]> {
    try {
      const column = this.table[columnId];
      if (!column) {
        throw new Error(`Column ${columnId} not found`);
      }

      const query = this.db
        .select({
          min: sql`min(${column})`,
          max: sql`max(${column})`,
        })
        .from(this.table)
        .where(sql`${column} IS NOT NULL`);

      const [result] = await query;

      return [
        result.min ? Number(result.min) : 0,
        result.max ? Number(result.max) : 100,
      ];
    } catch (error) {
      throw new Error(`Failed to get min/max values: ${error.message}`);
    }
  }

  // CRUD operations
  async createRecord(data: Partial<TData>): Promise<TData> {
    try {
      const [result] = await this.db
        .insert(this.table)
        .values(data)
        .returning();

      this.emit({ type: "record_created", record: result });
      return result;
    } catch (error) {
      throw new Error(`Failed to create record: ${error.message}`);
    }
  }

  async updateRecord(id: string, data: Partial<TData>): Promise<TData> {
    try {
      const [result] = await this.db
        .update(this.table)
        .set(data)
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error("Record not found");
      }

      this.emit({ type: "record_updated", record: result });
      return result;
    } catch (error) {
      throw new Error(`Failed to update record: ${error.message}`);
    }
  }

  async deleteRecord(id: string): Promise<void> {
    try {
      const [result] = await this.db
        .delete(this.table)
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error("Record not found");
      }

      this.emit({ type: "record_deleted", record: result });
    } catch (error) {
      throw new Error(`Failed to delete record: ${error.message}`);
    }
  }

  async bulkUpdate(ids: string[], data: Partial<TData>): Promise<TData[]> {
    try {
      const results = await this.db
        .update(this.table)
        .set(data)
        .where(inArray(this.table.id, ids))
        .returning();

      this.emit({ type: "bulk_updated", records: results });
      return results;
    } catch (error) {
      throw new Error(`Failed to bulk update records: ${error.message}`);
    }
  }

  async bulkDelete(ids: string[]): Promise<void> {
    try {
      const results = await this.db
        .delete(this.table)
        .where(inArray(this.table.id, ids))
        .returning();

      this.emit({ type: "bulk_deleted", records: results });
    } catch (error) {
      throw new Error(`Failed to bulk delete records: ${error.message}`);
    }
  }

  // Helper methods
  private applyFilters(query: any, filters: FilterState[]): any {
    const conditions = filters.map((filter) => {
      const column = this.table[filter.columnId];
      if (!column) {
        throw new Error(`Column ${filter.columnId} not found`);
      }

      switch (filter.operator) {
        case "equals":
          return eq(column, filter.values[0]);
        case "notEquals":
          return sql`${column} != ${filter.values[0]}`;
        case "contains":
          return ilike(column, `%${filter.values[0]}%`);
        case "startsWith":
          return ilike(column, `${filter.values[0]}%`);
        case "endsWith":
          return ilike(column, `%${filter.values[0]}`);
        case "gt":
          return sql`${column} > ${filter.values[0]}`;
        case "gte":
          return gte(column, filter.values[0]);
        case "lt":
          return sql`${column} < ${filter.values[0]}`;
        case "lte":
          return lte(column, filter.values[0]);
        case "between":
          return and(
            gte(column, filter.values[0]),
            lte(column, filter.values[1])
          );
        case "in":
          return inArray(column, filter.values);
        case "notIn":
          return sql`${column} NOT IN ${filter.values}`;
        case "isNull":
          return sql`${column} IS NULL`;
        case "isNotNull":
          return sql`${column} IS NOT NULL`;
        default:
          return sql`1=1`;
      }
    });

    return query.where(and(...conditions));
  }

  private applySorting(query: any, sorting: SortingParams[]): any {
    return query.orderBy(
      ...sorting.map((sort) => {
        const column = this.table[sort.columnId];
        if (!column) {
          throw new Error(`Column ${sort.columnId} not found`);
        }

        return sort.direction === "desc"
          ? sql`${column} DESC`
          : sql`${column} ASC`;
      })
    );
  }
}
```

### Configuration

```typescript
interface DrizzleAdapterConfig extends AdapterConfig {
  /** Database connection */
  connection: any;
  /** Drizzle table schema */
  table: any;
  /** Database schema */
  schema?: any;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Connection pool configuration */
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
  };
}
```

## Custom Adapter Development

### Creating a Custom Adapter

```typescript
import { BaseAdapter } from "@better-tables/adapters";
import type {
  TableAdapter,
  FetchDataParams,
  FetchDataResult,
} from "@better-tables/core";

export class CustomAdapter<TData = any> extends BaseAdapter<TData> {
  constructor(config: CustomAdapterConfig) {
    super(config);
  }

  async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    // Implement your custom data fetching logic
    const data = await this.customFetchMethod(params);

    return {
      data,
      total: data.length,
      pagination: this.buildPaginationInfo(params, data.length),
    };
  }

  async getFilterOptions(columnId: string): Promise<FilterOption[]> {
    // Implement your custom filter options logic
    return this.customGetFilterOptions(columnId);
  }

  // Implement other required methods...

  private async customFetchMethod(params: FetchDataParams): Promise<TData[]> {
    // Your custom implementation
  }

  private async customGetFilterOptions(
    columnId: string
  ): Promise<FilterOption[]> {
    // Your custom implementation
  }
}
```

### Adapter Testing

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryAdapter } from "@better-tables/adapters/memory";

describe("MemoryAdapter", () => {
  let adapter: MemoryAdapter<TestData>;

  beforeEach(() => {
    adapter = new MemoryAdapter({
      name: "test-adapter",
      version: "1.0.0",
      features: {
        filtering: true,
        sorting: true,
        pagination: true,
        realtime: true,
        crud: true,
        bulk: true,
        export: false,
        faceted: true,
      },
      config: {},
    });

    adapter.setData([
      { id: "1", name: "John", age: 30, email: "john@example.com" },
      { id: "2", name: "Jane", age: 25, email: "jane@example.com" },
      { id: "3", name: "Bob", age: 35, email: "bob@example.com" },
    ]);
  });

  it("should fetch data without filters", async () => {
    const result = await adapter.fetchData({});

    expect(result.data).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it("should apply text filters", async () => {
    const result = await adapter.fetchData({
      filters: [
        {
          columnId: "name",
          type: "text",
          operator: "contains",
          values: ["John"],
        },
      ],
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("John");
  });

  it("should apply number filters", async () => {
    const result = await adapter.fetchData({
      filters: [
        {
          columnId: "age",
          type: "number",
          operator: "gte",
          values: [30],
        },
      ],
    });

    expect(result.data).toHaveLength(2);
    expect(result.data.every((item) => item.age >= 30)).toBe(true);
  });

  it("should apply pagination", async () => {
    const result = await adapter.fetchData({
      pagination: { page: 1, limit: 2 },
    });

    expect(result.data).toHaveLength(2);
    expect(result.pagination?.hasNext).toBe(true);
    expect(result.pagination?.hasPrev).toBe(false);
  });

  it("should apply sorting", async () => {
    const result = await adapter.fetchData({
      sorting: [{ columnId: "age", direction: "desc" }],
    });

    expect(result.data[0].age).toBe(35);
    expect(result.data[1].age).toBe(30);
    expect(result.data[2].age).toBe(25);
  });

  it("should get filter options", async () => {
    const options = await adapter.getFilterOptions("name");

    expect(options).toHaveLength(3);
    expect(options.map((opt) => opt.value)).toContain("John");
  });

  it("should create records", async () => {
    const newRecord = await adapter.createRecord({
      name: "Alice",
      age: 28,
      email: "alice@example.com",
    });

    expect(newRecord.name).toBe("Alice");
    expect(newRecord.id).toBeDefined();
  });

  it("should update records", async () => {
    const updated = await adapter.updateRecord("1", { age: 31 });

    expect(updated.age).toBe(31);
    expect(updated.name).toBe("John");
  });

  it("should delete records", async () => {
  private async fetchDataInBatches(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    const batchSize = 1000;
    const batches = Math.ceil(params.pagination!.limit / batchSize);
    const results: TData[] = [];

    for (let i = 0; i < batches; i++) {
      const offset = (params.pagination!.page - 1) * params.pagination!.limit + i * batchSize;
      const batchParams = {
        ...params,
        pagination: {
          page: Math.floor(offset / batchSize) + 1,
          limit: Math.min(batchSize, params.pagination!.limit - i * batchSize),
        },
      };

      const batchResult = await super.fetchData(batchParams);
      results.push(...batchResult.data);
    }

    return {
      data: results,
      total: results.length,
      pagination: params.pagination ? {
        page: params.pagination.page,
        limit: params.pagination.limit,
        totalPages: Math.ceil(results.length / params.pagination.limit),
        hasNext: false,
        hasPrev: params.pagination.page > 1,
      } : undefined,
    };
  }
  }

  protected setCache(key: string, value: any, ttl: number = 300000): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
    });
  }

  // Implement cache invalidation
  protected invalidateCache(pattern?: string): void {
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}
```

### Query Optimization

```typescript
// Optimize queries for large datasets
class OptimizedDrizzleAdapter<TData = any> extends DrizzleAdapter<TData> {
  async fetchData(params: FetchDataParams): Promise<FetchDataResult<TData>> {
    // Use prepared statements for better performance
    const preparedQuery = this.db.select().from(this.table).prepare();

    // Implement query batching for large result sets
    if (params.pagination && params.pagination.limit > 1000) {
      return this.fetchDataInBatches(params);
    }

    return super.fetchData(params);
  }

  private async fetchDataInBatches(
    params: FetchDataParams
  ): Promise<FetchDataResult<TData>> {
    const batchSize = 1000;
    const batches = Math.ceil(params.pagination!.limit / batchSize);
    const results: TData[] = [];

    for (let i = 0; i < batches; i++) {
      const batchParams = {
        ...params,
        pagination: {
          ...params.pagination!,
          page: params.pagination!.page + i,
          limit: Math.min(batchSize, params.pagination!.limit - i * batchSize),
        },
      };

      const batchResult = await super.fetchData(batchParams);
      results.push(...batchResult.data);
    }

    return {
      data: results,
      total: results.length,
      pagination: params.pagination
        ? {
            page: params.pagination.page,
            limit: params.pagination.limit,
            totalPages: Math.ceil(results.length / params.pagination.limit),
            hasNext: false,
            hasPrev: params.pagination.page > 1,
          }
        : undefined,
    };
  }
}
```

## Related Documentation

- [Core Types API Reference](../core/TYPES_API_REFERENCE.md)
- [Core Managers API Reference](../core/MANAGERS_API_REFERENCE.md)
- [Filter Components Reference](../ui/FILTER_COMPONENTS_REFERENCE.md)
- [Table Components Reference](../ui/TABLE_COMPONENTS_REFERENCE.md)
- [Hooks Reference](../ui/HOOKS_REFERENCE.md)
