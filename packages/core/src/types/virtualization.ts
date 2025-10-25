/**
 * @fileoverview Virtualization types and interfaces for efficient table rendering.
 *
 * This module defines types for virtual scrolling configuration, state management,
 * and performance optimization for handling large datasets in tables.
 *
 * @module types/virtualization
 */

/**
 * Virtualization configuration interface.
 *
 * Configures how virtual scrolling behaves, including container dimensions,
 * row heights, and performance optimization settings.
 *
 * @example
 * ```typescript
 * const virtualizationConfig: VirtualizationConfig = {
 *   containerHeight: 600,
 *   defaultRowHeight: 50,
 *   overscan: 5,
 *   smoothScrolling: true,
 *   scrollBehavior: 'smooth',
 *   dynamicRowHeight: false,
 *   horizontalVirtualization: true,
 *   defaultColumnWidth: 150,
 *   containerWidth: 1200
 * };
 * ```
 */
export interface VirtualizationConfig {
  /** Height of the virtual scrolling container in pixels */
  containerHeight: number;

  /** Default height for rows in pixels */
  defaultRowHeight: number;

  /** Number of extra rows to render outside visible area (for smooth scrolling) */
  overscan?: number;

  /** Whether to enable smooth scrolling animations */
  smoothScrolling?: boolean;

  /** CSS scroll behavior for programmatic scrolling */
  scrollBehavior?: 'auto' | 'smooth';

  /** Whether to use dynamic row heights based on content */
  dynamicRowHeight?: boolean;

  /** Custom function to calculate row height for dynamic sizing */
  getRowHeight?: (index: number) => number;

  /** Minimum row height when using dynamic heights */
  minRowHeight?: number;

  /** Maximum row height when using dynamic heights */
  maxRowHeight?: number;

  /** Whether to enable horizontal virtualization for columns */
  horizontalVirtualization?: boolean;

  /** Default column width for horizontal virtualization */
  defaultColumnWidth?: number;

  /** Container width for horizontal virtualization */
  containerWidth?: number;
}

/**
 * Virtual row item information interface.
 *
 * Contains positioning and visibility information for a single
 * virtual row within the virtualized container.
 *
 * @example
 * ```typescript
 * const virtualRow: VirtualRowItem = {
 *   index: 5,
 *   start: 250,
 *   height: 50,
 *   end: 300,
 *   isVisible: true
 * };
 * ```
 */
export interface VirtualRowItem {
  /** Row index in the complete dataset */
  index: number;

  /** Start position in pixels from the top */
  start: number;

  /** Height of the row in pixels */
  height: number;

  /** End position in pixels from the top */
  end: number;

  /** Whether this row is currently visible in the viewport */
  isVisible: boolean;
}

/**
 * Virtual column item information interface.
 *
 * Contains positioning and visibility information for a single
 * virtual column within the horizontally virtualized container.
 *
 * @example
 * ```typescript
 * const virtualColumn: VirtualColumnItem = {
 *   index: 3,
 *   start: 450,
 *   width: 150,
 *   end: 600,
 *   isVisible: true
 * };
 * ```
 */
export interface VirtualColumnItem {
  /** Column index in the complete dataset */
  index: number;

  /** Start position in pixels from the left */
  start: number;

  /** Width of the column in pixels */
  width: number;

  /** End position in pixels from the left */
  end: number;

  /** Whether this column is currently visible in the viewport */
  isVisible: boolean;
}

/**
 * Scroll information interface.
 *
 * Contains current scroll state and container dimensions
 * for virtualization calculations.
 *
 * @example
 * ```typescript
 * const scrollInfo: ScrollInfo = {
 *   scrollTop: 150,
 *   scrollLeft: 0,
 *   clientHeight: 600,
 *   clientWidth: 1200,
 *   scrollHeight: 5000,
 *   scrollWidth: 3000
 * };
 * ```
 */
export interface ScrollInfo {
  /** Current vertical scroll position in pixels */
  scrollTop: number;

  /** Current horizontal scroll position in pixels */
  scrollLeft: number;

  /** Visible height of the container */
  clientHeight: number;

  /** Visible width of the container */
  clientWidth: number;

  /** Total scrollable height of the content */
  scrollHeight: number;

  /** Total scrollable width of the content */
  scrollWidth: number;
}

/**
 * Virtualization state interface.
 *
 * Contains the complete state of the virtual scrolling system,
 * including visible items, scroll information, and dimensions.
 *
 * @example
 * ```typescript
 * const virtualizationState: VirtualizationState = {
 *   virtualRows: [* array of VirtualRowItem * ],
 *   virtualColumns: [* array of VirtualColumnItem *],
 *   startIndex: 10,
 *   endIndex: 25,
 *   startColumnIndex: 0,
 *   endColumnIndex: 8,
 *   totalHeight: 5000,
 *   totalWidth: 3000,
 *   scrollInfo: { * ScrollInfo * },
 *   enabled: true
 * };
 * ```
 */
