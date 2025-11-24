import { describe, expect, expectTypeOf, it } from 'bun:test';
import type {
  ColumnDefinition,
  EmptyStateConfig,
  EmptyStateProps,
  ErrorStateConfig,
  ExportConfig,
  LoadingStateConfig,
  RowConfig,
  TableAdapter,
  TableConfig,
  TableFeatures,
} from '../../src/types';

describe('Table Types', () => {
  describe('TableConfig', () => {
    it('should have correct structure', () => {
      type User = { id: string; name: string; email: string };

      const mockAdapter: TableAdapter<User> = {
        fetchData: async () => ({
          data: [],
          total: 0,
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        }),
        getFilterOptions: async () => [],
        getFacetedValues: async () => new Map(),
        getMinMaxValues: async () => [0, 0],
        meta: {
          name: 'MockAdapter',
          version: '1.0.0',
          features: {
            create: false,
            read: true,
            update: false,
            delete: false,
            bulkOperations: false,
            realTimeUpdates: false,
            export: false,
            transactions: false,
          },
          supportedColumnTypes: ['text'],
          supportedOperators: {
            text: ['contains'],
            number: [],
            date: [],
            boolean: [],
            option: [],
            multiOption: [],
            currency: [],
            percentage: [],
            url: [],
            email: [],
            phone: [],
            json: [],
            custom: [],
          },
        },
      };

      const tableConfig: TableConfig<User> = {
        id: 'users-table',
        name: 'Users Table',
        columns: [
          {
            id: 'name',
            displayName: 'Name',
            accessor: (row) => row.name,
            type: 'text',
          },
          {
            id: 'email',
            displayName: 'Email',
            accessor: (row) => row.email,
            type: 'email',
          },
        ],
        adapter: mockAdapter,
        features: {
          filtering: true,
          sorting: true,
          pagination: true,
        },
        groups: [
          {
            id: 'personal',
            label: 'Personal Info',
            columns: ['name', 'email'],
          },
        ],
        defaultFilters: [
          {
            columnId: 'name',
            type: 'text',
            operator: 'contains',
            values: [''],
          },
        ],
      };

      expectTypeOf(tableConfig.id).toBeString();
      expectTypeOf(tableConfig.columns).toEqualTypeOf<ColumnDefinition<User>[]>();
      expectTypeOf(tableConfig.adapter).toEqualTypeOf<TableAdapter<User>>();
    });
  });

  describe('TableFeatures', () => {
    it('should control feature flags', () => {
      const features: TableFeatures = {
        filtering: true,
        sorting: true,
        pagination: true,
        export: true,
        columnResizing: false,
        columnReordering: false,
        rowSelection: true,
        virtualScrolling: false,
        realTimeUpdates: false,
        columnVisibility: true,
        rowExpansion: true,
      };

      for (const [_key, value] of Object.entries(features)) {
        expect(typeof value).toBe('boolean');
      }
    });
  });

  describe('ExportConfig', () => {
    it('should configure export options', () => {
      const exportConfig: ExportConfig = {
        formats: ['csv', 'json', 'excel'],
        defaultFormat: 'csv',
        includeHiddenColumns: false,
        customHandler: async (_format, _data) => {
          // Export as format
        },
      };

      expectTypeOf(exportConfig.formats).toEqualTypeOf<('csv' | 'json' | 'excel')[] | undefined>();
      expectTypeOf(exportConfig.defaultFormat).toEqualTypeOf<
        'csv' | 'json' | 'excel' | undefined
      >();
    });
  });

  describe('RowConfig', () => {
    it('should configure row behavior', () => {
      type User = { id: string; name: string; isActive: boolean };

      const rowConfig: RowConfig<User> = {
        getId: (_row) => _row.id,
        isSelectable: (row) => row.isActive,
        isExpandable: (_row) => true,
        expandedContent: (row) => `Details for ${row.name}`,
        onClick: (_event) => {
          // Row clicked
        },
        className: (row) => (row.isActive ? 'active-row' : 'inactive-row'),
        style: (row) => ({
          opacity: row.isActive ? 1 : 0.5,
        }),
      };

      expectTypeOf(rowConfig.getId).toEqualTypeOf<((row: User) => string) | undefined>();
      expectTypeOf(rowConfig.className).toEqualTypeOf<
        string | ((row: User) => string) | undefined
      >();
    });
  });

  describe('EmptyStateConfig', () => {
    it('should configure empty state', () => {
      const emptyConfig: EmptyStateConfig = {
        title: 'No data found',
        description: 'Try adjusting your filters or add new items',
        component: ({ hasFilters: _hasFilters, onClearFilters: _onClearFilters }) => null,
      };

      expectTypeOf(emptyConfig.title).toEqualTypeOf<string | undefined>();
      expectTypeOf(emptyConfig.component).toMatchTypeOf<
        React.ComponentType<EmptyStateProps> | undefined
      >();
    });
  });

  describe('LoadingStateConfig', () => {
    it('should configure loading state', () => {
      const loadingConfig: LoadingStateConfig = {
        message: 'Loading data...',
        component: () => null,
      };

      expectTypeOf(loadingConfig.message).toEqualTypeOf<string | undefined>();
      expectTypeOf(loadingConfig.component).toMatchTypeOf<React.ComponentType | undefined>();
    });
  });

  describe('ErrorStateConfig', () => {
    it('should configure error state', () => {
      const errorConfig: ErrorStateConfig = {
        title: 'Something went wrong',
        component: ({ error: _error, onRetry: _onRetry }) => null,
        onRetry: () => {
          // Retrying
        },
      };

      expectTypeOf(errorConfig.title).toEqualTypeOf<string | undefined>();
      expectTypeOf(errorConfig.onRetry).toEqualTypeOf<(() => void) | undefined>();
    });
  });

  describe('Complete table configuration', () => {
    it('should work with all features combined', () => {
      type Product = {
        id: string;
        name: string;
        price: number;
        category: string;
        inStock: boolean;
      };

      const tableConfig: TableConfig<Product> = {
        id: 'products',
        name: 'Products',
        columns: [
          {
            id: 'name',
            displayName: 'Product Name',
            accessor: (row) => row.name,
            type: 'text',
            sortable: true,
            filterable: true,
          },
          {
            id: 'price',
            displayName: 'Price',
            accessor: (row) => row.price,
            type: 'currency',
            align: 'right',
            sortable: true,
            filterable: true,
            filter: {
              min: 0,
              max: 1000,
            },
          },
          {
            id: 'category',
            displayName: 'Category',
            accessor: (row) => row.category,
            type: 'option',
            filterable: true,
            filter: {
              options: [
                { value: 'electronics', label: 'Electronics' },
                { value: 'clothing', label: 'Clothing' },
                { value: 'food', label: 'Food' },
              ],
            },
          },
          {
            id: 'inStock',
            displayName: 'In Stock',
            accessor: (row) => row.inStock,
            type: 'boolean',
            cellRenderer: ({ value }) => (value ? '✓' : '✗'),
          },
        ],
        adapter: {} as TableAdapter<Product>,
        features: {
          filtering: true,
          sorting: true,
          pagination: true,
          export: true,
          rowSelection: true,
        },
        pagination: {
          defaultPageSize: 25,
          pageSizeOptions: [10, 25, 50, 100],
        },
        sorting: {
          enabled: true,
          multiSort: true,
          defaultSort: [{ columnId: 'name', direction: 'asc' }],
        },
        actions: [
          {
            id: 'delete',
            label: 'Delete',
            variant: 'destructive',
            handler: async (_ids) => {
              // Delete ids
            },
          },
          {
            id: 'export',
            label: 'Export',
            handler: async (_ids) => {
              // Export ids
            },
          },
        ],
        exportOptions: {
          formats: ['csv', 'json'],
          defaultFormat: 'csv',
        },
        rowConfig: {
          getId: (_row) => _row.id,
          isSelectable: (row) => row.inStock,
          className: (row) => (row.inStock ? '' : 'out-of-stock'),
        },
        emptyState: {
          title: 'No products found',
          description: 'Add products or adjust filters',
        },
        theme: {
          name: 'default',
          colors: {
            primary: '#007bff',
            secondary: '#6c757d',
          },
        },
      };

      expect(tableConfig.features?.filtering).toBe(true);
      expect(tableConfig.columns).toHaveLength(4);
      expectTypeOf(tableConfig).toEqualTypeOf<TableConfig<Product>>();
    });
  });
});
