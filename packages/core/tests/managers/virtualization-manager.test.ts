import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { VirtualizationManager } from '../../src/managers/virtualization-manager';
import type { ScrollInfo, VirtualizationConfig } from '../../src/types/virtualization';
import { assertDefined } from '../../src/utils/assert-defined';

describe('VirtualizationManager', () => {
  let manager: VirtualizationManager;
  let mockSubscriber: ReturnType<typeof mock>;
  let resizeObserverConstructor: ReturnType<typeof mock>;

  beforeEach(() => {
    mockSubscriber = mock();

    // Mock ResizeObserver
    const mockObserve = mock();
    const mockUnobserve = mock();
    const mockDisconnect = mock();
    resizeObserverConstructor = mock();

    global.ResizeObserver = class ResizeObserver {
      observe = mockObserve;
      unobserve = mockUnobserve;
      disconnect = mockDisconnect;

      constructor(callback: ResizeObserverCallback) {
        resizeObserverConstructor(callback);
      }
    } as typeof ResizeObserver;
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      manager = new VirtualizationManager();

      const config = manager.getConfig();
      expect(config.containerHeight).toBe(400);
      expect(config.defaultRowHeight).toBe(40);
      expect(config.overscan).toBe(5);
      expect(config.smoothScrolling).toBe(true);
      expect(config.dynamicRowHeight).toBe(false);
    });

    it('should initialize with custom config', () => {
      const customConfig: Partial<VirtualizationConfig> = {
        containerHeight: 600,
        defaultRowHeight: 50,
        overscan: 10,
        dynamicRowHeight: true,
      };

      manager = new VirtualizationManager(customConfig);

      const config = manager.getConfig();
      expect(config.containerHeight).toBe(600);
      expect(config.defaultRowHeight).toBe(50);
      expect(config.overscan).toBe(10);
      expect(config.dynamicRowHeight).toBe(true);
    });

    it('should initialize with row and column counts', () => {
      manager = new VirtualizationManager({}, 1000, 10);

      const metrics = manager.getPerformanceMetrics();
      expect(metrics.totalRows).toBe(1000);
      expect(metrics.totalColumns).toBe(10);
    });
  });

  describe('scroll handling', () => {
    beforeEach(() => {
      manager = new VirtualizationManager(
        {
          containerHeight: 400,
          defaultRowHeight: 40,
          overscan: 2,
        },
        100 // 100 rows
      );
      manager.subscribe(mockSubscriber);
    });

    it('should update virtual items on scroll', () => {
      const scrollInfo: Partial<ScrollInfo> = {
        scrollTop: 200,
        clientHeight: 400,
      };

      manager.updateScroll(scrollInfo);

      const virtualRows = manager.getVirtualRows();
      expect(virtualRows.length).toBeGreaterThan(0);

      // Should have called subscribers
      expect(mockSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scroll',
          scrollInfo: expect.objectContaining(scrollInfo),
        })
      );
    });

    it('should calculate correct visible range', () => {
      const scrollInfo: Partial<ScrollInfo> = {
        scrollTop: 160, // Should start at row 4 (160 / 40)
        clientHeight: 400, // Should show 10 rows (400 / 40)
      };

      manager.updateScroll(scrollInfo);

      const state = manager.getState();
      expect(state.startIndex).toBe(4);
      expect(state.endIndex).toBe(13); // startIndex + visible rows - 1
    });

    it('should include overscan rows', () => {
      const scrollInfo: Partial<ScrollInfo> = {
        scrollTop: 160,
        clientHeight: 400,
      };

      manager.updateScroll(scrollInfo);

      const virtualRows = manager.getVirtualRows();

      // Should include overscan (2 before + visible + 2 after)
      expect(virtualRows.length).toBe(14); // 2 + 10 + 2
      expect(virtualRows[0]?.index).toBe(2); // overscan before
      expect(virtualRows.at(-1)?.index).toBe(15); // overscan after
    });
  });

  describe('dynamic row heights', () => {
    beforeEach(() => {
      manager = new VirtualizationManager(
        {
          containerHeight: 400,
          defaultRowHeight: 40,
          dynamicRowHeight: true,
        },
        100
      );
    });

    it('should measure and cache row heights', () => {
      manager.measureRow(5, 60);

      const virtualRows = manager.getVirtualRows();
      const row5 = virtualRows.find((row) => row.index === 5);

      if (row5) {
        expect(row5.height).toBe(60);
      }
    });

    it('should recalculate positions after height measurement', () => {
      // Measure a taller row
      manager.measureRow(2, 80); // 40 pixels taller than default

      manager.updateScroll({ scrollTop: 0, clientHeight: 400 });

      const virtualRows = manager.getVirtualRows();
      const row3 = virtualRows.find((row) => row.index === 3);

      if (row3) {
        // Row 3 should start at 160 (row 0: 40 + row 1: 40 + row 2: 80 = 160)
        expect(row3.start).toBe(160);
      }
    });

    it('should update total height when row heights change', () => {
      const initialState = manager.getState();
      const initialHeight = initialState.totalHeight;

      // Measure several rows with different heights
      manager.measureRow(0, 60);
      manager.measureRow(1, 80);
      manager.measureRow(2, 50);

      const newState = manager.getState();
      const expectedIncrease = 60 - 40 + (80 - 40) + (50 - 40); // 50 pixels

      expect(newState.totalHeight).toBe(initialHeight + expectedIncrease);
    });
  });

  describe('scrollTo functionality', () => {
    beforeEach(() => {
      manager = new VirtualizationManager(
        {
          containerHeight: 400,
          defaultRowHeight: 40,
        },
        100
      );
    });

    it('should scroll to start of row', () => {
      manager.scrollTo({ rowIndex: 10, align: 'start' });

      const state = manager.getState();
      expect(state.scrollInfo.scrollTop).toBe(400); // 10 * 40
    });

    it('should scroll to center of row', () => {
      manager.scrollTo({ rowIndex: 10, align: 'center' });

      const state = manager.getState();
      // Center position: row start - (container height - row height) / 2
      const expectedTop = 400 - (400 - 40) / 2;
      expect(state.scrollInfo.scrollTop).toBe(expectedTop);
    });

    it('should scroll to end of row', () => {
      manager.scrollTo({ rowIndex: 10, align: 'end' });

      const state = manager.getState();
      // End position: row end - container height
      const expectedTop = 440 - 400; // (10 * 40 + 40) - 400
      expect(state.scrollInfo.scrollTop).toBe(expectedTop);
    });

    it('should only scroll if row is not visible with auto alignment', () => {
      // Set current scroll position
      manager.updateScroll({ scrollTop: 200, clientHeight: 400 });

      // Try to scroll to a row that's already visible
      manager.scrollTo({ rowIndex: 7, align: 'auto' }); // Row 7 is at 280, which is visible

      const state = manager.getState();
      expect(state.scrollInfo.scrollTop).toBe(200); // Should not change
    });
  });

  describe('horizontal virtualization', () => {
    beforeEach(() => {
      manager = new VirtualizationManager(
        {
          containerHeight: 400,
          containerWidth: 800,
          defaultRowHeight: 40,
          defaultColumnWidth: 150,
          horizontalVirtualization: true,
        },
        100,
        50 // 50 columns
      );
    });

    it('should calculate virtual columns', () => {
      manager.updateScroll({
        scrollTop: 0,
        scrollLeft: 300, // Should start at column 2 (300 / 150)
        clientHeight: 400,
        clientWidth: 800,
      });

      const virtualColumns = manager.getVirtualColumns();
      expect(virtualColumns.length).toBeGreaterThan(0);

      const state = manager.getState();
      expect(state.startColumnIndex).toBe(2);
    });

    it('should scroll to column horizontally', () => {
      manager.scrollTo({ columnIndex: 10, align: 'start' });

      const state = manager.getState();
      expect(state.scrollInfo.scrollLeft).toBe(1500); // 10 * 150
    });
  });

  describe('performance optimization', () => {
    beforeEach(() => {
      manager = new VirtualizationManager(
        {
          containerHeight: 400,
          defaultRowHeight: 40,
          overscan: 5,
        },
        10000 // Large dataset
      );
    });

    it('should render only visible + overscan rows', () => {
      manager.updateScroll({ scrollTop: 1000, clientHeight: 400 });

      const virtualRows = manager.getVirtualRows();
      const metrics = manager.getPerformanceMetrics();

      // Should render much fewer than total rows
      expect(virtualRows.length).toBeLessThan(50);
      expect(metrics.efficiency).toBeGreaterThan(90); // > 90% efficiency
    });

    it('should provide performance metrics', () => {
      manager.updateScroll({ scrollTop: 0, clientHeight: 400 });

      const metrics = manager.getPerformanceMetrics();

      expect(metrics.totalRows).toBe(10000);
      expect(metrics.renderedRows).toBeGreaterThan(0);
      expect(metrics.efficiency).toBeGreaterThan(0);
      expect(metrics.memoryUsage.domNodes).toBeGreaterThan(0);
    });
  });

  describe('resize observer integration', () => {
    beforeEach(() => {
      manager = new VirtualizationManager(
        {
          dynamicRowHeight: true,
          defaultRowHeight: 40,
        },
        100
      );
    });

    it('should initialize resize observer for dynamic heights', () => {
      expect(resizeObserverConstructor).toHaveBeenCalled();
    });

    it('should observe elements when requested', () => {
      const mockElement = {
        dataset: {} as Record<string, string>,
      } as HTMLElement;
      const mockObserve = mock();
      const mockDisconnect = mock();

      // Mock the observe method
      (manager as unknown as { resizeObserver: ResizeObserver }).resizeObserver = {
        observe: mockObserve,
        unobserve: mock(),
        disconnect: mockDisconnect,
      } as ResizeObserver;

      manager.observeElement(mockElement, 5);

      expect(mockObserve).toHaveBeenCalledWith(mockElement);
      expect(mockElement.dataset.rowIndex).toBe('5');
    });
  });

  describe('configuration updates', () => {
    beforeEach(() => {
      manager = new VirtualizationManager({
        containerHeight: 400,
        defaultRowHeight: 40,
      });
      manager.subscribe(mockSubscriber);
    });

    it('should update configuration and recalculate', () => {
      const newConfig = {
        containerHeight: 600,
        defaultRowHeight: 50,
      };

      manager.updateConfig(newConfig);

      const config = manager.getConfig();
      expect(config.containerHeight).toBe(600);
      expect(config.defaultRowHeight).toBe(50);

      // Should notify subscribers
      expect(mockSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'configuration_updated',
          config: expect.objectContaining(newConfig),
        })
      );
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      manager = new VirtualizationManager();
    });

    it('should validate valid configuration', () => {
      const result = manager.validateConfig({
        containerHeight: 400,
        defaultRowHeight: 40,
        overscan: 5,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid container height', () => {
      const result = manager.validateConfig({
        containerHeight: -100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Container height must be greater than 0');
    });

    it('should reject invalid row height', () => {
      const result = manager.validateConfig({
        defaultRowHeight: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Default row height must be greater than 0');
    });

    it('should warn about large overscan', () => {
      const result = manager.validateConfig({
        overscan: 25,
      });

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('Large overscan values may impact performance');
    });

    it('should reject invalid min/max height combination', () => {
      const result = manager.validateConfig({
        minRowHeight: 100,
        maxRowHeight: 50,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Minimum row height cannot be greater than maximum');
    });
  });

  describe('subscription system', () => {
    beforeEach(() => {
      manager = new VirtualizationManager();
    });

    it('should notify on scroll events', () => {
      manager.subscribe(mockSubscriber);

      manager.updateScroll({ scrollTop: 100 });

      expect(mockSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scroll',
        })
      );
    });

    it('should notify on virtual items change', () => {
      manager.subscribe(mockSubscriber);

      manager.updateItemCounts(50);

      expect(mockSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'virtual_items_changed',
        })
      );
    });

    it('should unsubscribe properly', () => {
      const unsubscribe = manager.subscribe(mockSubscriber);
      unsubscribe();

      manager.updateScroll({ scrollTop: 100 });
      expect(mockSubscriber).not.toHaveBeenCalled();
    });
  });

  describe('state management', () => {
    beforeEach(() => {
      manager = new VirtualizationManager();
    });

    it('should enable and disable virtualization', () => {
      expect(manager.isEnabled()).toBe(true);

      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);

      manager.setEnabled(true);
      expect(manager.isEnabled()).toBe(true);
    });

    it('should reset measurements and recalculate', () => {
      manager.measureRow(5, 60);
      manager.reset();

      // After reset, should use default height again
      const virtualRows = manager.getVirtualRows();
      const row5 = virtualRows.find((row) => row.index === 5);

      if (row5) {
        expect(row5.height).toBe(40); // default height
      }
    });
  });

  describe('offset correctness (plan 024 regression)', () => {
    beforeEach(() => {
      manager = new VirtualizationManager(
        {
          containerHeight: 400,
          defaultRowHeight: 40,
          overscan: 0,
          dynamicRowHeight: true,
        },
        20
      );
    });

    it('(a) reflects a downstream measurement in a previously-cached row start', () => {
      // Cache row 10 at the default height first.
      manager.measureRow(10, 40);

      // Now grow an earlier row — row 10's cached start must shift with it.
      manager.measureRow(2, 80); // 40px taller than default

      // scrollTo(align: 'start') reads the row's start position internally;
      // if row 10's cached start is stale it will still report 400 (10 * 40)
      // instead of the true 440 (9 * 40 + 80).
      manager.scrollTo({ rowIndex: 10, align: 'start' });

      const state = manager.getState();
      expect(state.scrollInfo.scrollTop).toBe(440);
    });

    it('(b) keeps total size correct across repeated re-measurements', () => {
      const initialHeight = manager.getState().totalHeight; // 20 * 40 = 800

      manager.measureRow(5, 100); // +60
      manager.measureRow(5, 70); // net +30 (overwrite, not additive)
      manager.measureRow(1, 55); // +15

      expect(manager.getState().totalHeight).toBe(initialHeight + 30 + 15);
    });

    it('(c) findRowIndexByPosition agrees with true row starts after a downstream invalidation', () => {
      // Cache rows 0-5 at the default height.
      for (let i = 0; i <= 5; i++) {
        manager.measureRow(i, 40);
      }

      // Grow row 1 — this invalidates the cached starts of rows 2-5.
      manager.measureRow(1, 100); // +60

      // True start of row 5: rows 0-4 = 40 + 100 + 40 + 40 + 40 = 260.
      manager.updateScroll({ scrollTop: 260, clientHeight: 40 });

      const state = manager.getState();
      expect(state.startIndex).toBe(5);
    });

    it('(d) produces no overlaps or gaps across mixed measured/estimated rows', () => {
      // Cache a block of rows at the default height.
      for (let i = 0; i <= 5; i++) {
        manager.measureRow(i, 40);
      }

      // Grow an early row so the cached block (1-5) and the uncached/estimated
      // rows (6+) disagree about where the boundary between them is.
      manager.measureRow(1, 100); // +60

      manager.updateScroll({ scrollTop: 0, clientHeight: 400 });

      const rows = [...manager.getVirtualRows()].sort((a, b) => a.index - b.index);
      expect(rows.length).toBeGreaterThan(1);

      for (let i = 1; i < rows.length; i++) {
        const row = assertDefined(rows[i], `rows[${i}] missing`);
        const prevRow = assertDefined(rows[i - 1], `rows[${i - 1}] missing`);
        expect(row.start).toBe(prevRow.end);
      }
    });
  });

  describe('complexity guard (plan 024)', () => {
    it('amortizes offset revalidation instead of recomputing the whole prefix on every lookup', () => {
      manager = new VirtualizationManager(
        { containerHeight: 400, defaultRowHeight: 40, overscan: 0, dynamicRowHeight: true },
        50_000
      );

      // Test-only instrumentation: `offsetFillOperations` counts individual
      // offset slots filled by the internal linear pass; `getRowStart` is
      // otherwise private. Both accessed via a cast, same pattern the
      // existing resize-observer tests in this file already use.
      const internals = manager as unknown as {
        offsetFillOperations: number;
        getRowStart(rowIndex: number): number;
      };

      const afterConstruction = internals.offsetFillOperations;

      // Dirty the entire prefix by re-measuring the very first row.
      manager.measureRow(0, 60);
      const firstStart = internals.getRowStart(49_999);
      const firstQueryCost = internals.offsetFillOperations - afterConstruction;

      // The first query after a full invalidation legitimately walks
      // (close to) the whole 50k-row prefix once.
      expect(firstQueryCost).toBeGreaterThan(40_000);
      expect(firstStart).toBeGreaterThan(0);

      const afterFirstQuery = internals.offsetFillOperations;

      // Re-measuring a row right next to the already-queried tail should
      // only dirty a couple of slots, not the whole prefix again.
      manager.measureRow(49_998, 70);
      internals.getRowStart(49_999);
      const secondQueryCost = internals.offsetFillOperations - afterFirstQuery;

      expect(secondQueryCost).toBeLessThan(10);
    });
  });

  describe('cloning', () => {
    it('should clone manager with same state', () => {
      manager = new VirtualizationManager({ containerHeight: 500, defaultRowHeight: 50 }, 100);

      manager.measureRow(5, 80);
      manager.updateScroll({ scrollTop: 200, clientHeight: 500 });

      const cloned = manager.clone();

      expect(cloned.getConfig()).toEqual(manager.getConfig());
      expect(cloned.getState().totalHeight).toBe(manager.getState().totalHeight);
      expect(cloned.getVirtualRows().length).toBe(manager.getVirtualRows().length);
    });

    it('should not affect original when cloned manager is modified', () => {
      manager = new VirtualizationManager();
      manager.measureRow(5, 60);

      const cloned = manager.clone();
      cloned.measureRow(10, 100);

      // Original should not be affected
      const originalRows = manager.getVirtualRows();
      const row10 = originalRows.find((row) => row.index === 10);

      if (row10) {
        expect(row10.height).toBe(40); // default height
      }
    });
  });
});
