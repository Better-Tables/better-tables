import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BooleanColumnBuilder,
  ColumnBuilder,
  type ColumnFactory,
  column,
  createColumnBuilder,
  createColumnBuilders,
  DateColumnBuilder,
  MultiOptionColumnBuilder,
  NumberColumnBuilder,
  OptionColumnBuilder,
  quickColumn,
  TextColumnBuilder,
  typed,
  validateColumns,
} from '../../src/builders';
import type { ColumnDefinition } from '../../src/types/column';

// Test data types
interface TestUser {
  id: string;
  name: string;
  email: string;
  age: number;
  isActive: boolean;
  createdAt: Date;
  status: 'active' | 'inactive' | 'pending';
  tags: string[];
  score: number;
}

describe('Column Builder System', () => {
  describe('Base ColumnBuilder', () => {
    it('should create a column builder with required methods', () => {
      const builder = new ColumnBuilder<TestUser, string>('text');

      expect(builder).toBeDefined();
      expect(typeof builder.id).toBe('function');
      expect(typeof builder.displayName).toBe('function');
      expect(typeof builder.accessor).toBe('function');
      expect(typeof builder.build).toBe('function');
    });

    it('should build a valid column definition', () => {
      const builder = new ColumnBuilder<TestUser, string>('text');

      const column = builder
        .id('name')
        .displayName('Full Name')
        .accessor((user) => user.name)
        .build();

      expect(column).toEqual({
        id: 'name',
        displayName: 'Full Name',
        accessor: expect.any(Function),
        type: 'text',
        sortable: true,
        filterable: true,
        resizable: true,
        align: 'left',
        nullable: false,
      });
    });

    it('should throw error for missing required fields', () => {
      const builder = new ColumnBuilder<TestUser, string>('text');

      expect(() => builder.build()).toThrow('Column ID is required');
      expect(() => builder.id('test').build()).toThrow('Column display name is required');
      expect(() => builder.id('test').displayName('Test').build()).toThrow(
        'Column accessor is required'
      );
    });

    it('should configure column properties correctly', () => {
      const builder = new ColumnBuilder<TestUser, string>('text');

      const column = builder
        .id('name')
        .displayName('Full Name')
        .accessor((user) => user.name)
        .sortable(false)
        .filterable(false)
        .resizable(false)
        .width(200, 100, 300)
        .align('center')
        .nullable(true)
        .build();

      expect(column.sortable).toBe(false);
      expect(column.filterable).toBe(false);
      expect(column.resizable).toBe(false);
      expect(column.width).toBe(200);
      expect(column.minWidth).toBe(100);
      expect(column.maxWidth).toBe(300);
      expect(column.align).toBe('center');
      expect(column.nullable).toBe(true);
    });
  });

  describe('TextColumnBuilder', () => {
    it('should create a text column builder', () => {
      const builder = new TextColumnBuilder<TestUser>();

      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .searchable()
        .build();

      expect(column.type).toBe('text');
      expect(column.filter?.operators).toEqual([
        'contains',
        'equals',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
      ]);
      expect(column.filter?.debounce).toBe(300);
    });

    it('should configure text-specific options', () => {
      const builder = new TextColumnBuilder<TestUser>();

      const column = builder
        .id('email')
        .displayName('Email')
        .accessor((user) => user.email)
        .asEmail()
        .truncate({ maxLength: 50 })
        .transform('lowercase')
        .build();

      expect(column.type).toBe('email');
      expect(column.meta?.truncate).toEqual({
        maxLength: 50,
        showTooltip: true,
        suffix: '...',
      });
      expect(column.meta?.textTransform).toBe('lowercase');
    });
  });

  describe('NumberColumnBuilder', () => {
    it('should create a number column builder', () => {
      const builder = new NumberColumnBuilder<TestUser>();

      const column = builder
        .id('age')
        .displayName('Age')
        .accessor((user) => user.age)
        .range(0, 120)
        .build();

      expect(column.type).toBe('number');
      expect(column.filter?.min).toBe(0);
      expect(column.filter?.max).toBe(120);
      expect(column.filter?.operators).toEqual([
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'between',
        'notBetween',
      ]);
    });

    it('should configure as currency', () => {
      const builder = new NumberColumnBuilder<TestUser>();

      const column = builder
        .id('score')
        .displayName('Score')
        .accessor((user) => user.score)
        .currency({ currency: 'EUR', locale: 'en-GB' })
        .build();

      expect(column.type).toBe('currency');
      expect(column.meta?.currency).toEqual({
        currency: 'EUR',
        locale: 'en-GB',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        showSymbol: true,
      });
    });

    it('should configure as percentage', () => {
      const builder = new NumberColumnBuilder<TestUser>();

      const column = builder
        .id('score')
        .displayName('Score')
        .accessor((user) => user.score)
        .percentage({ format: 'percentage' })
        .build();

      expect(column.type).toBe('percentage');
      expect((column.meta?.percentage as { format: string })?.format).toBe('percentage');
    });
  });

  describe('DateColumnBuilder', () => {
    it('should create a date column builder', () => {
      const builder = new DateColumnBuilder<TestUser>();

      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((user) => user.createdAt)
        .format('yyyy-MM-dd')
        .build();

      expect(column.type).toBe('date');
      expect((column.meta?.dateFormat as { format: string })?.format).toBe('yyyy-MM-dd');
    });

    it('should configure date-specific options', () => {
      const builder = new DateColumnBuilder<TestUser>();

      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((user) => user.createdAt)
        .dateTime({ timeZone: 'America/New_York' })
        .relative()
        .build();

      expect((column.meta?.dateFormat as { showTime: boolean })?.showTime).toBe(true);
      expect((column.meta?.dateFormat as { timeZone: string })?.timeZone).toBe('America/New_York');
      expect((column.meta?.dateFormat as { showRelative: boolean })?.showRelative).toBe(true);
    });

    it('should handle relative() method without existing dateFormat config', () => {
      const builder = new DateColumnBuilder<TestUser>();

      const column = builder
        .id('createdAt')
        .displayName('Created At')
        .accessor((user) => user.createdAt)
        .relative({ locale: 'en-US', numeric: 'always', style: 'short' })
        .build();

      expect((column.meta?.dateFormat as { showRelative: boolean })?.showRelative).toBe(true);
      expect((column.meta?.dateFormat as { locale: string })?.locale).toBe('en-US');
      expect(
        (column.meta?.dateFormat as { relativeOptions: { numeric: string } })?.relativeOptions
          ?.numeric
      ).toBe('always');
      expect(
        (column.meta?.dateFormat as { relativeOptions: { style: string } })?.relativeOptions?.style
      ).toBe('short');
    });
  });

  describe('OptionColumnBuilder', () => {
    it('should create an option column builder', () => {
      const builder = new OptionColumnBuilder<TestUser>();

      const options = [
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'inactive', label: 'Inactive', color: 'red' },
      ];

      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .options(options)
        .build();

      expect(column.type).toBe('option');
      expect(column.filter?.options).toEqual(options);
      expect(column.filter?.operators).toEqual(['is', 'isNot', 'isAnyOf', 'isNoneOf']);
    });

    it('should configure predefined status options', () => {
      const builder = new OptionColumnBuilder<TestUser>();

      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .status([
          { value: 'active', label: 'Active', color: 'green' },
          { value: 'inactive', label: 'Inactive', color: 'red' },
        ])
        .build();

      expect((column.meta?.status as { showBadge: boolean })?.showBadge).toBe(true);
    });
  });

  describe('MultiOptionColumnBuilder', () => {
    it('should create a multi-option column builder', () => {
      const builder = new MultiOptionColumnBuilder<TestUser>();

      const options = [
        { value: 'vip', label: 'VIP' },
        { value: 'lead', label: 'Lead' },
      ];

      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((user) => user.tags)
        .options(options)
        .build();

      expect(column.type).toBe('multiOption');
      expect(column.filter?.options).toEqual(options);
      expect(column.filter?.operators).toEqual([
        'includes',
        'excludes',
        'includesAny',
        'includesAll',
        'excludesAny',
        'excludesAll',
      ]);
    });

    it('should configure tags with validation', () => {
      const builder = new MultiOptionColumnBuilder<TestUser>();

      const options = [
        { value: 'vip', label: 'VIP' },
        { value: 'lead', label: 'Lead' },
      ];

      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((user) => user.tags)
        .tags(options, { maxTags: 5, allowCreate: true })
        .build();

      expect((column.meta?.tags as { allowCreate: boolean })?.allowCreate).toBe(true);
      expect((column.meta?.options as { maxSelections: number })?.maxSelections).toBe(5);
    });

    it('should configure badges display without existing display config', () => {
      const builder = new MultiOptionColumnBuilder<TestUser>();

      const options = [
        { value: 'vip', label: 'VIP' },
        { value: 'lead', label: 'Lead' },
      ];

      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((user) => user.tags)
        .options(options)
        .showBadges({
          variant: 'secondary',
          showColors: false,
          showIcons: false,
          removable: false,
        })
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('chips');
      expect((column.meta?.display as { variant: string })?.variant).toBe('secondary');
      expect((column.meta?.display as { showColors: boolean })?.showColors).toBe(false);
      expect((column.meta?.display as { showIcons: boolean })?.showIcons).toBe(false);
      expect((column.meta?.display as { removable: boolean })?.removable).toBe(false);
    });

    it('should configure badges display with existing display config', () => {
      const builder = new MultiOptionColumnBuilder<TestUser>();

      const options = [
        { value: 'vip', label: 'VIP' },
        { value: 'lead', label: 'Lead' },
      ];

      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((user) => user.tags)
        .options(options)
        .displayFormat({ type: 'comma', separator: '; ' })
        .showBadges({ variant: 'outline' })
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('chips');
      expect((column.meta?.display as { separator: string })?.separator).toBe('; '); // Should preserve existing config
      expect((column.meta?.display as { variant: string })?.variant).toBe('outline');
    });
  });

  describe('BooleanColumnBuilder', () => {
    it('should create a boolean column builder', () => {
      const builder = new BooleanColumnBuilder<TestUser>();

      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .booleanFilter()
        .build();

      expect(column.type).toBe('boolean');
      expect(column.filter?.operators).toEqual(['isTrue', 'isFalse', 'isNull', 'isNotNull']);
    });

    it('should configure boolean display formats', () => {
      const builder = new BooleanColumnBuilder<TestUser>();

      const column = builder
        .id('isActive')
        .displayName('Is Active')
        .accessor((user) => user.isActive)
        .activeInactive()
        .build();

      expect((column.meta?.display as { type: string })?.type).toBe('badge');
      expect((column.meta?.display as { trueText: string })?.trueText).toBe('Active');
      expect((column.meta?.display as { falseText: string })?.falseText).toBe('Inactive');
    });
  });

  describe('Column Factory', () => {
    it('should create a typed column factory', () => {
      const cb = createColumnBuilder<TestUser>();

      expectTypeOf(cb).toMatchTypeOf<ColumnFactory<TestUser>>();
      expect(typeof cb.text).toBe('function');
      expect(typeof cb.number).toBe('function');
      expect(typeof cb.date).toBe('function');
      expect(typeof cb.boolean).toBe('function');
      expect(typeof cb.option).toBe('function');
      expect(typeof cb.multiOption).toBe('function');
    });

    it('should create columns with proper types', () => {
      const cb = createColumnBuilder<TestUser>();

      const textColumn = cb
        .text()
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .build();

      const numberColumn = cb
        .number()
        .id('age')
        .displayName('Age')
        .accessor((user) => user.age)
        .build();

      expect(textColumn.type).toBe('text');
      expect(numberColumn.type).toBe('number');
    });

    it('should work with global column factory', () => {
      const textColumn = column
        .text()
        .id('name')
        .displayName('Name')
        .accessor((data: unknown) => (data as TestUser).name)
        .build();

      expect(textColumn.type).toBe('text');
    });

    it('should work with typed alias', () => {
      const cb = typed<TestUser>();

      const column = cb
        .text()
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .build();

      expect(column.type).toBe('text');
    });

    it('should create multiple typed column builders', () => {
      interface User {
        id: string;
        name: string;
      }

      interface Order {
        id: string;
        total: number;
      }

      interface Product {
        id: string;
        title: string;
        price: number;
      }

      const builders = createColumnBuilders({
        users: {} as User,
        orders: {} as Order,
        products: {} as Product,
      });

      expect(typeof builders.users.text).toBe('function');
      expect(typeof builders.orders.number).toBe('function');
      expect(typeof builders.products.text).toBe('function');

      // Test that each builder is properly typed
      const userColumn = builders.users
        .text()
        .id('name')
        .displayName('Name')
        .accessor((user: User) => user.name)
        .build();

      const orderColumn = builders.orders
        .number()
        .id('total')
        .displayName('Total')
        .accessor((order: Order) => order.total)
        .build();

      const productColumn = builders.products
        .text()
        .id('title')
        .displayName('Title')
        .accessor((product: Product) => product.title)
        .build();

      expect(userColumn.type).toBe('text');
      expect(orderColumn.type).toBe('number');
      expect(productColumn.type).toBe('text');
    });

    it('should handle empty types object', () => {
      const builders = createColumnBuilders({});
      expect(Object.keys(builders)).toHaveLength(0);
    });
  });

  describe('Column Validation', () => {
    it('should validate column definitions', () => {
      const cb = createColumnBuilder<TestUser>();

      const validColumns = [
        cb
          .text()
          .id('name')
          .displayName('Name')
          .accessor((user) => user.name)
          .build(),
        cb
          .number()
          .id('age')
          .displayName('Age')
          .accessor((user) => user.age)
          .build(),
      ];

      const validation = validateColumns(validColumns as ColumnDefinition<unknown, unknown>[]);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const invalidColumns = [
        { displayName: 'Name', accessor: (user: TestUser) => user.name, type: 'text' },
        { id: 'age', accessor: (user: TestUser) => user.age, type: 'number' },
      ];

      const validation = validateColumns(
        invalidColumns as unknown as ColumnDefinition<unknown, unknown>[]
      );
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Column at index 0 is missing required 'id' field");
      expect(validation.errors).toContain(
        "Column at index 1 is missing required 'displayName' field"
      );
    });

    it('should detect duplicate column IDs', () => {
      const cb = createColumnBuilder<TestUser>();

      const columnsWithDuplicates = [
        cb
          .text()
          .id('name')
          .displayName('Name')
          .accessor((user) => user.name)
          .build(),
        cb
          .text()
          .id('name')
          .displayName('Full Name')
          .accessor((user) => user.name)
          .build(),
      ];

      const validation = validateColumns(
        columnsWithDuplicates as ColumnDefinition<unknown, unknown>[]
      );
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Duplicate column ID 'name' found at index 1");
    });
  });

  describe('Quick Column Helper', () => {
    it('should create a quick column with defaults', () => {
      const column = quickColumn<TestUser, string>('name', 'Full Name', (user) => user.name);

      expect(column.id).toBe('name');
      expect(column.displayName).toBe('Full Name');
      expect(column.type).toBe('text');
      expect(column.sortable).toBe(true);
      expect(column.filterable).toBe(true);
    });

    it('should create a quick column with options', () => {
      const column = quickColumn<TestUser, number>('age', 'Age', (user) => user.age, {
        type: 'number',
        width: 100,
        sortable: false,
      });

      expect(column.id).toBe('age');
      expect(column.type).toBe('number');
      expect(column.width).toBe(100);
      expect(column.sortable).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety with accessor functions', () => {
      const cb = createColumnBuilder<TestUser>();

      // This should compile without errors
      const column = cb
        .text()
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name) // TypeScript should infer user as TestUser
        .build();

      expect(column.accessor).toBeDefined();

      // Test that accessor returns the correct type
      const testUser: TestUser = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        createdAt: new Date(),
        status: 'active',
        tags: ['vip'],
        score: 85,
      };

      const result = column.accessor(testUser);
      expect(result).toBe('John Doe');
      expectTypeOf(result).toBeString();
    });

    it('should maintain type safety with column definitions', () => {
      const cb = createColumnBuilder<TestUser>();

      const column = cb
        .text()
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .build();

      expectTypeOf(column).toMatchTypeOf<ColumnDefinition<TestUser, string>>();
    });
  });
});
