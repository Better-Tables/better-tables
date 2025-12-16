/**
 * Framework-agnostic URL sync adapter interface
 * Implement this interface for your specific framework (Next.js, React Router, etc.)
 */
export interface UrlSyncAdapter {
  /**
   * Get a URL parameter value
   * @param key - Parameter key
   * @returns Parameter value or null if not present
   */
  getParam: (key: string) => string | null;

  /**
   * Set multiple URL parameters at once
   * @param updates - Object with key-value pairs to update (null values delete the param)
   */
  setParams: (updates: Record<string, string | null>) => void;
}

/**
 * Configuration for URL synchronization
 */
export interface UrlSyncConfig {
  /** Sync filters to URL */
  filters?: boolean;
  /** Sync pagination to URL */
  pagination?: boolean;
  /** Sync sorting to URL */
  sorting?: boolean;
  /** Sync column visibility to URL */
  columnVisibility?: boolean;
  /** Sync column order to URL */
  columnOrder?: boolean;
}
