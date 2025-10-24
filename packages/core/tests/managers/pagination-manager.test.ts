import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaginationManager } from '../../src/managers/pagination-manager';
import type { PaginationConfig, PaginationState } from '../../src/types/pagination';

describe('PaginationManager', () => {
  let manager: PaginationManager;
  let mockSubscriber: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubscriber = vi.fn();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      manager = new PaginationManager();

      const state = manager.getPagination();
      expect(state.page).toBe(1);
      expect(state.limit).toBe(10);
      expect(state.totalPages).toBe(0);
      expect(state.hasNext).toBe(false);
      expect(state.hasPrev).toBe(false);
    });

    it('should initialize with custom config', () => {
      const config: PaginationConfig = {
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50],
        maxPageSize: 500,
        showPageSizeSelector: false,
        showPageNumbers: false,
        pageNumbersToShow: 5,
        showFirstLastButtons: false,
      };

      manager = new PaginationManager(config);

      const state = manager.getPagination();
      expect(state.limit).toBe(20);
    });

    it('should initialize with initial state', () => {
      const initialState: Partial<PaginationState> = {
        page: 3,
        limit: 25,
        totalPages: 10,
        hasNext: true,
        hasPrev: true,
      };

      manager = new PaginationManager({}, initialState);
      manager.setTotal(250); // Set total to make totalPages = 10 (250/25)

      const state = manager.getPagination();
      expect(state.page).toBe(3);
      expect(state.limit).toBe(25);
      expect(state.totalPages).toBe(10);
      expect(state.hasNext).toBe(true);
      expect(state.hasPrev).toBe(true);
    });
  });

  describe('page navigation', () => {
    beforeEach(() => {
      manager = new PaginationManager({}, { totalPages: 10 });
      manager.setTotal(100); // Set total to make totalPages = 10
    });

    it('should go to specific page', () => {
      manager.goToPage(5);

      const state = manager.getPagination();
      expect(state.page).toBe(5);
    });

    it('should go to next page', () => {
      manager.goToPage(3);
      manager.nextPage();

      const state = manager.getPagination();
      expect(state.page).toBe(4);
    });

    it('should go to previous page', () => {
      manager.goToPage(5);
      manager.prevPage();

      const state = manager.getPagination();
      expect(state.page).toBe(4);
    });

    it('should go to first page', () => {
      manager.goToPage(8);
      manager.firstPage();

      const state = manager.getPagination();
      expect(state.page).toBe(1);
    });

    it('should go to last page', () => {
      manager.goToPage(3);
      manager.lastPage();

      const state = manager.getPagination();
      expect(state.page).toBe(10);
    });

    it('should not go beyond boundaries', () => {
      manager.goToPage(1);
      manager.prevPage();

      expect(manager.getPagination().page).toBe(1);

      manager.goToPage(10);
      manager.nextPage();

      expect(manager.getPagination().page).toBe(10);
    });
  });

  describe('page size management', () => {
    beforeEach(() => {
      manager = new PaginationManager({ defaultPageSize: 10 });
    });

    it('should change page size', () => {
      manager.changePageSize(20); // Use allowed page size

      const state = manager.getPagination();
      expect(state.limit).toBe(20);
    });

    it('should reset to first page when changing page size', () => {
      manager.goToPage(5);
      manager.changePageSize(50);

      const state = manager.getPagination();
      expect(state.page).toBe(1);
      expect(state.limit).toBe(50);
    });

    it('should respect max page size', () => {
      manager = new PaginationManager({ maxPageSize: 100, pageSizeOptions: [10, 50, 100, 200] });
      manager.changePageSize(100); // Use max allowed size

      const state = manager.getPagination();
      expect(state.limit).toBe(100);
      
      // Try to exceed max - should throw error
      expect(() => manager.changePageSize(200)).toThrow('Invalid page size');
    });

    it('should get page size options', () => {
      const config: PaginationConfig = {
        pageSizeOptions: [10, 25, 50, 100],
      };

      manager = new PaginationManager(config);
      const options = manager.getPageSizeOptions();

      expect(options).toEqual([10, 25, 50, 100]);
    });
  });

  describe('total count management', () => {
    beforeEach(() => {
      manager = new PaginationManager({ defaultPageSize: 10 });
    });

    it('should update total count', () => {
      manager.setTotal(95);

      const state = manager.getPagination();
      expect(state.totalPages).toBe(10); // 95 items / 10 per page = 10 pages
      expect(state.hasNext).toBe(true);
      expect(state.hasPrev).toBe(false);
    });

    it('should calculate total pages correctly', () => {
      manager.setTotal(25);

      const state = manager.getPagination();
      expect(state.totalPages).toBe(3); // 25 items / 10 per page = 3 pages
    });

    it('should handle zero total', () => {
      manager.setTotal(0);

      const state = manager.getPagination();
      expect(state.totalPages).toBe(0);
      expect(state.hasNext).toBe(false);
      expect(state.hasPrev).toBe(false);
    });

    it('should adjust current page when total decreases', () => {
      manager.setTotal(100);
      manager.goToPage(8);
      manager.setTotal(50); // Only 5 pages now

      const state = manager.getPagination();
      expect(state.page).toBe(5); // Should adjust to last available page
    });
  });

  describe('configuration updates', () => {
    beforeEach(() => {
      manager = new PaginationManager({
        defaultPageSize: 10,
        pageSizeOptions: [10, 20, 50],
        maxPageSize: 100,
      });
    });

    it('should update configuration', () => {
      const newConfig: Partial<PaginationConfig> = {
        defaultPageSize: 25,
        pageSizeOptions: [25, 50, 100],
        maxPageSize: 200,
      };

      manager.updateConfig(newConfig);

      const config = manager.getConfig();
      expect(config.defaultPageSize).toBe(25);
      expect(config.pageSizeOptions).toEqual([25, 50, 100]);
      expect(config.maxPageSize).toBe(200);
    });

    it('should reset page size when max changes', () => {
      manager = new PaginationManager({ maxPageSize: 200, pageSizeOptions: [10, 50, 100, 200] });
      manager.changePageSize(200);
      manager.updateConfig({ maxPageSize: 100 });

      const state = manager.getPagination();
      expect(state.limit).toBe(100);
    });
  });

  describe('subscription system', () => {
    beforeEach(() => {
      manager = new PaginationManager();
      manager.subscribe(mockSubscriber);
    });

    it('should notify on page change', () => {
      manager.goToPage(3);

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'page_changed',
        page: 3,
        previousPage: 1,
      });
    });

    it('should notify on page size change', () => {
      manager = new PaginationManager({ pageSizeOptions: [10, 20, 50] });
      manager.subscribe(mockSubscriber); // Subscribe to notifications
      manager.changePageSize(20);

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'page_size_changed',
        pageSize: 20,
        previousPageSize: 10,
      });
    });

    it('should notify on total update', () => {
      manager.setTotal(100);

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'total_updated',
        total: 100,
        previousTotal: 0,
      });
    });

    it('should notify on pagination reset', () => {
      manager.reset();

      expect(mockSubscriber).toHaveBeenCalledWith({
        type: 'pagination_reset',
      });
    });

    it('should unsubscribe properly', () => {
      // Create a fresh manager to avoid interference from other tests
      const freshManager = new PaginationManager();
      const freshSubscriber = vi.fn();
      
      const unsubscribe = freshManager.subscribe(freshSubscriber);
      
      // Verify subscriber works before unsubscribe
      freshManager.goToPage(2);
      expect(freshSubscriber).toHaveBeenCalledTimes(1);
      
      // Now unsubscribe and verify it doesn't get called
      unsubscribe();
      
      freshManager.goToPage(3);
      expect(freshSubscriber).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      manager = new PaginationManager();
    });

    it('should validate page numbers correctly', () => {
      manager.setTotal(50); // 5 pages with 10 per page
      
      // Valid pages should not throw
      expect(() => manager.goToPage(1)).not.toThrow();
      expect(() => manager.goToPage(5)).not.toThrow();
      
      // Invalid pages should throw
      expect(() => manager.goToPage(0)).toThrow();
      expect(() => manager.goToPage(6)).toThrow();
      expect(() => manager.goToPage(-1)).toThrow();
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      manager = new PaginationManager({ defaultPageSize: 10 });
      manager.setTotal(95);
    });

    it('should get pagination info from state', () => {
      manager.goToPage(3);

      const state = manager.getPagination();
      expect(state.page).toBe(3);
      expect(state.totalPages).toBe(10);
      expect(state.limit).toBe(10);
    });

    it('should check if page exists', () => {
      expect(() => manager.goToPage(1)).not.toThrow();
      expect(() => manager.goToPage(10)).not.toThrow();
      expect(() => manager.goToPage(11)).toThrow();
      expect(() => manager.goToPage(0)).toThrow();
    });

    it('should get visible page numbers', () => {
      manager = new PaginationManager({ pageNumbersToShow: 5 });
        manager.setTotal(100);
      manager.goToPage(5);

      const visiblePages = manager.getPageNumbers();
      expect(visiblePages).toEqual([3, 4, 5, 6, 7]);
    });

    it('should handle edge cases for visible pages', () => {
      manager = new PaginationManager({ pageNumbersToShow: 5 });
      manager.setTotal(100);

      // First page
      manager.goToPage(1);
      let visiblePages = manager.getPageNumbers();
      expect(visiblePages).toEqual([1, 2, 3, 4, 5]);

      // Last page
      manager.goToPage(10);
      visiblePages = manager.getPageNumbers();
      expect(visiblePages).toEqual([6, 7, 8, 9, 10]);
    });
  });

  describe('state management', () => {
    it('should maintain state consistency', () => {
      manager = new PaginationManager({ defaultPageSize: 20 });
      manager.setTotal(100);
      manager.goToPage(3);

      const state = manager.getPagination();
      expect(state.page).toBe(3);
      expect(state.limit).toBe(20);
      expect(state.totalPages).toBe(5);
    });

    it('should handle state updates correctly', () => {
      manager = new PaginationManager();
      manager.setTotal(50);
      manager.goToPage(2);

      const cloned = new PaginationManager();
      cloned.setTotal(50);
      cloned.goToPage(4);

      expect(manager.getPagination().page).toBe(2);
      expect(cloned.getPagination().page).toBe(4);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      manager = new PaginationManager();
    });

    it('should handle subscriber errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      manager.subscribe(errorCallback);

      // Should not throw despite subscriber error
      expect(() => {
        manager.goToPage(2);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in pagination manager subscriber:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
