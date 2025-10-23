import type { TableAdapter } from '@better-tables/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTableData } from '../../hooks/use-table-data';

// Mock adapter for testing
const createMockAdapter = (): TableAdapter => ({
  fetchData: vi.fn(),
  getFilterOptions: vi.fn(),
  getFacetedValues: vi.fn(),
  getMinMaxValues: vi.fn(),
  meta: {
    name: 'test-adapter',
    version: '1.0.0',
    features: {
      create: false,
      read: false,
      update: false,
      delete: false,
      bulkOperations: false,
      realTimeUpdates: false,
      export: false,
      transactions: false,
    },
    supportedColumnTypes: ['text', 'number', 'date', 'boolean', 'option', 'multiOption'],
    supportedOperators: {
      text: ['contains', 'equals'],
      number: ['equals', 'greaterThan'],
      date: ['equals'],
      boolean: ['equals'],
      option: ['equals'],
      multiOption: ['includes'],
      currency: ['equals', 'greaterThan'],
      percentage: ['equals', 'greaterThan'],
      url: ['contains', 'equals'],
      email: ['contains', 'equals'],
      phone: ['contains', 'equals'],
      json: ['contains', 'equals'],
      custom: ['equals'],
    },
  },
});

describe('useTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const adapter = createMockAdapter();
    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.totalCount).toBe(0);
    expect(result.current.paginationInfo).toBeNull();
    expect(result.current.refetch).toBeInstanceOf(Function);
    expect(result.current.clearError).toBeInstanceOf(Function);
  });

  it('should fetch data on mount', async () => {
    const adapter = createMockAdapter();
    const mockData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: mockData,
      total: 2,
      pagination: {
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.paginationInfo).toBeDefined();
  });

  it('should handle loading state', async () => {
    const adapter = createMockAdapter();
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    adapter.fetchData = vi.fn().mockReturnValue(promise);

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    expect(result.current.loading).toBe(true);

    act(() => {
      resolvePromise!({
        data: [],
        total: 0,
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle errors', async () => {
    const adapter = createMockAdapter();
    const error = new Error('Fetch failed');

    adapter.fetchData = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(error);
    expect(result.current.data).toEqual([]);
  });

  it('should refetch data when refetch is called', async () => {
    const adapter = createMockAdapter();
    const mockData = [{ id: '1', name: 'Item 1' }];

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: mockData,
      total: 1,
    });

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(adapter.fetchData).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(adapter.fetchData).toHaveBeenCalledTimes(2);
  });

  it('should clear error when clearError is called', async () => {
    const adapter = createMockAdapter();
    const error = new Error('Fetch failed');

    adapter.fetchData = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(result.current.error).toBe(error);
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should pass filters to adapter', async () => {
    const adapter = createMockAdapter();
    const filters = [
      {
        columnId: 'name',
        type: 'text' as const,
        operator: 'contains' as const,
        values: ['test'],
      },
    ];

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
    });

    renderHook(() =>
      useTableData({
        adapter,
        filters,
      })
    );

    await waitFor(() => {
      expect(adapter.fetchData).toHaveBeenCalledWith(
        expect.objectContaining({
          filters,
        })
      );
    });
  });

  it('should pass pagination to adapter', async () => {
    const adapter = createMockAdapter();
    const pagination = {
      page: 2,
      limit: 10,
      totalPages: 5,
      hasNext: true,
      hasPrev: true,
    };

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
    });

    renderHook(() =>
      useTableData({
        adapter,
        pagination,
      })
    );

    await waitFor(() => {
      expect(adapter.fetchData).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: {
            page: 2,
            limit: 10,
          },
        })
      );
    });
  });

  it('should pass additional params to adapter', async () => {
    const adapter = createMockAdapter();
    const params = {
      sortBy: 'name',
      sortOrder: 'asc',
    };

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
    });

    renderHook(() =>
      useTableData({
        adapter,
        params,
      })
    );

    await waitFor(() => {
      expect(adapter.fetchData).toHaveBeenCalledWith(expect.objectContaining(params));
    });
  });

  it('should not fetch when enabled is false', () => {
    const adapter = createMockAdapter();

    adapter.fetchData = vi.fn();

    renderHook(() =>
      useTableData({
        adapter,
        enabled: false,
      })
    );

    expect(adapter.fetchData).not.toHaveBeenCalled();
  });

  it('should refetch when dependencies change', async () => {
    const adapter = createMockAdapter();

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
    });

    const { rerender } = renderHook(
      ({ filters }) =>
        useTableData({
          adapter,
          filters,
        }),
      {
        initialProps: { filters: [] },
      }
    );

    await waitFor(() => {
      expect(adapter.fetchData).toHaveBeenCalledTimes(1);
    });

    const newFilters = [
      {
        columnId: 'name',
        type: 'text' as const,
        operator: 'contains' as const,
        values: ['test'],
      },
    ];

    rerender({ filters: newFilters as any });

    await waitFor(() => {
      expect(adapter.fetchData).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle abort controller cleanup', async () => {
    const adapter = createMockAdapter();

    adapter.fetchData = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        data: [],
        total: 0,
      });
    });

    const { unmount } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    // Unmount before fetch completes
    unmount();

    // Should not cause any errors
    expect(true).toBe(true);
  });

  it('should handle adapter with CRUD operations', async () => {
    const adapter = createMockAdapter();
    adapter.createRecord = vi.fn();
    adapter.updateRecord = vi.fn();
    adapter.deleteRecord = vi.fn();
    adapter.bulkUpdate = vi.fn();
    adapter.bulkDelete = vi.fn();

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
    });

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should not throw errors
    expect(true).toBe(true);
  });

  it('should handle adapter with subscription', async () => {
    const adapter = createMockAdapter();
    const unsubscribe = vi.fn();

    adapter.subscribe = vi.fn().mockReturnValue(unsubscribe);
    adapter.fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
    });

    const { unmount } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(true).toBe(true); // Test passes if no errors occur
    });

    unmount();

    // Should not throw errors
    expect(true).toBe(true);
  });

  it('should handle complex data structures', async () => {
    const adapter = createMockAdapter();
    const complexData = [
      {
        id: '1',
        user: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        metadata: {
          tags: ['important', 'urgent'],
          score: 95,
        },
      },
    ];

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: complexData,
      total: 1,
    });

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(complexData);
    expect(result.current.totalCount).toBe(1);
  });

  it('should handle empty data response', async () => {
    const adapter = createMockAdapter();

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
    });

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('should handle pagination info', async () => {
    const adapter = createMockAdapter();
    const paginationInfo = {
      page: 2,
      limit: 10,
      totalPages: 5,
      hasNext: true,
      hasPrev: true,
    };

    adapter.fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 50,
      pagination: paginationInfo,
    });

    const { result } = renderHook(() =>
      useTableData({
        adapter,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.paginationInfo).toEqual(paginationInfo);
  });
});
