import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  // Common types
  BaseConfig,
  DataEvent,
  EventHandler,
  IconComponent,
  PaginationConfig,
  // Pagination types
  PaginationParams,
  PaginationState,
  RenderProps,
  // Sorting types
  SortDirection,
  SortingConfig,
  SortingParams,
  SortingState,
  TableTheme,
} from '../../src/types';

describe('Utility Types', () => {
  describe('Pagination Types', () => {
    it('should type PaginationParams correctly', () => {
      const params: PaginationParams = {
        page: 1,
        limit: 20,
      };

      expectTypeOf(params.page).toBeNumber();
      expectTypeOf(params.limit).toBeNumber();
    });

    it('should type PaginationState with metadata', () => {
      const state: PaginationState = {
        page: 2,
        limit: 50,
        totalPages: 10,
        hasNext: true,
        hasPrev: true,
      };

      expectTypeOf(state).toMatchTypeOf<PaginationParams>();
      expectTypeOf(state.totalPages).toBeNumber();
      expectTypeOf(state.hasNext).toBeBoolean();
      expectTypeOf(state.hasPrev).toBeBoolean();
    });

    it('should type PaginationConfig options', () => {
      const config: PaginationConfig = {
        defaultPageSize: 25,
        pageSizeOptions: [10, 25, 50, 100],
        maxPageSize: 100,
        showPageSizeSelector: true,
        showPageNumbers: true,
        pageNumbersToShow: 5,
        showFirstLastButtons: true,
      };

      expectTypeOf(config.defaultPageSize).toEqualTypeOf<number | undefined>();
      expectTypeOf(config.pageSizeOptions).toEqualTypeOf<number[] | undefined>();
    });
  });

  describe('Sorting Types', () => {
    it('should type SortDirection correctly', () => {
      const ascSort: SortDirection = 'asc';
      const descSort: SortDirection = 'desc';

      expectTypeOf(ascSort).toMatchTypeOf<SortDirection>();
      expectTypeOf(descSort).toMatchTypeOf<SortDirection>();
    });

    it('should type SortingParams correctly', () => {
      const sortParams: SortingParams = {
        columnId: 'name',
        direction: 'asc',
      };

      expectTypeOf(sortParams.columnId).toBeString();
      expectTypeOf(sortParams.direction).toEqualTypeOf<SortDirection>();
    });

    it('should type SortingState as array of SortingParams', () => {
      const sortingState: SortingState = [
        { columnId: 'name', direction: 'asc' },
        { columnId: 'createdAt', direction: 'desc' },
      ];

      expectTypeOf(sortingState).toEqualTypeOf<SortingParams[]>();
    });

    it('should type SortingConfig options', () => {
      const config: SortingConfig = {
        enabled: true,
        multiSort: true,
        maxSortColumns: 3,
        defaultSort: [{ columnId: 'id', direction: 'asc' }],
        resetOnClick: false,
        comparator: (a: unknown, b: unknown, columnId: string, direction: SortDirection) => {
          if (direction === 'asc') {
            return a[columnId] > b[columnId] ? 1 : -1;
          }
          return a[columnId] < b[columnId] ? 1 : -1;
        },
      };

      expectTypeOf(config.enabled).toEqualTypeOf<boolean | undefined>();
      expectTypeOf(config.comparator).toMatchTypeOf<
        (<T>(a: T, b: T, columnId: string, direction: SortDirection) => number) | undefined
      >();
    });
  });

  describe('Common Types', () => {
    it('should type BaseConfig correctly', () => {
      const config: BaseConfig = {
        id: 'test-config',
        name: 'Test Configuration',
        meta: {
          version: '1.0.0',
          author: 'Test Author',
          customField: true,
        },
      };

      expectTypeOf(config.id).toBeString();
      expectTypeOf(config.name).toEqualTypeOf<string | undefined>();
      expectTypeOf(config.meta).toEqualTypeOf<Record<string, unknown> | undefined>();
    });

    it('should type TableTheme correctly', () => {
      const theme: TableTheme = {
        name: 'dark',
        className: 'dark-theme',
        colors: {
          primary: '#1a1a1a',
          secondary: '#2a2a2a',
          success: '#00ff00',
          warning: '#ffff00',
          error: '#ff0000',
          customColor: '#custom',
        },
        components: {
          table: { borderRadius: '8px' },
          filter: { padding: '16px' },
          pagination: { gap: '8px' },
          customComponent: { margin: '0' },
        },
      };

      expectTypeOf(theme.colors).toMatchTypeOf<Record<string, string | undefined> | undefined>();
      expectTypeOf(theme.components).toMatchTypeOf<
        Record<string, Record<string, unknown> | undefined> | undefined
      >();
    });

    it('should type IconComponent correctly', () => {
      const icon: IconComponent = ({ className: _className, size: _size }) => null;

      expectTypeOf(icon).toMatchTypeOf<
        React.ComponentType<{ className?: string; size?: number }>
      >();
    });

    it('should type RenderProps with generics', () => {
      type User = { id: string; name: string };
      type Column = { id: string; displayName: string };

      const props: RenderProps<User, string, Column> = {
        row: { id: '1', name: 'John' },
        value: 'John',
        column: { id: 'name', displayName: 'Name' },
        rowIndex: 0,
        table: undefined,
      };

      expectTypeOf(props.row).toEqualTypeOf<User>();
      expectTypeOf(props.value).toEqualTypeOf<string>();
      expectTypeOf(props.column).toEqualTypeOf<Column>();
    });

    it('should type EventHandler correctly', () => {
      const voidHandler: EventHandler = (_event) => {
        // Event handled
      };

      const asyncHandler: EventHandler<{ id: string }> = async (event) => {
        await fetch(`/api/items/${event.id}`);
      };

      expectTypeOf(voidHandler).toMatchTypeOf<(event: unknown) => void | Promise<void>>();
      expectTypeOf(asyncHandler).toMatchTypeOf<(event: { id: string }) => void | Promise<void>>();
    });

    it('should type DataEvent for real-time updates', () => {
      type Item = { id: string; name: string };

      const insertEvent: DataEvent<Item> = {
        type: 'insert',
        data: { id: '1', name: 'New Item' },
      };

      const updateEvent: DataEvent<Item> = {
        type: 'update',
        data: [
          { id: '1', name: 'Updated Item 1' },
          { id: '2', name: 'Updated Item 2' },
        ],
        meta: { timestamp: Date.now(), userId: 'user123' },
      };

      const deleteEvent: DataEvent<Item> = {
        type: 'delete',
        data: { id: '1', name: 'Deleted Item' },
        meta: { reason: 'User requested deletion' },
      };

      expectTypeOf(insertEvent.type).toEqualTypeOf<'insert' | 'update' | 'delete'>();
      expectTypeOf(updateEvent.data).toMatchTypeOf<Item | Item[]>();
      expectTypeOf(deleteEvent.meta).toEqualTypeOf<Record<string, unknown> | undefined>();
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety across complex scenarios', () => {
      // Complex type scenario combining multiple types
      type UserData = {
        id: string;
        name: string;
        age: number;
        email: string;
        roles: string[];
      };

      // Column definition maintaining type safety
      const nameColumn: import('../../src/types').ColumnDefinition<UserData, string> = {
        id: 'name',
        displayName: 'User Name',
        accessor: (user) => user.name, // Type-safe accessor
        type: 'text',
        cellRenderer: ({ value, row }) => {
          // value is inferred as string
          // row is inferred as UserData
          return `${value} (${row.email})`;
        },
      };

      // Render props maintaining type safety
      const renderProps: RenderProps<UserData, string, typeof nameColumn> = {
        row: { id: '1', name: 'John', age: 30, email: 'john@example.com', roles: ['admin'] },
        value: 'John',
        column: nameColumn,
        rowIndex: 0,
      };

      expect(renderProps.value).toBe('John');
      expectTypeOf(renderProps.row.roles).toEqualTypeOf<string[]>();
    });
  });
});
