import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVirtualization } from '../../hooks/use-virtualization';

describe('useVirtualization', () => {
  beforeEach(() => {
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
  });

  it('should initialize with default configuration', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.state).toBeDefined();
    expect(result.current.virtualRows).toBeDefined();
    expect(result.current.virtualColumns).toBeDefined();
    expect(result.current.metrics).toBeDefined();
    expect(result.current.containerRef).toBeDefined();
    expect(result.current.contentRef).toBeDefined();
    expect(result.current.scrollInfo).toBeDefined();
    expect(result.current.actions).toBeDefined();
    expect(result.current.styles).toBeDefined();
    expect(result.current.utils).toBeDefined();
  });

  it('should provide virtual rows for visible range', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.virtualRows).toBeInstanceOf(Array);
    expect(result.current.virtualRows.length).toBeGreaterThan(0);
  });

  it('should handle scroll updates', () => {
    const onScroll = vi.fn();
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
        onScroll,
      })
    );

    act(() => {
      result.current.actions.updateScroll({
        scrollTop: 100,
        scrollLeft: 0,
        clientHeight: 400,
        clientWidth: 800,
        scrollHeight: 40000,
        scrollWidth: 800,
      });
    });

    expect(onScroll).toHaveBeenCalled();
  });

  it('should handle viewport changes', () => {
    const onViewportChange = vi.fn();
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
        onViewportChange,
      })
    );

    act(() => {
      result.current.actions.updateScroll({
        scrollTop: 100,
        scrollLeft: 0,
        clientHeight: 400,
        clientWidth: 800,
        scrollHeight: 40000,
        scrollWidth: 800,
      });
    });

    expect(onViewportChange).toHaveBeenCalled();
  });

  it('should handle row measurements', () => {
    const onRowMeasured = vi.fn();
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
        onRowMeasured,
      })
    );

    act(() => {
      result.current.actions.measureRow(0, 50);
    });

    expect(onRowMeasured).toHaveBeenCalledWith(0, 50);
  });

  it('should update item counts', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    act(() => {
      result.current.actions.updateItemCounts(2000, 10);
    });

    expect(result.current.metrics.totalRows).toBe(2000);
    expect(result.current.metrics.totalColumns).toBe(10);
  });

  it('should handle scroll to specific row', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    act(() => {
      result.current.actions.scrollTo({
        rowIndex: 100,
        behavior: 'smooth',
      });
    });

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should handle scroll to specific column', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        totalColumns: 20,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    act(() => {
      result.current.actions.scrollTo({
        columnIndex: 5,
        behavior: 'smooth',
      });
    });

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should provide row visibility utilities', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.utils.isRowVisible(0)).toBe(true);
    expect(result.current.utils.isRowVisible(999)).toBe(false);
  });

  it('should provide column visibility utilities', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        totalColumns: 20,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.utils.isColumnVisible(0)).toBe(true);
    expect(result.current.utils.isColumnVisible(19)).toBe(false);
  });

  it('should provide row measurement utilities', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    const measurement = result.current.utils.getRowMeasurement(0);
    expect(measurement).toBeDefined();
    expect(measurement?.start).toBeDefined();
    expect(measurement?.height).toBeDefined();
    expect(measurement?.end).toBeDefined();
  });

  it('should provide total size utilities', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        totalColumns: 20,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.utils.getTotalHeight()).toBeGreaterThan(0);
    expect(result.current.utils.getTotalWidth()).toBeGreaterThan(0);
  });

  it('should handle configuration updates', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    act(() => {
      result.current.actions.updateConfig({
        overscan: 10,
        smoothScrolling: true,
      });
    });

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should handle enabling/disabling virtualization', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
        enabled: true,
      })
    );

    act(() => {
      result.current.actions.setEnabled(false);
    });

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should handle element observation', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    const element = document.createElement('div');

    act(() => {
      result.current.actions.observeElement(element, 0);
    });

    act(() => {
      result.current.actions.unobserveElement(element);
    });

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should provide styling utilities', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.styles.container).toBeDefined();
    expect(result.current.styles.content).toBeDefined();
    expect(result.current.styles.getRowStyle).toBeInstanceOf(Function);
    expect(result.current.styles.getColumnStyle).toBeInstanceOf(Function);

    const virtualRow = result.current.virtualRows[0];
    if (virtualRow) {
      const rowStyle = result.current.styles.getRowStyle(virtualRow);
      expect(rowStyle).toBeDefined();
      expect(rowStyle.position).toBe('absolute');
    }
  });

  it('should handle reset', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    act(() => {
      result.current.actions.reset();
    });

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should handle performance metrics', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.metrics).toBeDefined();
    expect(result.current.metrics.averageRenderTime).toBeDefined();
    expect(result.current.metrics.memoryUsage).toBeDefined();
    expect(result.current.metrics.efficiency).toBeDefined();
  });

  it('should handle large datasets', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 100000,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.virtualRows.length).toBeLessThan(100);
    expect(result.current.utils.getTotalHeight()).toBeGreaterThan(0);
  });

  it('should handle zero rows', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 0,
        containerHeight: 400,
        defaultRowHeight: 40,
      })
    );

    expect(result.current.virtualRows).toEqual([]);
    expect(result.current.utils.getTotalHeight()).toBe(0);
  });

  it('should handle dynamic row heights', () => {
    const { result } = renderHook(() =>
      useVirtualization({
        totalRows: 1000,
        containerHeight: 400,
        defaultRowHeight: 40,
        dynamicRowHeight: true,
      })
    );

    act(() => {
      result.current.actions.measureRow(0, 60);
      result.current.actions.measureRow(1, 80);
    });

    // Should not throw error
    expect(true).toBe(true);
  });
});