export interface VirtualizationState {
  /** Virtual rows currently being rendered */
  virtualRows: VirtualRowItem[];

  /** Virtual columns currently being rendered */
  virtualColumns: VirtualColumnItem[];

  /** Index of first visible row */
  startIndex: number;

  /** Index of last visible row */
  endIndex: number;

  /** Index of first visible column */
  startColumnIndex: number;

  /** Index of last visible column */
  endColumnIndex: number;

  /** Total height of all rows combined */
  totalHeight: number;

  /** Total width of all columns combined */
  totalWidth: number;

  /** Current scroll information */
  scrollInfo: ScrollInfo;

  /** Whether virtualization is currently enabled */
  enabled: boolean;
}

/**
 * Scroll-to options interface.
 *
 * Configures how to scroll to a specific position in the virtualized content.
 *
 * @example
 * ```typescript
 * const scrollOptions: ScrollToOptions = {
 *   rowIndex: 50,
 *   columnIndex: 5,
 *   align: 'center',
 *   behavior: 'smooth',
 *   offset: 10
 * };
 * ```
 */
export interface ScrollToOptions {
  /** Target row index to scroll to */
  rowIndex?: number;

  /** Target column index to scroll to */
  columnIndex?: number;

  /** How to align the target item in the viewport */
  align?: 'start' | 'center' | 'end' | 'auto';

  /** Scroll animation behavior */
  behavior?: 'auto' | 'smooth';

  /** Additional offset in pixels */
  offset?: number;
}

/**
 * Row measurement cache entry interface.
 *
 * Stores measured dimensions and positioning information for
 * individual rows to optimize virtualization performance.
 *
 * @example
 * ```typescript
 * const measurement: RowMeasurement = {
 *   index: 25,
 *   height: 75,
 *   start: 1250,
 *   end: 1325,
 *   estimated: false,
 *   measuredAt: Date.now()
 * };
 * ```
 */
export interface RowMeasurement {
  /** Row index this measurement applies to */
  index: number;

  /** Measured height of the row */
  height: number;

  /** Start position of the row */
  start: number;

  /** End position of the row */
  end: number;

  /** Whether this measurement is estimated or actual */
  estimated: boolean;

  /** Timestamp when the measurement was taken */
  measuredAt: number;
}

/**
 * Virtualization performance metrics interface.
 *
 * Provides performance statistics and efficiency metrics
 * for monitoring virtual scrolling performance.
 *
 * @example
 * ```typescript
 * const metrics: VirtualizationMetrics = {
 *   renderedRows: 15,
 *   renderedColumns: 8,
 *   totalRows: 10000,
 *   totalColumns: 50,
 *   efficiency: 99.85,
 *   averageRenderTime: 2.5,
 *   memoryUsage: {
 *     domNodes: 120,
 *     estimatedKB: 45
 *   }
 * };
 * ```
 */
export interface VirtualizationMetrics {
  /** Number of rows currently rendered */
  renderedRows: number;

  /** Number of columns currently rendered */
  renderedColumns: number;

  /** Total number of rows in the dataset */
  totalRows: number;

  /** Total number of columns in the dataset */
  totalColumns: number;

  /** Render efficiency percentage (rendered/total) */
  efficiency: number;

  /** Average render time in milliseconds */
  averageRenderTime: number;

  /** Memory usage estimation */
  memoryUsage: {
    /** Estimated number of DOM nodes */
    domNodes: number;

    /** Estimated memory usage in KB */
    estimatedKB: number;
  };
}

/**
 * Virtualization validation result interface.
 *
 * Contains validation results for virtualization configuration,
 * including success status and error/warning messages.
 *
 * @example
 * ```typescript
 * const validation: VirtualizationValidationResult = {
 *   valid: true,
 *   warning: 'Consider reducing overscan for better performance'
 * };
 * ```
 */
export interface VirtualizationValidationResult {
  /** Whether the virtualization configuration is valid */
  valid: boolean;

  /** Error message if configuration is invalid */
  error?: string;

  /** Warning message for configuration improvements */
  warning?: string;
}

/**
 * Resize observer entry interface for dynamic measurements.
 *
 * Contains information about element size changes detected
 * by the resize observer for dynamic row height calculations.
 *
 * @example
 * ```typescript
 * const resizeEntry: VirtualResizeObserverEntry = {
 *   target: rowElement,
 *   rowIndex: 15,
 *   height: 80,
 *   previousHeight: 50
 * };
 * ```
 */
export interface VirtualResizeObserverEntry {
  /** The HTML element being observed */
  target: HTMLElement;

  /** Row index of the resized element */
  rowIndex: number;

  /** New height of the element */
  height: number;

  /** Previous height of the element */
  previousHeight: number;
}
