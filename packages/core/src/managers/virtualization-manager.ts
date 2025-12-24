/**
 * @fileoverview Virtualization manager for handling virtual scrolling and rendering performance.
 *
 * This module provides comprehensive virtual scrolling management including row/column virtualization,
 * dynamic height measurements, performance metrics, and scroll-to functionality for large datasets.
 *
 * @module managers/virtualization-manager
 */

import type {
  RowMeasurement,
  ScrollInfo,
  ScrollToOptions,
  VirtualColumnItem,
  VirtualizationConfig,
  VirtualizationMetrics,
  VirtualizationState,
  VirtualizationValidationResult,
  VirtualRowItem,
} from '../types/virtualization';

/**
 * Event types for virtualization manager.
 *
 * Defines the different types of events that can be emitted by the virtualization manager,
 * enabling reactive updates and state synchronization for virtual scrolling operations.
 *
 * @example
 * ```typescript
 * const unsubscribe = virtualizationManager.subscribe((event) => {
 *   switch (event.type) {
 *     case 'scroll':
 *       console.log(`Scrolled to ${event.scrollInfo.scrollTop}`);
 *       break;
 *     case 'virtual_items_changed':
 *       console.log(`Rendering ${event.virtualRows.length} rows`);
 *       updateVisibleRows(event.virtualRows);
 *       break;
 *     case 'row_measured':
 *       console.log(`Row ${event.rowIndex} measured as ${event.height}px`);
 *       break;
 *     case 'viewport_changed':
 *       console.log(`Viewport: ${event.startIndex} to ${event.endIndex}`);
 *       break;
 *     case 'total_size_changed':
 *       console.log(`Total size: ${event.totalHeight}x${event.totalWidth}`);
 *       break;
 *     case 'configuration_updated':
 *       console.log('Virtualization config updated');
 *       break;
 *   }
 * });
 * ```
 */
export type VirtualizationManagerEvent =
  | { type: 'scroll'; scrollInfo: ScrollInfo }
  | {
      type: 'virtual_items_changed';
      virtualRows: VirtualRowItem[];
      virtualColumns: VirtualColumnItem[];
    }
  | { type: 'row_measured'; rowIndex: number; height: number }
  | { type: 'viewport_changed'; startIndex: number; endIndex: number }
  | { type: 'total_size_changed'; totalHeight: number; totalWidth: number }
  | { type: 'configuration_updated'; config: VirtualizationConfig };

/**
 * Virtualization manager subscriber function type.
 *
 * Defines the callback function signature for virtualization event subscribers.
 *
 * @param event - The virtualization event that occurred
 *
 * @example
 * ```typescript
 * const handleVirtualizationChange: VirtualizationManagerSubscriber = (event) => {
 *   if (event.type === 'virtual_items_changed') {
 *     // Update the rendered rows and columns
 *     renderVirtualRows(event.virtualRows);
 *     renderVirtualColumns(event.virtualColumns);
 *   }
 * };
 * ```
 */
export type VirtualizationManagerSubscriber = (event: VirtualizationManagerEvent) => void;

/**
 * Core virtualization manager class for managing virtual scrolling and rendering.
 *
 * Provides comprehensive virtual scrolling management including row/column virtualization,
 * dynamic height measurements, performance metrics, scroll-to functionality, and resize observation.
 * Optimized for handling large datasets with minimal DOM nodes and efficient scrolling.
 *
 * @example
 * ```typescript
 * const virtualizationManager = new VirtualizationManager({
 *   containerHeight: 600,
 *   defaultRowHeight: 50,
 *   overscan: 5,
 *   smoothScrolling: true,
 *   scrollBehavior: 'smooth',
 *   dynamicRowHeight: true,
 *   horizontalVirtualization: true,
 *   defaultColumnWidth: 200,
 *   containerWidth: 1200
 * }, 10000, 50); // 10k rows, 50 columns
 *
 * // Subscribe to changes
 * const unsubscribe = virtualizationManager.subscribe((event) => {
 *   if (event.type === 'virtual_items_changed') {
 *     renderVirtualRows(event.virtualRows);
 *     renderVirtualColumns(event.virtualColumns);
 *   }
 * });
 *
 * // Update scroll position
 * virtualizationManager.updateScroll({
 *   scrollTop: 5000,
 *   scrollLeft: 1000,
 *   clientHeight: 600,
 *   clientWidth: 1200
 * });
 *
 * // Scroll to specific row
 * virtualizationManager.scrollTo({
 *   rowIndex: 100,
 *   align: 'center'
 * });
 *
 * // Measure dynamic row height
 * virtualizationManager.measureRow(50, 75);
 * ```
 */
