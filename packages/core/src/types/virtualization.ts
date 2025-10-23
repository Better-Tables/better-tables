/**
 * Virtualization configuration
 */
export interface VirtualizationConfig {
  /** Height of the container in pixels */
  containerHeight: number;

  /** Default height for rows in pixels */
  defaultRowHeight: number;

  /** Number of extra rows to render outside visible area (for smooth scrolling) */
  overscan?: number;

  /** Whether to enable smooth scrolling */
  smoothScrolling?: boolean;

  /** Scroll behavior configuration */
  scrollBehavior?: 'auto' | 'smooth';

  /** Whether to use dynamic row heights */
  dynamicRowHeight?: boolean;

  /** Custom function to get row height */
  getRowHeight?: (index: number) => number;

  /** Minimum row height (for dynamic heights) */
  minRowHeight?: number;

  /** Maximum row height (for dynamic heights) */
  maxRowHeight?: number;

  /** Whether to enable horizontal virtualization */
  horizontalVirtualization?: boolean;

  /** Default column width (for horizontal virtualization) */
  defaultColumnWidth?: number;

  /** Container width (for horizontal virtualization) */
  containerWidth?: number;
}

/**
 * Virtual row item information
 */
export interface VirtualRowItem {
  /** Row index in the complete dataset */
  index: number;

  /** Start position in pixels */
  start: number;

  /** Height in pixels */
  height: number;

  /** End position in pixels */
  end: number;

  /** Whether this row is currently visible */
  isVisible: boolean;
}

/**
 * Virtual column item information (for horizontal virtualization)
 */
export interface VirtualColumnItem {
  /** Column index */
  index: number;

  /** Start position in pixels */
  start: number;

  /** Width in pixels */
  width: number;

  /** End position in pixels */
  end: number;

  /** Whether this column is currently visible */
  isVisible: boolean;
}

/**
 * Scroll information
 */
export interface ScrollInfo {
  /** Current scroll position (top) */
  scrollTop: number;

  /** Current horizontal scroll position */
  scrollLeft: number;

  /** Container height */
  clientHeight: number;

  /** Container width */
  clientWidth: number;

  /** Total scrollable height */
  scrollHeight: number;

  /** Total scrollable width */
  scrollWidth: number;
}

/**
 * Virtualization state
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

  /** Total height of all rows */
  totalHeight: number;

  /** Total width of all columns */
  totalWidth: number;

  /** Current scroll information */
  scrollInfo: ScrollInfo;

  /** Whether virtualization is enabled */
  enabled: boolean;
}

/**
 * Scroll-to options
 */
export interface ScrollToOptions {
  /** Target row index */
  rowIndex?: number;

  /** Target column index */
  columnIndex?: number;

  /** Scroll alignment */
  align?: 'start' | 'center' | 'end' | 'auto';

  /** Scroll behavior */
  behavior?: 'auto' | 'smooth';

  /** Additional offset in pixels */
  offset?: number;
}

/**
 * Row measurement cache entry
 */
export interface RowMeasurement {
  /** Row index */
  index: number;

  /** Measured height */
  height: number;

  /** Start position */
  start: number;

  /** End position */
  end: number;

  /** Whether this measurement is estimated */
  estimated: boolean;

  /** Timestamp when measured */
  measuredAt: number;
}

/**
 * Virtualization performance metrics
 */
export interface VirtualizationMetrics {
  /** Number of rendered rows */
  renderedRows: number;

  /** Number of rendered columns */
  renderedColumns: number;

  /** Total number of rows */
  totalRows: number;

  /** Total number of columns */
  totalColumns: number;

  /** Render efficiency percentage */
  efficiency: number;

  /** Average render time in milliseconds */
  averageRenderTime: number;

  /** Memory usage estimation */
  memoryUsage: {
    /** Estimated DOM nodes */
    domNodes: number;

    /** Estimated memory in KB */
    estimatedKB: number;
  };
}

/**
 * Virtualization validation result
 */
export interface VirtualizationValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;

  /** Warning message if applicable */
  warning?: string;
}

/**
 * Resize observer entry for dynamic measurements
 */
export interface VirtualResizeObserverEntry {
  /** Element being observed */
  target: HTMLElement;

  /** Row index */
  rowIndex: number;

  /** New height */
  height: number;

  /** Previous height */
  previousHeight: number;
}
