# @better-tables/core - Utilities API Reference

## Overview

The Better Tables core package provides utility functions for common operations including filter serialization, URL state persistence, and data transformation. These utilities are designed to work seamlessly with the manager system and provide robust, production-ready functionality.

## Table of Contents

- [Filter Serialization](#filter-serialization)
- [URL State Persistence](#url-state-persistence)
- [Data Transformation](#data-transformation)
- [Validation Utilities](#validation-utilities)
- [Performance Utilities](#performance-utilities)
- [Integration Examples](#integration-examples)

## Filter Serialization

The `FilterURLSerializer` class provides comprehensive serialization and deserialization of filter states for URL persistence and sharing.

### API

```typescript
class FilterURLSerializer {
  // Core serialization
  static serialize(
    filters: FilterState[],
    options?: URLSerializationOptions,
  ): URLSerializationResult;
  static deserialize(urlString: string): FilterState[];

  // URL operations
  static getFromURL(options?: Pick<URLSerializationOptions, 'paramName'>): FilterState[];
  static setInURL(filters: FilterState[], options?: URLSerializationOptions): void;
  static createShareableURL(
    filters: FilterState[],
    baseURL?: string,
    options?: URLSerializationOptions,
  ): string;

  // Validation and info
  static validate(urlString: string): boolean;
  static getSerializationInfo(
    filters: FilterState[],
    options?: URLSerializationOptions,
  ): SerializationInfo;
}
```

### Options

```typescript
interface URLSerializationOptions {
  paramName?: string; // URL parameter name (default: 'filters')
  compress?: boolean; // Enable compression (default: true)
  includeMeta?: boolean; // Include metadata (default: false)
  maxLength?: number; // Max URL length before compression (default: 2000)
}

interface URLSerializationResult {
  value: string; // Serialized string
  compressed: boolean; // Whether compression was applied
  size: number; // Size of the result
}
```

### Usage Examples

#### Basic Serialization

```typescript
import { FilterURLSerializer } from '@better-tables/core';

const filters = [
  {
    columnId: 'name',
    type: 'text',
    operator: 'contains',
    values: ['john'],
  },
  {
    columnId: 'age',
    type: 'number',
    operator: 'greaterThan',
    values: [18],
  },
];

// Serialize filters
const result = FilterURLSerializer.serialize(filters);
console.log('Serialized:', result.value);
// Output: "eyJjIjoibmFtZSIsInQiOiJ0ZXh0IiwibyI6ImNvbnRhaW5zIiwidiI6WyJqb2huIl19LCJjIjoiYWdlIiwidCI6Im51bWJlciIsIm8iOiJncmVhdGVyVGhhbiIsInYiOlsxOF19"

// Deserialize filters
const deserialized = FilterURLSerializer.deserialize(result.value);
console.log('Deserialized:', deserialized);
// Output: [original filter objects]
```

#### URL State Management

```typescript
// Get filters from current URL
const urlFilters = FilterURLSerializer.getFromURL();
console.log('URL filters:', urlFilters);

// Set filters in URL
FilterURLSerializer.setInURL(filters);
// URL is now: /table?filters=eyJjIjoibmFtZSIsInQiOiJ0ZXh0IiwibyI6ImNvbnRhaW5zIiwidiI6WyJqb2huIl19...

// Create shareable URL
const shareableURL = FilterURLSerializer.createShareableURL(filters, 'https://example.com/table');
console.log('Shareable URL:', shareableURL);
```

#### Advanced Options

```typescript
// Serialize with custom options
const result = FilterURLSerializer.serialize(filters, {
  paramName: 'q', // Use 'q' instead of 'filters'
  compress: true, // Enable compression
  includeMeta: true, // Include metadata
  maxLength: 1500, // Compress if longer than 1500 chars
});

console.log('Compressed:', result.compressed);
console.log('Size:', result.size);

// Get serialization info without serializing
const info = FilterURLSerializer.getSerializationInfo(filters);
console.log('Estimated size:', info.estimatedSize);
console.log('Would compress:', info.wouldCompress);
console.log('Filter count:', info.filterCount);
```

#### Validation

```typescript
// Validate URL string
const isValid = FilterURLSerializer.validate(urlString);
if (!isValid) {
  console.error('Invalid filter URL');
  return;
}

// Safe deserialization with error handling
try {
  const filters = FilterURLSerializer.deserialize(urlString);
  console.log('Valid filters:', filters);
} catch (error) {
  console.error('Failed to deserialize:', error.message);
  // Handle error gracefully
}
```

### Compression Details

The serializer uses intelligent compression to minimize URL length:

1. **Key Shortening**: Replaces long property names with single letters

   - `columnId` → `c`
   - `type` → `t`
   - `operator` → `o`
   - `values` → `v`
   - `includeNull` → `n`
   - `meta` → `m`

2. **lz-string Compression**: Compresses data using lz-string (URL-safe)
3. **Automatic Compression**: Always applies compression for optimal URL length

#### Compression Example

```typescript
// Original filter
const filter = {
  columnId: 'name',
  type: 'text',
  operator: 'contains',
  values: ['john'],
  includeNull: false,
  meta: { source: 'search' },
};

// Uncompressed serialization
const uncompressed = FilterURLSerializer.serialize([filter], { compress: false });
console.log('Uncompressed:', uncompressed.value);
// Length: ~120 characters

// Compressed serialization
const compressed = FilterURLSerializer.serialize([filter], { compress: true });
console.log('Compressed:', compressed.value);
// Length: ~80 characters (33% reduction)
```

## URL State Persistence

### React Hook Integration

```typescript
import { useState, useEffect } from 'react';
import { FilterURLSerializer } from '@better-tables/core';

function useURLFilters(initialFilters: FilterState[] = []) {
  const [filters, setFilters] = useState<FilterState[]>(() => {
    // Initialize from URL or use initial filters
    return FilterURLSerializer.getFromURL().length > 0
      ? FilterURLSerializer.getFromURL()
      : initialFilters;
  });

  // Update URL when filters change
  useEffect(() => {
    FilterURLSerializer.setInURL(filters);
  }, [filters]);

  return [filters, setFilters] as const;
}

// Usage in component
function TableComponent() {
  const [filters, setFilters] = useURLFilters();

  const handleFilterChange = (newFilters: FilterState[]) => {
    setFilters(newFilters);
  };

  return <Table filters={filters} onFiltersChange={handleFilterChange} />;
}
```

### Next.js Integration

```typescript
// pages/table.tsx
import { GetServerSideProps } from 'next';
import { FilterURLSerializer } from '@better-tables/core';

export const getServerSideProps: GetServerSideProps = async context => {
  const { query } = context;

  // Get filters from URL query
  const filterParam = query.filters as string;
  let initialFilters: FilterState[] = [];

  if (filterParam) {
    try {
      initialFilters = FilterURLSerializer.deserialize(filterParam);
    } catch (error) {
      console.warn('Invalid filters in URL:', error);
    }
  }

  return {
    props: {
      initialFilters,
    },
  };
};

function TablePage({ initialFilters }: { initialFilters: FilterState[] }) {
  return <Table initialFilters={initialFilters} />;
}
```

### URL State Manager

```typescript
class URLStateManager {
  private paramName: string;
  private updateCallback?: (filters: FilterState[]) => void;

  constructor(paramName = 'filters') {
    this.paramName = paramName;
    this.setupPopstateListener();
  }

  private setupPopstateListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        this.notifyFiltersChanged();
      });
    }
  }

  getFilters(): FilterState[] {
    return FilterURLSerializer.getFromURL({ paramName: this.paramName });
  }

  setFilters(filters: FilterState[]): void {
    FilterURLSerializer.setInURL(filters, { paramName: this.paramName });
    this.notifyFiltersChanged();
  }

  createShareableURL(filters: FilterState[]): string {
    return FilterURLSerializer.createShareableURL(filters, undefined, {
      paramName: this.paramName,
    });
  }

  onFiltersChange(callback: (filters: FilterState[]) => void): void {
    this.updateCallback = callback;
  }

  private notifyFiltersChanged(): void {
    if (this.updateCallback) {
      const filters = this.getFilters();
      this.updateCallback(filters);
    }
  }
}

// Usage
const urlManager = new URLStateManager('table-filters');
urlManager.onFiltersChange(filters => {
  console.log('URL filters changed:', filters);
});
```

## Data Transformation

### Filter State Conversion

```typescript
// Convert between different filter formats
function convertLegacyFilters(legacyFilters: any[]): FilterState[] {
  return legacyFilters.map(filter => ({
    columnId: filter.field || filter.column,
    type: filter.type || 'text',
    operator: filter.operator || 'equals',
    values: Array.isArray(filter.value) ? filter.value : [filter.value],
    includeNull: filter.includeNull || false,
    meta: filter.meta || {},
  }));
}

// Convert to API format
function convertToAPIFormat(filters: FilterState[]): any[] {
  return filters.map(filter => ({
    field: filter.columnId,
    operator: filter.operator,
    value: filter.values.length === 1 ? filter.values[0] : filter.values,
    type: filter.type,
    includeNull: filter.includeNull,
  }));
}
```

### Data Validation

```typescript
// Validate filter state
function validateFilterState(filter: FilterState): { valid: boolean; error?: string } {
  if (!filter.columnId) {
    return { valid: false, error: 'Column ID is required' };
  }

  if (!filter.type) {
    return { valid: false, error: 'Filter type is required' };
  }

  if (!filter.operator) {
    return { valid: false, error: 'Filter operator is required' };
  }

  if (!Array.isArray(filter.values)) {
    return { valid: false, error: 'Filter values must be an array' };
  }

  return { valid: true };
}

// Validate multiple filters
function validateFilters(filters: FilterState[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  filters.forEach((filter, index) => {
    const validation = validateFilterState(filter);
    if (!validation.valid) {
      errors.push(`Filter ${index}: ${validation.error}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

## Performance Utilities

### Debounced Updates

```typescript
// Debounce filter updates for performance
function createDebouncedFilterUpdate(updateFn: (filters: FilterState[]) => void, delay = 300) {
  let timeoutId: NodeJS.Timeout;

  return (filters: FilterState[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      updateFn(filters);
    }, delay);
  };
}

// Usage
const debouncedUpdate = createDebouncedFilterUpdate(filters => {
  // Update table or make API call
  updateTable(filters);
});

// Call frequently - only last call will execute
debouncedUpdate(filters1);
debouncedUpdate(filters2);
debouncedUpdate(filters3); // Only this will execute after delay
```

### Batch Operations

```typescript
// Batch multiple filter operations
class FilterBatch {
  private operations: (() => void)[] = [];
  private timeoutId?: NodeJS.Timeout;

  add(operation: () => void): void {
    this.operations.push(operation);
    this.scheduleExecution();
  }

  private scheduleExecution(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.execute();
    }, 0); // Execute on next tick
  }

  private execute(): void {
    const operations = [...this.operations];
    this.operations = [];

    operations.forEach(op => op());
  }
}

// Usage
const batch = new FilterBatch();

batch.add(() => filterManager.addFilter(filter1));
batch.add(() => filterManager.addFilter(filter2));
batch.add(() => sortingManager.addSort('name', 'asc'));
// All operations execute together
```

## Integration Examples

### Complete URL State Management

```typescript
import { FilterManager, FilterURLSerializer } from '@better-tables/core';

class TableWithURLState {
  private filterManager: FilterManager;
  private urlManager: URLStateManager;

  constructor(columns: ColumnDefinition[]) {
    this.filterManager = new FilterManager(columns);
    this.urlManager = new URLStateManager();

    this.setupURLSync();
  }

  private setupURLSync() {
    // Load initial filters from URL
    const urlFilters = this.urlManager.getFilters();
    if (urlFilters.length > 0) {
      this.filterManager.setFilters(urlFilters);
    }

    // Sync filter changes to URL
    this.filterManager.subscribe(event => {
      const filters = this.filterManager.getFilters();
      this.urlManager.setFilters(filters);
    });

    // Sync URL changes to filters
    this.urlManager.onFiltersChange(filters => {
      this.filterManager.setFilters(filters);
    });
  }

  getFilterManager(): FilterManager {
    return this.filterManager;
  }

  createShareableURL(): string {
    const filters = this.filterManager.getFilters();
    return this.urlManager.createShareableURL(filters);
  }
}
```

### React Context Integration

```typescript
import React, { createContext, useContext, useReducer } from 'react';
import { FilterManager, FilterURLSerializer } from '@better-tables/core';

interface FilterContextType {
  filterManager: FilterManager;
  urlManager: URLStateManager;
  createShareableURL: () => string;
}

const FilterContext = createContext<FilterContextType | null>(null);

export function FilterProvider({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns: ColumnDefinition[];
}) {
  const filterManager = useMemo(() => new FilterManager(columns), [columns]);
  const urlManager = useMemo(() => new URLStateManager(), []);

  const createShareableURL = useCallback(() => {
    const filters = filterManager.getFilters();
    return urlManager.createShareableURL(filters);
  }, [filterManager, urlManager]);

  const value = {
    filterManager,
    urlManager,
    createShareableURL,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextType {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
}
```

### Error Handling and Recovery

```typescript
class RobustFilterManager {
  private filterManager: FilterManager;
  private fallbackFilters: FilterState[] = [];

  constructor(columns: ColumnDefinition[]) {
    this.filterManager = new FilterManager(columns);
  }

  loadFromURL(urlString: string): boolean {
    try {
      const filters = FilterURLSerializer.deserialize(urlString);

      // Validate filters before applying
      const validation = this.validateFilters(filters);
      if (!validation.valid) {
        console.warn('Invalid filters in URL:', validation.errors);
        return false;
      }

      this.filterManager.setFilters(filters);
      this.fallbackFilters = [...filters];
      return true;
    } catch (error) {
      console.error('Failed to load filters from URL:', error);

      // Restore fallback filters
      if (this.fallbackFilters.length > 0) {
        this.filterManager.setFilters(this.fallbackFilters);
      }

      return false;
    }
  }

  saveToURL(): string {
    try {
      const filters = this.filterManager.getFilters();
      const result = FilterURLSerializer.serialize(filters);

      // Update fallback on successful save
      this.fallbackFilters = [...filters];

      return result.value;
    } catch (error) {
      console.error('Failed to save filters to URL:', error);
      throw error;
    }
  }

  private validateFilters(filters: FilterState[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    filters.forEach((filter, index) => {
      if (!filter.columnId) {
        errors.push(`Filter ${index}: Missing column ID`);
      }
      if (!filter.operator) {
        errors.push(`Filter ${index}: Missing operator`);
      }
      if (!Array.isArray(filter.values)) {
        errors.push(`Filter ${index}: Values must be array`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

## Best Practices

### 1. URL Length Management

```typescript
// Monitor URL length and compress when needed
function createSmartSerializer() {
  return {
    serialize: (filters: FilterState[]) => {
      const result = FilterURLSerializer.serialize(filters, {
        compress: true,
        maxLength: 1500, // Conservative limit
      });

      if (result.size > 2000) {
        console.warn('URL is very long, consider reducing filters');
      }

      return result;
    },

    deserialize: FilterURLSerializer.deserialize,
  };
}
```

### 2. Error Recovery

```typescript
// Graceful error handling
function safeDeserialize(urlString: string): FilterState[] {
  try {
    return FilterURLSerializer.deserialize(urlString);
  } catch (error) {
    console.error('Failed to deserialize filters:', error);

    // Return empty array as fallback
    return [];
  }
}
```

### 3. Performance Optimization

```typescript
// Debounce URL updates
const debouncedURLUpdate = debounce((filters: FilterState[]) => {
  FilterURLSerializer.setInURL(filters);
}, 500);

// Use in filter manager subscription
filterManager.subscribe(() => {
  const filters = filterManager.getFilters();
  debouncedURLUpdate(filters);
});
```

## Related Documentation

- [Types API Reference](./TYPES_API_REFERENCE.md)
- [Column Builders Guide](./COLUMN_BUILDERS_GUIDE.md)
- [Managers API Reference](./MANAGERS_API_REFERENCE.md)
- [Adapter Development](./ADAPTER_DEVELOPMENT.md)