export class VirtualizationManager {
  private state: VirtualizationState = {
    virtualRows: [],
    virtualColumns: [],
    startIndex: 0,
    endIndex: 0,
    startColumnIndex: 0,
    endColumnIndex: 0,
    totalHeight: 0,
    totalWidth: 0,
    scrollInfo: {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 0,
      clientWidth: 0,
      scrollHeight: 0,
      scrollWidth: 0,
    },
    enabled: true,
  };

  private config: VirtualizationConfig = {
    containerHeight: 400,
    defaultRowHeight: 40,
    overscan: 5,
    smoothScrolling: true,
    scrollBehavior: 'auto',
    dynamicRowHeight: false,
    minRowHeight: 20,
    maxRowHeight: 200,
    horizontalVirtualization: false,
    defaultColumnWidth: 150,
    containerWidth: 800,
  };

  private subscribers: VirtualizationManagerSubscriber[] = [];
  private rowMeasurements: Map<number, RowMeasurement> = new Map();
  private totalRows = 0;
  private totalColumns = 0;
  private resizeObserver: ResizeObserver | null = null;
  private performanceMetrics: VirtualizationMetrics = {
    renderedRows: 0,
    renderedColumns: 0,
    totalRows: 0,
    totalColumns: 0,
    efficiency: 0,
    averageRenderTime: 0,
    memoryUsage: {
      domNodes: 0,
      estimatedKB: 0,
    },
  };

  /**
   * Create a new virtualization manager instance.
   *
   * Initializes the virtualization manager with configuration options, total item counts,
   * and sets up resize observation for dynamic content. The manager will immediately
   * calculate virtual items and emit appropriate events.
   *
   * @param config - Virtualization configuration options (partial)
   * @param totalRows - Total number of rows in the dataset
   * @param totalColumns - Total number of columns (default: 0)
   *
   * @example
   * ```typescript
   * const virtualizationManager = new VirtualizationManager({
   *   containerHeight: 600,
   *   defaultRowHeight: 40,
   *   overscan: 3,
   *   dynamicRowHeight: true,
   *   horizontalVirtualization: false
   * }, 100000, 20); // 100k rows, 20 columns
   * ```
   */
  constructor(config: Partial<VirtualizationConfig> = {}, totalRows = 0, totalColumns = 0) {
    this.config = { ...this.config, ...config };
    this.totalRows = totalRows;
    this.totalColumns = totalColumns;
    this.initializeResizeObserver();
    this.calculateTotalSize();
    this.updateVirtualItems();
  }

  /**
   * Get current virtualization state.
   *
   * Returns a copy of the current virtualization state including virtual rows/columns,
   * scroll information, viewport indices, and total dimensions.
   *
   * @returns Current virtualization state
   *
   * @example
   * ```typescript
   * const state = virtualizationManager.getState();
   * console.log(`Viewport: rows ${state.startIndex}-${state.endIndex}`);
   * console.log(`Virtual rows: ${state.virtualRows.length}`);
   * console.log(`Total size: ${state.totalHeight}x${state.totalWidth}`);
   * ```
   */
  getState(): VirtualizationState {
    return { ...this.state };
  }

  /**
   * Get virtual rows currently being rendered
   */
  getVirtualRows(): VirtualRowItem[] {
    return [...this.state.virtualRows];
  }

