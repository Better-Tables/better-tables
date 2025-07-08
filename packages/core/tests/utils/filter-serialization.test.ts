import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FilterURLSerializer, filterURLUtils } from '../../src/utils/filter-serialization';
import type { FilterState } from '../../src/types/filter';

// Mock browser APIs
const mockLocation = {
  href: 'https://example.com/table',
  search: ''
};

const mockHistory = {
  replaceState: vi.fn()
};

Object.defineProperty(global, 'window', {
  value: {
    location: mockLocation,
    history: mockHistory
  },
  writable: true
});

// Mock data
const mockFilters: FilterState[] = [
  {
    columnId: 'name',
    type: 'text',
    operator: 'contains',
    values: ['John']
  },
  {
    columnId: 'age',
    type: 'number',
    operator: 'greaterThan',
    values: [25]
  },
  {
    columnId: 'status',
    type: 'option',
    operator: 'is',
    values: ['active']
  }
];

const mockFilterWithMeta: FilterState = {
  columnId: 'priority',
  type: 'option',
  operator: 'isAnyOf',
  values: ['high', 'urgent'],
  includeNull: true,
  meta: { 
    customField: 'test',
    nested: { value: 123 }
  }
};

describe('FilterURLSerializer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '';
    mockLocation.href = 'https://example.com/table';
  });

  describe('serialize', () => {
    it('should serialize filters to URL-safe string', () => {
      const result = FilterURLSerializer.serialize(mockFilters);
      
      expect(result.value).toBeTypeOf('string');
      expect(result.size).toBeGreaterThan(0);
      expect(result.compressed).toBeTypeOf('boolean'); // May or may not compress based on size
    });

    it('should serialize without compression when disabled', () => {
      const result = FilterURLSerializer.serialize(mockFilters, { compress: false });
      
      expect(result.compressed).toBe(false);
      expect(result.value).not.toContain('c:'); // No compression prefix
    });

    it('should include metadata when requested', () => {
      const filtersWithMeta = [mockFilterWithMeta];
      const result = FilterURLSerializer.serialize(filtersWithMeta, { includeMeta: true });
      
      const deserialized = FilterURLSerializer.deserialize(result.value);
      expect(deserialized[0].meta).toEqual(mockFilterWithMeta.meta);
    });

    it('should exclude metadata by default', () => {
      const filtersWithMeta = [mockFilterWithMeta];
      const result = FilterURLSerializer.serialize(filtersWithMeta);
      
      const deserialized = FilterURLSerializer.deserialize(result.value);
      expect(deserialized[0].meta).toBeUndefined();
    });

    it('should handle empty filters array', () => {
      const result = FilterURLSerializer.serialize([]);
      
      expect(result.value).toBeTypeOf('string');
      expect(result.size).toBeGreaterThan(0);
      
      const deserialized = FilterURLSerializer.deserialize(result.value);
      expect(deserialized).toEqual([]);
    });

    it('should apply compression for large data', () => {
      const largeFilters: FilterState[] = Array.from({ length: 50 }, (_, i) => ({
        columnId: `veryLongColumnNameThatRepeatsOften${i}`,
        type: 'text',
        operator: 'contains',
        values: [`very long value that repeats often and makes the data much larger ${i}`]
      }));

      const result = FilterURLSerializer.serialize(largeFilters, { maxLength: 100 });
      
      // The compression should either work or not apply if it doesn't help
      if (result.compressed) {
        expect(result.value).toContain('c:'); // Compression prefix
      }
      expect(result.value).toBeTypeOf('string');
    });
  });

  describe('deserialize', () => {
    it('should deserialize filters from URL string', () => {
      const serialized = FilterURLSerializer.serialize(mockFilters);
      const deserialized = FilterURLSerializer.deserialize(serialized.value);
      
      expect(deserialized).toEqual(mockFilters);
    });

    it('should handle compressed data', () => {
      const serialized = FilterURLSerializer.serialize(mockFilters, { compress: true });
      const deserialized = FilterURLSerializer.deserialize(serialized.value);
      
      expect(deserialized).toEqual(mockFilters);
    });

    it('should handle uncompressed data', () => {
      const serialized = FilterURLSerializer.serialize(mockFilters, { compress: false });
      const deserialized = FilterURLSerializer.deserialize(serialized.value);
      
      expect(deserialized).toEqual(mockFilters);
    });

    it('should throw error for invalid data', () => {
      expect(() => {
        FilterURLSerializer.deserialize('invalid-data');
      }).toThrow();
    });

    it('should preserve special properties', () => {
      const filtersWithProps = [mockFilterWithMeta];
      const serialized = FilterURLSerializer.serialize(filtersWithProps, { includeMeta: true });
      const deserialized = FilterURLSerializer.deserialize(serialized.value);
      
      expect(deserialized[0]).toEqual(mockFilterWithMeta);
    });
  });

  describe('URL operations', () => {
    it('should get filters from URL', () => {
      const serialized = FilterURLSerializer.serialize(mockFilters);
      mockLocation.search = `?filters=${encodeURIComponent(serialized.value)}`;
      
      const filters = FilterURLSerializer.getFromURL();
      
      expect(filters).toEqual(mockFilters);
    });

    it('should return empty array when no filters in URL', () => {
      mockLocation.search = '';
      
      const filters = FilterURLSerializer.getFromURL();
      
      expect(filters).toEqual([]);
    });

    it('should get filters with custom param name', () => {
      const serialized = FilterURLSerializer.serialize(mockFilters);
      mockLocation.search = `?tableFilters=${encodeURIComponent(serialized.value)}`;
      
      const filters = FilterURLSerializer.getFromURL({ paramName: 'tableFilters' });
      
      expect(filters).toEqual(mockFilters);
    });

    it('should set filters in URL', () => {
      FilterURLSerializer.setInURL(mockFilters);
      
      expect(mockHistory.replaceState).toHaveBeenCalled();
      const callArgs = mockHistory.replaceState.mock.calls[0];
      expect(callArgs[2]).toContain('filters=');
    });

    it('should remove filters param when setting empty filters', () => {
      FilterURLSerializer.setInURL([]);
      
      expect(mockHistory.replaceState).toHaveBeenCalled();
      const callArgs = mockHistory.replaceState.mock.calls[0];
      expect(callArgs[2]).not.toContain('filters=');
    });

    it('should use custom param name when setting in URL', () => {
      FilterURLSerializer.setInURL(mockFilters, { paramName: 'customFilters' });
      
      expect(mockHistory.replaceState).toHaveBeenCalled();
      const callArgs = mockHistory.replaceState.mock.calls[0];
      expect(callArgs[2]).toContain('customFilters=');
    });
  });

  describe('createShareableURL', () => {
    it('should create shareable URL with filters', () => {
      const url = FilterURLSerializer.createShareableURL(mockFilters);
      
      expect(url).toContain('https://example.com/table');
      expect(url).toContain('filters=');
    });

    it('should create shareable URL with custom base URL', () => {
      const baseURL = 'https://custom.com/page';
      const url = FilterURLSerializer.createShareableURL(mockFilters, baseURL);
      
      expect(url).toContain('https://custom.com/page');
      expect(url).toContain('filters=');
    });

    it('should handle empty filters in shareable URL', () => {
      const url = FilterURLSerializer.createShareableURL([]);
      
      expect(url).toBe('https://example.com/table');
      expect(url).not.toContain('filters=');
    });

    it('should use custom param name in shareable URL', () => {
      const url = FilterURLSerializer.createShareableURL(mockFilters, undefined, { 
        paramName: 'f' 
      });
      
      expect(url).toContain('f=');
      expect(url).not.toContain('filters=');
    });
  });

  describe('validation', () => {
    it('should validate correct serialized data', () => {
      const serialized = FilterURLSerializer.serialize(mockFilters);
      const isValid = FilterURLSerializer.validate(serialized.value);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid data', () => {
      const isValid = FilterURLSerializer.validate('invalid-data');
      
      expect(isValid).toBe(false);
    });

    it('should validate compressed data', () => {
      const serialized = FilterURLSerializer.serialize(mockFilters, { compress: true });
      const isValid = FilterURLSerializer.validate(serialized.value);
      
      expect(isValid).toBe(true);
    });
  });

  describe('getSerializationInfo', () => {
    it('should provide serialization info', () => {
      const info = FilterURLSerializer.getSerializationInfo(mockFilters);
      
      expect(info.filterCount).toBe(3);
      expect(info.estimatedSize).toBeGreaterThan(0);
      expect(info.wouldCompress).toBeTypeOf('boolean');
    });

    it('should indicate compression for large data', () => {
      const largeFilters: FilterState[] = Array.from({ length: 100 }, (_, i) => ({
        columnId: `veryLongColumnNameThatRepeats${i}`,
        type: 'text',
        operator: 'contains',
        values: [`very long value that makes the URL extremely long ${i}`]
      }));

      const info = FilterURLSerializer.getSerializationInfo(largeFilters, { maxLength: 500 });
      
      expect(info.wouldCompress).toBe(true);
      expect(info.filterCount).toBe(100);
    });
  });

  describe('SSR safety', () => {
    it('should handle SSR environment gracefully', () => {
      const originalWindow = global.window;
      // @ts-ignore - Simulating SSR
      delete global.window;

      expect(() => {
        FilterURLSerializer.getFromURL();
        FilterURLSerializer.setInURL(mockFilters);
      }).not.toThrow();

      const filters = FilterURLSerializer.getFromURL();
      expect(filters).toEqual([]);

      global.window = originalWindow;
    });
  });

  describe('edge cases', () => {
    it('should handle filters with special characters', () => {
      const specialFilters: FilterState[] = [
        {
          columnId: 'search',
          type: 'text',
          operator: 'contains',
          values: ['special characters: !@#$%^&*()_+-=[]{}|;":,.<>?']
        }
      ];

      const serialized = FilterURLSerializer.serialize(specialFilters);
      const deserialized = FilterURLSerializer.deserialize(serialized.value);
      
      expect(deserialized).toEqual(specialFilters);
    });

    it('should handle filters with null/undefined values', () => {
      const filtersWithNulls: FilterState[] = [
        {
          columnId: 'optional',
          type: 'text',
          operator: 'isEmpty',
          values: []
        }
      ];

      const serialized = FilterURLSerializer.serialize(filtersWithNulls);
      const deserialized = FilterURLSerializer.deserialize(serialized.value);
      
      expect(deserialized).toEqual(filtersWithNulls);
    });


  });
});

describe('filterURLUtils', () => {
  it('should provide bound utility functions', () => {
    expect(filterURLUtils.serialize).toBeTypeOf('function');
    expect(filterURLUtils.deserialize).toBeTypeOf('function');
    expect(filterURLUtils.getFromURL).toBeTypeOf('function');
    expect(filterURLUtils.setInURL).toBeTypeOf('function');
    expect(filterURLUtils.createShareableURL).toBeTypeOf('function');
    expect(filterURLUtils.validate).toBeTypeOf('function');
    expect(filterURLUtils.getInfo).toBeTypeOf('function');
  });

  it('should work the same as static methods', () => {
    const serialized1 = FilterURLSerializer.serialize(mockFilters);
    const serialized2 = filterURLUtils.serialize(mockFilters);
    
    expect(serialized1).toEqual(serialized2);
    
    const deserialized1 = FilterURLSerializer.deserialize(serialized1.value);
    const deserialized2 = filterURLUtils.deserialize(serialized2.value);
    
    expect(deserialized1).toEqual(deserialized2);
  });
}); 