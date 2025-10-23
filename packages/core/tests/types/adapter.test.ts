import { describe, expectTypeOf, it } from 'vitest';
import type {
  AdapterConfig,
  AdapterFeatures,
  AdapterMeta,
  DataEvent,
  ExportParams,
  ExportResult,
  FetchDataParams,
  FetchDataResult,
  FilterState,
  TableAdapter,
} from '../../src/types';

describe('Adapter Types', () => {
  describe('TableAdapter', () => {
    it('should define required methods', () => {
      const adapter: TableAdapter<{ id: string; name: string }> = {
        fetchData: async (_params) => ({
          data: [],
          total: 0,
          pagination: {
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        }),
        getFilterOptions: async (_columnId) => [],
        getFacetedValues: async (_columnId) => new Map(),
        getMinMaxValues: async (_columnId) => [0, 100],
        meta: {
          name: 'TestAdapter',
          version: '1.0.0',
          features: {
            create: true,
            read: true,
            update: true,
            delete: true,
            bulkOperations: true,
            realTimeUpdates: false,
            export: true,
            transactions: true,
          },
          supportedColumnTypes: ['text', 'number'],
          supportedOperators: {
            text: ['contains', 'equals'],
            number: ['equals', 'greaterThan'],
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

      expectTypeOf(adapter.fetchData).toBeFunction();
      expectTypeOf(adapter.getFilterOptions).toBeFunction();
      expectTypeOf(adapter.getFacetedValues).toBeFunction();
      expectTypeOf(adapter.getMinMaxValues).toBeFunction();
    });

    it('should support optional methods', () => {
      const adapter: TableAdapter = {
        fetchData: async () => ({ data: [], total: 0, pagination: {} as any }),
        getFilterOptions: async () => [],
        getFacetedValues: async () => new Map(),
        getMinMaxValues: async () => [0, 0],
        createRecord: async (data) => ({ id: '1', ...data }),
        updateRecord: async (_id, data) => ({ id: _id, ...data }),
        deleteRecord: async (_id) => {},
        bulkUpdate: async (_ids, data) => _ids.map((id) => ({ id, ...data })),
        bulkDelete: async (_ids) => {},
        exportData: async (_params) => ({
          data: new Blob(),
          filename: 'export.csv',
          mimeType: 'text/csv',
        }),
        subscribe: (_callback) => {
          // Subscribe logic
          return () => {
            // Unsubscribe logic
          };
        },
        meta: {} as AdapterMeta,
      };

      expectTypeOf(adapter.createRecord).toEqualTypeOf<
        ((data: Partial<any>) => Promise<any>) | undefined
      >();
      expectTypeOf(adapter.subscribe).toEqualTypeOf<
        ((callback: (event: DataEvent<any>) => void) => () => void) | undefined
      >();
    });
  });

  describe('FetchDataParams', () => {
    it('should include all query parameters', () => {
      const params: FetchDataParams = {
        pagination: { page: 2, limit: 50 },
        sorting: [
          { columnId: 'name', direction: 'asc' },
          { columnId: 'createdAt', direction: 'desc' },
        ],
        filters: [
          {
            columnId: 'status',
            type: 'option',
            operator: 'is',
            values: ['active'],
          },
        ],
        search: 'john',
        columns: ['id', 'name', 'email'],
        params: { customParam: 'value' },
      };

      expectTypeOf(params.pagination).toMatchTypeOf<{ page: number; limit: number } | undefined>();
      expectTypeOf(params.sorting).toMatchTypeOf<
        Array<{ columnId: string; direction: 'asc' | 'desc' }> | undefined
      >();
      expectTypeOf(params.filters).toMatchTypeOf<FilterState[] | undefined>();
    });
  });

  describe('FetchDataResult', () => {
    it('should return paginated data', () => {
      type User = { id: string; name: string };

      const result: FetchDataResult<User> = {
        data: [
          { id: '1', name: 'John' },
          { id: '2', name: 'Jane' },
        ],
        total: 100,
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
        },
        faceted: {
          status: new Map([
            ['active', 80],
            ['inactive', 20],
          ]),
        },
        meta: {
          executionTime: 123,
        },
      };

      expectTypeOf(result.data).toEqualTypeOf<User[]>();
      expectTypeOf(result.total).toBeNumber();
      expectTypeOf(result.faceted).toEqualTypeOf<Record<string, Map<string, number>> | undefined>();
    });
  });

  describe('ExportParams and ExportResult', () => {
    it('should define export parameters', () => {
      const exportParams: ExportParams = {
        format: 'csv',
        columns: ['id', 'name', 'email'],
        ids: ['1', '2', '3'],
        includeHeaders: true,
        options: {
          delimiter: ',',
          encoding: 'utf-8',
        },
      };

      expectTypeOf(exportParams.format).toEqualTypeOf<'csv' | 'json' | 'excel'>();
      expectTypeOf(exportParams.ids).toEqualTypeOf<string[] | undefined>();
    });

    it('should define export result', () => {
      const exportResult: ExportResult = {
        data: new Blob(['id,name\n1,John'], { type: 'text/csv' }),
        filename: 'users-export.csv',
        mimeType: 'text/csv',
      };

      expectTypeOf(exportResult.data).toMatchTypeOf<Blob | string>();
      expectTypeOf(exportResult.filename).toBeString();
      expectTypeOf(exportResult.mimeType).toBeString();
    });
  });

  describe('AdapterMeta', () => {
    it('should describe adapter capabilities', () => {
      const meta: AdapterMeta = {
        name: 'DrizzleAdapter',
        version: '1.0.0',
        features: {
          create: true,
          read: true,
          update: true,
          delete: true,
          bulkOperations: true,
          realTimeUpdates: false,
          export: true,
          transactions: true,
        },
        supportedColumnTypes: ['text', 'number', 'date', 'boolean', 'option', 'multiOption'],
        supportedOperators: {
          text: ['contains', 'equals', 'startsWith', 'endsWith'],
          number: ['equals', 'greaterThan', 'lessThan', 'between'],
          date: ['is', 'before', 'after', 'between'],
          boolean: ['isTrue', 'isFalse'],
          option: ['is', 'isNot', 'isAnyOf'],
          multiOption: ['includes', 'includesAny'],
          currency: [],
          percentage: [],
          url: [],
          email: [],
          phone: [],
          json: [],
          custom: [],
        },
      };

      expectTypeOf(meta.features).toEqualTypeOf<AdapterFeatures>();
      expectTypeOf(meta.supportedColumnTypes).toEqualTypeOf<
        Array<import('../../src/types').ColumnType>
      >();
    });
  });

  describe('AdapterConfig', () => {
    it('should define adapter configuration', () => {
      const config: AdapterConfig = {
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test',
        },
        cache: {
          enabled: true,
          ttl: 3600,
          maxSize: 1000,
        },
        logging: {
          enabled: true,
          level: 'debug',
        },
        performance: {
          maxPageSize: 100,
          defaultPageSize: 20,
          enableVirtualScrolling: true,
        },
      };

      expectTypeOf(config.cache).toMatchTypeOf<
        { enabled: boolean; ttl: number; maxSize: number } | undefined
      >();
      expectTypeOf(config.logging?.level).toEqualTypeOf<
        'debug' | 'info' | 'warn' | 'error' | undefined
      >();
    });
  });

  describe('DataEvent', () => {
    it('should represent real-time data events', () => {
      type User = { id: string; name: string };

      const insertEvent: DataEvent<User> = {
        type: 'insert',
        data: { id: '1', name: 'John' },
        meta: { timestamp: Date.now() },
      };

      const updateEvent: DataEvent<User> = {
        type: 'update',
        data: [
          { id: '1', name: 'John Updated' },
          { id: '2', name: 'Jane Updated' },
        ],
      };

      const _deleteEvent: DataEvent<User> = {
        type: 'delete',
        data: { id: '1', name: 'John' },
      };

      expectTypeOf(insertEvent.type).toEqualTypeOf<'insert' | 'update' | 'delete'>();
      expectTypeOf(updateEvent.data).toMatchTypeOf<User | User[]>();
    });
  });
});