  /**
   * Get virtual columns currently being rendered
   */
  getVirtualColumns(): VirtualColumnItem[] {
    return [...this.state.virtualColumns];
  }

  /**
   * Update scroll position and recalculate virtual items.
   *
   * Updates the current scroll position and recalculates which rows and columns
   * should be rendered. This triggers virtual item recalculation and emits events
   * for scroll and virtual item changes.
   *
   * @param scrollInfo - Partial scroll information to update
   *
   * @example
   * ```typescript
   * // Update scroll position from scroll event
   * const handleScroll = (event) => {
   *   virtualizationManager.updateScroll({
   *     scrollTop: event.target.scrollTop,
   *     scrollLeft: event.target.scrollLeft,
   *     clientHeight: event.target.clientHeight,
   *     clientWidth: event.target.clientWidth
   *   });
   * };
   * ```
   */
  updateScroll(scrollInfo: Partial<ScrollInfo>): void {
    const prevScrollInfo = this.state.scrollInfo;
    this.state.scrollInfo = { ...prevScrollInfo, ...scrollInfo };

    this.updateVirtualItems();
    this.notifySubscribers({
      type: 'scroll',
      scrollInfo: this.state.scrollInfo,
    });
  }

  /**
   * Update total number of rows and columns
   */
  updateItemCounts(totalRows: number, totalColumns: number = this.totalColumns): void {
    const prevTotalRows = this.totalRows;
    const prevTotalColumns = this.totalColumns;

    this.totalRows = totalRows;
    this.totalColumns = totalColumns;

    if (prevTotalRows !== totalRows || prevTotalColumns !== totalColumns) {
      this.calculateTotalSize();
      this.updateVirtualItems();
      this.updatePerformanceMetrics();
    }
  }

  /**
   * Measure a row's actual height
   */
  measureRow(rowIndex: number, height: number): void {
    const measurement: RowMeasurement = {
      index: rowIndex,
      height,
      start: 0, // Will be calculated
      end: 0, // Will be calculated
      estimated: false,
      measuredAt: Date.now(),
    };

    // Update measurement cache
    this.rowMeasurements.set(rowIndex, measurement);

    // Recalculate positions for this and subsequent rows
    this.recalculateRowPositions(rowIndex);

    // Update virtual items if this affects visible range
    this.updateVirtualItems();

    this.notifySubscribers({ type: 'row_measured', rowIndex, height });
  }

