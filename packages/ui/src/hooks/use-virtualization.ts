import {
  type ScrollInfo,
  type ScrollToOptions,
  type VirtualColumnItem,
  type VirtualRowItem,
  type VirtualizationConfig,
  VirtualizationManager,
  type VirtualizationMetrics,
  type VirtualizationState,
} from '@better-tables/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Configuration for the useVirtualization hook
 */
export interface UseVirtualizationConfig extends Partial<VirtualizationConfig> {
  /** Total number of rows in the dataset */
  totalRows: number;

  /** Total number of columns (optional, for horizontal virtualization) */
  totalColumns?: number;

  /** Whether virtualization is enabled */
  enabled?: boolean;

  /** Callback when scroll position changes */
  onScroll?: (scrollInfo: ScrollInfo) => void;

  /** Callback when visible range changes */
  onViewportChange?: (startIndex: number, endIndex: number) => void;

  /** Callback when a row is measured */
  onRowMeasured?: (rowIndex: number, height: number) => void;
}

/**
 * Return type for the useVirtualization hook
 */
export interface UseVirtualizationReturn {
  /** Current virtualization state */
  state: VirtualizationState;

  /** Virtual rows to render */
  virtualRows: VirtualRowItem[];

  /** Virtual columns to render (if horizontal virtualization enabled) */
  virtualColumns: VirtualColumnItem[];

  /** Performance metrics */
  metrics: VirtualizationMetrics;

  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement>;

  /** Ref to attach to the content wrapper */
  contentRef: React.RefObject<HTMLDivElement>;

  /** Current scroll information */
  scrollInfo: ScrollInfo;

  /** Methods for programmatic control */
  actions: {
    /** Update scroll position */
    updateScroll: (scrollInfo: Partial<ScrollInfo>) => void;

    /** Scroll to a specific row/column */
    scrollTo: (options: ScrollToOptions) => void;

    /** Measure a row's height */
    measureRow: (rowIndex: number, height: number) => void;

    /** Update total item counts */
    updateItemCounts: (totalRows: number, totalColumns?: number) => void;

    /** Reset all measurements */
    reset: () => void;

    /** Enable/disable virtualization */
    setEnabled: (enabled: boolean) => void;

    /** Update configuration */
    updateConfig: (config: Partial<VirtualizationConfig>) => void;

    /** Observe an element for resize */
    observeElement: (element: HTMLElement, rowIndex: number) => void;

    /** Stop observing an element */
    unobserveElement: (element: HTMLElement) => void;
  };

  /** Styling properties for the container and content */
  styles: {
    /** Container styles */
    container: React.CSSProperties;

    /** Content wrapper styles */
    content: React.CSSProperties;

    /** Individual row positioning styles */
    getRowStyle: (virtualRow: VirtualRowItem) => React.CSSProperties;

    /** Individual column positioning styles */
    getColumnStyle: (virtualColumn: VirtualColumnItem) => React.CSSProperties;
  };

  /** Utility functions */
  utils: {
    /** Check if a row index is currently visible */
    isRowVisible: (rowIndex: number) => boolean;

    /** Check if a column index is currently visible */
    isColumnVisible: (columnIndex: number) => boolean;

    /** Get the row measurement for an index */
    getRowMeasurement: (rowIndex: number) => { start: number; height: number; end: number } | null;

    /** Calculate total scroll height */
    getTotalHeight: () => number;

    /** Calculate total scroll width */
    getTotalWidth: () => number;
  };
}

/**
 * Hook for managing virtualized scrolling in tables
 */
