import type { FilterState } from '../types/filter';

/**
 * Options for URL serialization
 */
export interface URLSerializationOptions {
  /** URL parameter name for filters */
  paramName?: string;
  /** Whether to compress the data */
  compress?: boolean;
  /** Whether to include metadata */
  includeMeta?: boolean;
  /** Maximum URL length (for compression threshold) */
  maxLength?: number;
}

/**
 * Result of URL serialization
 */
export interface URLSerializationResult {
  /** The serialized string */
  value: string;
  /** Whether compression was applied */
  compressed: boolean;
  /** Size of the result */
  size: number;
}

/**
 * Filter serialization utilities for URL state persistence
 */
export class FilterURLSerializer {
  private static readonly DEFAULT_PARAM_NAME = 'filters';
  private static readonly DEFAULT_MAX_LENGTH = 2000; // Conservative URL length limit

  /**
   * Serialize filters to URL-safe string
   */
  static serialize(
    filters: FilterState[], 
    options: URLSerializationOptions = {}
  ): URLSerializationResult {
    const { compress = true, includeMeta = false, maxLength = this.DEFAULT_MAX_LENGTH } = options;

    // Create minimal filter data
    const filterData = filters.map(filter => ({
      c: filter.columnId,
      t: filter.type,
      o: filter.operator,
      v: filter.values,
      ...(filter.includeNull && { n: filter.includeNull }),
      ...(includeMeta && filter.meta && { m: filter.meta })
    }));

    const json = JSON.stringify(filterData);
    
    // Try uncompressed first
    let result = this.encodeToURL(json);
    let isCompressed = false;

    // Apply compression if needed or requested
    if (compress || result.length > maxLength) {
      const compressed = this.compressData(json);
      const compressedResult = this.encodeToURL(compressed);
      
      if (compressedResult.length < result.length) {
        result = `c:${compressedResult}`; // Prefix to indicate compression
        isCompressed = true;
      }
    }

    return {
      value: result,
      compressed: isCompressed,
      size: result.length
    };
  }

  /**
   * Deserialize filters from URL string
   */
  static deserialize(urlString: string): FilterState[] {
    if (!urlString || urlString.trim() === '') {
      return [];
    }

    try {
      let json: string;
      
      // Check if compressed
      if (urlString.startsWith('c:')) {
        const compressed = urlString.slice(2);
        const decodedCompressed = this.decodeFromURL(compressed);
        json = this.decompressData(decodedCompressed);
      } else {
        json = this.decodeFromURL(urlString);
      }

      const filterData = JSON.parse(json);
      
      if (!Array.isArray(filterData)) {
        throw new Error('Invalid filter data format');
      }

      // Convert back to full FilterState format
      return filterData.map((data: any) => ({
        columnId: data.c,
        type: data.t,
        operator: data.o,
        values: data.v,
        ...(data.n && { includeNull: data.n }),
        ...(data.m && { meta: data.m })
      }));
    } catch (error) {
      console.warn('Failed to deserialize filters from URL:', error);
      throw error; // Re-throw for validation to catch
    }
  }

  /**
   * Get filters from current URL
   */
  static getFromURL(
    options: Pick<URLSerializationOptions, 'paramName'> = {}
  ): FilterState[] {
    const { paramName = this.DEFAULT_PARAM_NAME } = options;
    
    if (typeof window === 'undefined') {
      return []; // SSR safety
    }

    const params = new URLSearchParams(window.location.search);
    const filterString = params.get(paramName);
    
    if (!filterString) {
      return [];
    }

    try {
      return this.deserialize(filterString);
    } catch (error) {
      console.warn('Failed to get filters from URL:', error);
      return [];
    }
  }