  /**
   * Scroll to a specific row/column.
   *
   * Smoothly scrolls to the specified row and/or column with configurable alignment.
   * Supports different alignment modes (start, center, end, auto) and offset positioning.
   * Automatically calculates the target scroll position based on row measurements.
   *
   * @param options - Scroll to options including target position and alignment
   *
   * @example
   * ```typescript
   * // Scroll to row 100, centered in viewport
   * virtualizationManager.scrollTo({
   *   rowIndex: 100,
   *   align: 'center'
   * });
   *
   * // Scroll to row 50 with 20px offset from top
   * virtualizationManager.scrollTo({
   *   rowIndex: 50,
   *   align: 'start',
   *   offset: 20
   * });
   *
   * // Scroll to both row and column
   * virtualizationManager.scrollTo({
   *   rowIndex: 100,
   *   columnIndex: 5,
   *   align: 'center'
   * });
   * ```
   */
  scrollTo(options: ScrollToOptions): void {
    const { rowIndex, columnIndex, align = 'auto', offset = 0 } = options;

    let targetScrollTop = this.state.scrollInfo.scrollTop;
    let targetScrollLeft = this.state.scrollInfo.scrollLeft;

    // Calculate target scroll position for row
    if (rowIndex !== undefined) {
      const rowMeasurement = this.getRowMeasurement(rowIndex);
      const containerHeight = this.state.scrollInfo.clientHeight || this.config.containerHeight;

      switch (align) {
        case 'start':
          targetScrollTop = rowMeasurement.start + offset;
          break;
        case 'center':
          targetScrollTop =
            rowMeasurement.start + (rowMeasurement.height - containerHeight) / 2 + offset;
          break;
        case 'end':
          targetScrollTop =
            rowMeasurement.start - (containerHeight - rowMeasurement.height) + offset;
          break;
        case 'auto':
          // Only scroll if row is not visible
          if (rowMeasurement.start < this.state.scrollInfo.scrollTop) {
            targetScrollTop = rowMeasurement.start + offset;
          } else if (rowMeasurement.end > this.state.scrollInfo.scrollTop + containerHeight) {
            targetScrollTop = rowMeasurement.end - containerHeight + offset;
          }
          break;
      }
    }

    // Calculate target scroll position for column (if horizontal virtualization enabled)
    if (columnIndex !== undefined && this.config.horizontalVirtualization) {
      const columnStart = columnIndex * (this.config.defaultColumnWidth || 150);
      const columnWidth = this.config.defaultColumnWidth || 150;
      const containerWidth = this.state.scrollInfo.clientWidth;

      switch (align) {
        case 'start':
          targetScrollLeft = columnStart + offset;
          break;
        case 'center':
          targetScrollLeft = columnStart - (containerWidth - columnWidth) / 2 + offset;
          break;
        case 'end':
          targetScrollLeft = columnStart + columnWidth - containerWidth + offset;
          break;
        case 'auto':
          if (columnStart < this.state.scrollInfo.scrollLeft) {
            targetScrollLeft = columnStart + offset;
          } else if (
            columnStart + columnWidth >
            this.state.scrollInfo.scrollLeft + containerWidth
          ) {
            targetScrollLeft = columnStart + columnWidth - containerWidth + offset;
          }
          break;
      }
    }

    // Update scroll position
    this.updateScroll({
      scrollTop: Math.max(
        0,
        Math.min(targetScrollTop, this.state.totalHeight - this.state.scrollInfo.clientHeight)
      ),
      scrollLeft: Math.max(
        0,
        Math.min(targetScrollLeft, this.state.totalWidth - this.state.scrollInfo.clientWidth)
      ),
    });
  }

  /**
   * Get row measurement (either cached or estimated)
   */
  private getRowMeasurement(rowIndex: number): RowMeasurement {
    const cached = this.rowMeasurements.get(rowIndex);
    if (cached) {
      return cached;
    }

    // Calculate estimated measurement
    const height = this.config.getRowHeight
      ? this.config.getRowHeight(rowIndex)
      : this.config.defaultRowHeight;

    const start = this.calculateRowStart(rowIndex);

    return {
      index: rowIndex,
      height,
      start,
      end: start + height,
      estimated: true,
      measuredAt: Date.now(),
    };
  }

  /**
   * Calculate the start position of a row
   */
  private calculateRowStart(rowIndex: number): number {
    let start = 0;

    for (let i = 0; i < rowIndex; i++) {
      const measurement = this.rowMeasurements.get(i);
      if (measurement) {
        start += measurement.height;
      } else {
        const height = this.config.getRowHeight
          ? this.config.getRowHeight(i)
          : this.config.defaultRowHeight;
        start += height;
      }
    }

    return start;
  }

  /**
   * Recalculate positions for rows starting from a given index
   */
  private recalculateRowPositions(fromIndex: number): void {
    // Recalculate start position for the changed row and update it
    const measurement = this.rowMeasurements.get(fromIndex);
    if (measurement) {
      measurement.start = this.calculateRowStart(fromIndex);
      measurement.end = measurement.start + measurement.height;
    }

    // Recalculate total height
    this.calculateTotalSize();
  }