export function useVirtualization(config: UseVirtualizationConfig): UseVirtualizationReturn {
  const {
    totalRows,
    totalColumns = 0,
    enabled = true,
    onScroll,
    onViewportChange,
    onRowMeasured,
    ...virtualizationConfig
  } = config;

  // Refs for DOM elements
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Create and manage the virtualization manager
  const manager = useMemo(() => {
    return new VirtualizationManager(
      {
        containerHeight: 400,
        defaultRowHeight: 40,
        overscan: 5,
        ...virtualizationConfig,
      },
      totalRows,
      totalColumns
    );
  }, []); // Only create once, updates handled separately

  // State for tracking virtualization state
  const [state, setState] = useState<VirtualizationState>(() => manager.getState());
  const [metrics, setMetrics] = useState<VirtualizationMetrics>(() =>
    manager.getPerformanceMetrics()
  );

  // Update manager when config changes
  useEffect(() => {
    manager.updateItemCounts(totalRows, totalColumns);
  }, [manager, totalRows, totalColumns]);

  useEffect(() => {
    if (Object.keys(virtualizationConfig).length > 0) {
      manager.updateConfig(virtualizationConfig);
    }
  }, [manager, virtualizationConfig]);

  useEffect(() => {
    manager.setEnabled(enabled);
  }, [manager, enabled]);

  // Subscribe to manager events
  useEffect(() => {
    const unsubscribe = manager.subscribe((event) => {
      switch (event.type) {
        case 'scroll':
          setState(manager.getState());
          setMetrics(manager.getPerformanceMetrics());
          onScroll?.(event.scrollInfo);
          break;

        case 'virtual_items_changed':
          setState(manager.getState());
          setMetrics(manager.getPerformanceMetrics());
          break;

        case 'viewport_changed':
          onViewportChange?.(event.startIndex, event.endIndex);
          break;

        case 'row_measured':
          setState(manager.getState());
          setMetrics(manager.getPerformanceMetrics());
          onRowMeasured?.(event.rowIndex, event.height);
          break;

        case 'total_size_changed':
        case 'configuration_updated':
          setState(manager.getState());
          setMetrics(manager.getPerformanceMetrics());
          break;
      }
    });

    return unsubscribe;
  }, [manager, onScroll, onViewportChange, onRowMeasured]);

  // Handle scroll events from the container
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.target as HTMLDivElement;
      const scrollInfo: Partial<ScrollInfo> = {
        scrollTop: target.scrollTop,
        scrollLeft: target.scrollLeft,
        clientHeight: target.clientHeight,
        clientWidth: target.clientWidth,
        scrollHeight: target.scrollHeight,
        scrollWidth: target.scrollWidth,
      };

      manager.updateScroll(scrollInfo);
    },
    [manager]
  );

  // Update container dimensions when they change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      manager.updateConfig({
        containerHeight: rect.height,
        containerWidth: rect.width,
      });

      // Also update scroll info
      manager.updateScroll({
        clientHeight: container.clientHeight,
        clientWidth: container.clientWidth,
        scrollHeight: container.scrollHeight,
        scrollWidth: container.scrollWidth,
      });
    };

    // Initial update
    updateDimensions();

    // Listen for resize events
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.unobserve(container);
    };
  }, [manager]);

  // Set up scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll as any, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll as any);
    };
  }, [handleScroll]);

  // Actions object with all control methods
  const actions = useMemo(
    () => ({
      updateScroll: (scrollInfo: Partial<ScrollInfo>) => {
        manager.updateScroll(scrollInfo);
      },

      scrollTo: (options: ScrollToOptions) => {
        manager.scrollTo(options);

        // Apply the scroll to the DOM element
        const container = containerRef.current;
        if (container) {
          const newState = manager.getState();
          container.scrollTo({
            top: newState.scrollInfo.scrollTop,
            left: newState.scrollInfo.scrollLeft,
            behavior: options.behavior || 'auto',
          });
        }
      },

      measureRow: (rowIndex: number, height: number) => {
        manager.measureRow(rowIndex, height);
      },

      updateItemCounts: (totalRows: number, totalColumns?: number) => {
        manager.updateItemCounts(totalRows, totalColumns);
      },

      reset: () => {
        manager.reset();
      },

      setEnabled: (enabled: boolean) => {
        manager.setEnabled(enabled);
      },

      updateConfig: (config: Partial<VirtualizationConfig>) => {
        manager.updateConfig(config);
      },

      observeElement: (element: HTMLElement, rowIndex: number) => {
        manager.observeElement(element, rowIndex);
      },

      unobserveElement: (element: HTMLElement) => {
        manager.unobserveElement(element);
      },
    }),
    [manager]
  );

  // Styling utilities
  const styles = useMemo(
    () => ({
      container: {
        overflow: 'auto',
        height: '100%',
        width: '100%',
      } as React.CSSProperties,

      content: {
        position: 'relative' as const,
        height: state.totalHeight,
        width: state.totalWidth,
      } as React.CSSProperties,

      getRowStyle: (virtualRow: VirtualRowItem): React.CSSProperties => ({
        position: 'absolute',
        top: virtualRow.start,
        left: 0,
        right: 0,
        height: virtualRow.height,
        transform: `translateY(0px)`, // For potential optimizations
      }),

      getColumnStyle: (virtualColumn: VirtualColumnItem): React.CSSProperties => ({
        position: 'absolute',
        left: virtualColumn.start,
        top: 0,
        bottom: 0,
        width: virtualColumn.width,
        transform: `translateX(0px)`, // For potential optimizations
      }),
    }),
    [state.totalHeight, state.totalWidth]
  );

  // Utility functions
  const utils = useMemo(
    () => ({
      isRowVisible: (rowIndex: number): boolean => {
        return rowIndex >= state.startIndex && rowIndex <= state.endIndex;
      },

      isColumnVisible: (columnIndex: number): boolean => {
        return columnIndex >= state.startColumnIndex && columnIndex <= state.endColumnIndex;
      },

      getRowMeasurement: (rowIndex: number) => {
        const row = state.virtualRows.find((r) => r.index === rowIndex);
        if (!row) return null;

        return {
          start: row.start,
          height: row.height,
          end: row.end,
        };
      },

      getTotalHeight: (): number => state.totalHeight,

      getTotalWidth: (): number => state.totalWidth,
    }),
    [state]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  return {
    state,
    virtualRows: state.virtualRows,
    virtualColumns: state.virtualColumns,
    metrics,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    contentRef: contentRef as React.RefObject<HTMLDivElement>,
    scrollInfo: state.scrollInfo,
    actions,
    styles,
    utils,
  };
}