  /**
   * Set filters in current URL
   */
  static setInURL(
    filters: FilterState[],
    options: URLSerializationOptions = {}
  ): void {
    const { paramName = this.DEFAULT_PARAM_NAME } = options;
    
    if (typeof window === 'undefined') {
      return; // SSR safety
    }

    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (filters.length === 0) {
      params.delete(paramName);
    } else {
      const result = this.serialize(filters, options);
      params.set(paramName, result.value);
    }

    // Update URL without page reload
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * Create shareable URL with filters
   */
  static createShareableURL(
    filters: FilterState[],
    baseURL?: string,
    options: URLSerializationOptions = {}
  ): string {
    const { paramName = this.DEFAULT_PARAM_NAME } = options;
    
    const url = new URL(baseURL || (typeof window !== 'undefined' ? window.location.href : ''));
    
    if (filters.length > 0) {
      const result = this.serialize(filters, options);
      url.searchParams.set(paramName, result.value);
    }

    return url.toString();
  }

  /**
   * Validate that URL string can be deserialized
   */
  static validate(urlString: string): boolean {
    try {
      const result = this.deserialize(urlString);
      return Array.isArray(result);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get serialization info without actually serializing
   */
  static getSerializationInfo(
    filters: FilterState[],
    options: URLSerializationOptions = {}
  ): {
    estimatedSize: number;
    wouldCompress: boolean;
    filterCount: number;
  } {
    const { maxLength = this.DEFAULT_MAX_LENGTH } = options;
    const filterData = filters.map(filter => ({
      c: filter.columnId,
      t: filter.type,
      o: filter.operator,
      v: filter.values
    }));

    const json = JSON.stringify(filterData);
    const encoded = this.encodeToURL(json);
    
    return {
      estimatedSize: encoded.length,
      wouldCompress: encoded.length > maxLength,
      filterCount: filters.length
    };
  }

  /**
   * Encode string to URL-safe format
   */
  private static encodeToURL(str: string): string {
    return btoa(encodeURIComponent(str))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Decode string from URL-safe format
   */
  private static decodeFromURL(str: string): string {
    // Add padding if needed
    const padded = str + '='.repeat((4 - str.length % 4) % 4);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(atob(base64));
  }

  /**
   * Simple compression using run-length encoding for repeated patterns
   */
  private static compressData(str: string): string {
    // Simple compression - just remove repetitive patterns for now
    // In a real implementation, you'd use a proper compression library
    return str
      .replace(/(.)\1{3,}/g, (match, char) => `${char}*${match.length}`)
      .replace(/("columnId")/g, '"c"')
      .replace(/("type")/g, '"t"')
      .replace(/("operator")/g, '"o"')
      .replace(/("values")/g, '"v"')
      .replace(/("includeNull")/g, '"n"')
      .replace(/("meta")/g, '"m"');
  }

  /**
   * Decompress data
   */
  private static decompressData(str: string): string {
    return str
      .replace(/(.)\*(\d+)/g, (char, count) => char.repeat(parseInt(count)))
      .replace(/("c")/g, '"columnId"')
      .replace(/("t")/g, '"type"')
      .replace(/("o")/g, '"operator"')
      .replace(/("v")/g, '"values"')
      .replace(/("n")/g, '"includeNull"')
      .replace(/("m")/g, '"meta"');
  }
}

/**
 * Hook-style utility for React applications
 */
export const filterURLUtils = {
  serialize: FilterURLSerializer.serialize.bind(FilterURLSerializer),
  deserialize: FilterURLSerializer.deserialize.bind(FilterURLSerializer),
  getFromURL: FilterURLSerializer.getFromURL.bind(FilterURLSerializer),
  setInURL: FilterURLSerializer.setInURL.bind(FilterURLSerializer),
  createShareableURL: FilterURLSerializer.createShareableURL.bind(FilterURLSerializer),
  validate: FilterURLSerializer.validate.bind(FilterURLSerializer),
  getInfo: FilterURLSerializer.getSerializationInfo.bind(FilterURLSerializer)
};

export default FilterURLSerializer; 