  /**
   * Calculate total height and width
   */
  private calculateTotalSize(): void {
    let totalHeight = 0;

    // Calculate total height using measured heights where available
    for (let i = 0; i < this.totalRows; i++) {
      const measurement = this.rowMeasurements.get(i);
      if (measurement) {
        totalHeight += measurement.height;
      } else {
        const height = this.config.getRowHeight
          ? this.config.getRowHeight(i)
          : this.config.defaultRowHeight;
        totalHeight += height;
      }
    }

    const totalWidth = this.config.horizontalVirtualization
      ? this.totalColumns * (this.config.defaultColumnWidth || 150)
      : this.config.containerWidth || 800;

    const prevTotalHeight = this.state.totalHeight;
    const prevTotalWidth = this.state.totalWidth;

    this.state.totalHeight = totalHeight;
    this.state.totalWidth = totalWidth;

    if (prevTotalHeight !== totalHeight || prevTotalWidth !== totalWidth) {
      this.notifySubscribers({
        type: 'total_size_changed',
        totalHeight,
        totalWidth,
      });
    }
  }

  /**
   * Update virtual items based on current scroll position
   */
  private updateVirtualItems(): void {
    const { scrollTop, scrollLeft, clientHeight, clientWidth } = this.state.scrollInfo;
    const overscan = this.config.overscan || 5;

    // Calculate visible row range
    const startRowIndex = this.findRowIndexByPosition(scrollTop);
    const endRowIndex = Math.min(
      this.totalRows - 1,
      this.findRowIndexByPosition(scrollTop + clientHeight - 1)
    );

    // Add overscan
    const overscanStartIndex = Math.max(0, startRowIndex - overscan);
    const overscanEndIndex = Math.min(this.totalRows - 1, endRowIndex + overscan);

    // Generate virtual rows
    const virtualRows: VirtualRowItem[] = [];
    for (let i = overscanStartIndex; i <= overscanEndIndex; i++) {
      const measurement = this.getRowMeasurement(i);
      virtualRows.push({
        index: i,
        start: measurement.start,
        height: measurement.height,
        end: measurement.end,
        isVisible: i >= startRowIndex && i <= endRowIndex,
      });
    }

    // Calculate visible column range (if horizontal virtualization enabled)
    const virtualColumns: VirtualColumnItem[] = [];
    let startColumnIndex = 0;
    let endColumnIndex = this.totalColumns - 1;

    if (this.config.horizontalVirtualization) {
      const columnWidth = this.config.defaultColumnWidth || 150;
      startColumnIndex = Math.floor(scrollLeft / columnWidth);
      endColumnIndex = Math.min(
        this.totalColumns - 1,
        Math.ceil((scrollLeft + clientWidth) / columnWidth)
      );

      const overscanStartCol = Math.max(0, startColumnIndex - overscan);
      const overscanEndCol = Math.min(this.totalColumns - 1, endColumnIndex + overscan);

      for (let i = overscanStartCol; i <= overscanEndCol; i++) {
        const start = i * columnWidth;
        virtualColumns.push({
          index: i,
          start,
          width: columnWidth,
          end: start + columnWidth,
          isVisible: i >= startColumnIndex && i <= endColumnIndex,
        });
      }
    }

    // Update state
    const prevStartIndex = this.state.startIndex;
    const prevEndIndex = this.state.endIndex;

    this.state.virtualRows = virtualRows;
    this.state.virtualColumns = virtualColumns;
    this.state.startIndex = startRowIndex;
    this.state.endIndex = endRowIndex;
    this.state.startColumnIndex = startColumnIndex;
    this.state.endColumnIndex = endColumnIndex;

    // Notify subscribers
    this.notifySubscribers({
      type: 'virtual_items_changed',
      virtualRows,
      virtualColumns,
    });

    if (prevStartIndex !== startRowIndex || prevEndIndex !== endRowIndex) {
      this.notifySubscribers({
        type: 'viewport_changed',
        startIndex: startRowIndex,
        endIndex: endRowIndex,
      });
    }

    this.updatePerformanceMetrics();
  }

  /**
   * Find row index by scroll position using binary search
   */
  private findRowIndexByPosition(position: number): number {
    if (position <= 0) return 0;
    if (position >= this.state.totalHeight) return this.totalRows - 1;

    // Binary search for the row at this position
    let low = 0;
    let high = this.totalRows - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const measurement = this.getRowMeasurement(mid);

      if (position >= measurement.start && position < measurement.end) {
        return mid;
      }
      if (position < measurement.start) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return Math.min(low, this.totalRows - 1);
  }

  /**
   * Initialize resize observer for dynamic row measurements
   */
  private initializeResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined' && this.config.dynamicRowHeight) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const rowIndex = parseInt(element.dataset.rowIndex || '0', 10);

          if (!Number.isNaN(rowIndex)) {
            const height = entry.contentRect.height;
            const previousMeasurement = this.rowMeasurements.get(rowIndex);
            const previousHeight = previousMeasurement?.height || this.config.defaultRowHeight;

            if (Math.abs(height - previousHeight) > 1) {
              // Only update if significant change
              this.measureRow(rowIndex, height);
            }
          }
        }
      });
    }
  }

  /**
   * Observe an element for size changes
   */
  observeElement(element: HTMLElement, rowIndex: number): void {
    if (this.resizeObserver && this.config.dynamicRowHeight) {
      element.dataset.rowIndex = rowIndex.toString();
      this.resizeObserver.observe(element);
    }
  }

  /**
   * Stop observing an element
   */
  unobserveElement(element: HTMLElement): void {
    if (this.resizeObserver) {
      this.resizeObserver.unobserve(element);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const renderedRows = this.state.virtualRows.length;
    const renderedColumns = this.state.virtualColumns.length || 1;

    this.performanceMetrics = {
      renderedRows,
      renderedColumns,
      totalRows: this.totalRows,
      totalColumns: this.totalColumns,
      efficiency: this.totalRows > 0 ? (1 - renderedRows / this.totalRows) * 100 : 100,
      averageRenderTime: 0, // To be implemented with actual render timing
      memoryUsage: {
        domNodes: renderedRows * renderedColumns,
        estimatedKB: renderedRows * renderedColumns * 0.5, // Rough estimate
      },
    };
  }

  /**
   * Get performance metrics.
   *
   * Returns current performance metrics including render efficiency, memory usage,
   * and item counts. Useful for monitoring and optimizing virtualization performance.
   *
   * @returns Current performance metrics
   *
   * @example
   * ```typescript
   * const metrics = virtualizationManager.getPerformanceMetrics();
   * console.log(`Rendering ${metrics.renderedRows} of ${metrics.totalRows} rows`);
   * console.log(`Efficiency: ${metrics.efficiency.toFixed(1)}%`);
   * console.log(`Memory: ${metrics.memoryUsage.estimatedKB}KB estimated`);
   * console.log(`DOM nodes: ${metrics.memoryUsage.domNodes}`);
   *
   * // Performance monitoring
   * if (metrics.efficiency < 90) {
   *   console.warn('Virtualization efficiency is low');
   * }
   * ```
   */
  getPerformanceMetrics(): VirtualizationMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get configuration
   */
  getConfig(): VirtualizationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VirtualizationConfig>): void {
    const prevConfig = this.config;
    this.config = { ...this.config, ...config };

    // Reinitialize resize observer if dynamic height setting changed
    if (prevConfig.dynamicRowHeight !== this.config.dynamicRowHeight) {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      this.initializeResizeObserver();
    }

    // Recalculate if size-related config changed
    if (
      prevConfig.containerHeight !== this.config.containerHeight ||
      prevConfig.defaultRowHeight !== this.config.defaultRowHeight ||
      prevConfig.containerWidth !== this.config.containerWidth ||
      prevConfig.defaultColumnWidth !== this.config.defaultColumnWidth
    ) {
      this.calculateTotalSize();
      this.updateVirtualItems();
    }

    this.notifySubscribers({
      type: 'configuration_updated',
      config: this.config,
    });
  }

  /**
   * Validate virtualization configuration
   */
  validateConfig(config: Partial<VirtualizationConfig>): VirtualizationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.containerHeight !== undefined) {
      if (config.containerHeight <= 0) {
        errors.push('Container height must be greater than 0');
      }
    }

    if (config.defaultRowHeight !== undefined) {
      if (config.defaultRowHeight <= 0) {
        errors.push('Default row height must be greater than 0');
      }
    }

    if (config.overscan !== undefined) {
      if (config.overscan < 0) {
        errors.push('Overscan must be non-negative');
      }
      if (config.overscan > 20) {
        warnings.push('Large overscan values may impact performance');
      }
    }

    if (config.minRowHeight !== undefined && config.maxRowHeight !== undefined) {
      if (config.minRowHeight > config.maxRowHeight) {
        errors.push('Minimum row height cannot be greater than maximum row height');
      }
    }

    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      warning: warnings.length > 0 ? warnings.join('; ') : undefined,
    };
  }

  /**
   * Subscribe to virtualization changes.
   *
   * Registers a callback function to be called whenever virtualization state changes.
   * Returns an unsubscribe function to remove the subscription. Useful for reactive
   * rendering and performance monitoring.
   *
   * @param callback - Function to call when virtualization state changes
   * @returns Unsubscribe function to remove the subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = virtualizationManager.subscribe((event) => {
   *   switch (event.type) {
   *     case 'virtual_items_changed':
   *       // Update rendered rows and columns
   *       renderVirtualRows(event.virtualRows);
   *       renderVirtualColumns(event.virtualColumns);
   *       break;
   *     case 'scroll':
   *       // Update scroll indicators or loading states
   *       updateScrollPosition(event.scrollInfo);
   *       break;
   *     case 'row_measured':
   *       // Update row height in UI
   *       updateRowHeight(event.rowIndex, event.height);
   *       break;
   *     case 'viewport_changed':
   *       // Update visible range indicators
   *       updateViewportInfo(event.startIndex, event.endIndex);
   *       break;
   *     case 'performance_metrics_updated':
   *       // Monitor performance
   *       console.log(`Efficiency: ${event.metrics.efficiency}%`);
   *       break;
   *   }
   * });
   *
   * // Later, unsubscribe
   * unsubscribe();
   * ```
   */
  subscribe(callback: VirtualizationManagerSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of virtualization changes
   */
  private notifySubscribers(event: VirtualizationManagerEvent): void {
    for (const callback of this.subscribers) {
      try {
        callback(event);
      } catch (_error) {}
    }
  }

  /**
   * Enable or disable virtualization
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    if (enabled) {
      this.updateVirtualItems();
    }
  }

  /**
   * Check if virtualization is enabled
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * Reset all measurements and recalculate
   */
  reset(): void {
    this.rowMeasurements.clear();
    this.calculateTotalSize();
    this.updateVirtualItems();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.subscribers.length = 0;
    this.rowMeasurements.clear();
  }

  /**
   * Clone the virtualization manager with the same configuration.
   *
   * Creates a new virtualization manager instance with the same configuration,
   * measurements, and current state. Useful for creating backup instances or
   * managing multiple virtualization contexts.
   *
   * @returns New virtualization manager instance with copied state
   *
   * @example
   * ```typescript
   * const originalManager = new VirtualizationManager(config, 10000, 50);
   * originalManager.updateScroll({ scrollTop: 5000 });
   * originalManager.measureRow(100, 75);
   *
   * // Create a backup with all measurements and state
   * const backupManager = originalManager.clone();
   * console.log('Backup created with same measurements and scroll position');
   *
   * // Modify backup without affecting original
   * backupManager.updateScroll({ scrollTop: 0 });
   * console.log('Original scroll position preserved');
   * ```
   */
  clone(): VirtualizationManager {
    const cloned = new VirtualizationManager(this.config, this.totalRows, this.totalColumns);

    // Copy measurements
    this.rowMeasurements.forEach((measurement, index) => {
      cloned.rowMeasurements.set(index, { ...measurement });
    });

    // Copy state
    cloned.state = {
      ...this.state,
      virtualRows: [...this.state.virtualRows],
      virtualColumns: [...this.state.virtualColumns],
      scrollInfo: { ...this.state.scrollInfo },
    };

    return cloned;
  }
}
