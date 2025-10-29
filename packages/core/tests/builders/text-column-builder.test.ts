import { describe, expect, it } from 'vitest';
import { TextColumnBuilder } from '../../src/builders/text-column-builder';

interface TestUser {
  id: string;
  name: string;
  email: string;
  website: string;
  phone: string;
  description: string;
}

describe('TextColumnBuilder Enhancements', () => {
  describe('asPhone method', () => {
    it('should change column type to phone', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('phone')
        .displayName('Phone Number')
        .accessor((user) => user.phone)
        .asPhone()
        .build();

      expect(column.type).toBe('phone');
    });

    it('should preserve other column properties when using asPhone', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('phone')
        .displayName('Phone Number')
        .accessor((user) => user.phone)
        .searchable()
        .asPhone()
        .build();

      expect(column.type).toBe('phone');
      expect(column.id).toBe('phone');
      expect(column.displayName).toBe('Phone Number');
      expect(column.filter?.operators).toBeDefined();
    });

    it('should support method chaining with asPhone', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('phone')
        .displayName('Phone Number')
        .accessor((user) => user.phone)
        .asPhone()
        .truncate({ maxLength: 20 })
        .build();

      expect(column.type).toBe('phone');
      expect(column.meta?.truncate?.maxLength).toBe(20);
    });

    it('should work with textOperators', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('phone')
        .displayName('Phone Number')
        .accessor((user) => user.phone)
        .asPhone()
        .textOperators(['equals', 'contains'])
        .build();

      expect(column.type).toBe('phone');
      expect(column.filter?.operators).toEqual(['equals', 'contains']);
    });
  });

  describe('asUrl method', () => {
    it('should change column type to url', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('website')
        .displayName('Website')
        .accessor((user) => user.website)
        .asUrl()
        .build();

      expect(column.type).toBe('url');
    });

    it('should preserve other column properties when using asUrl', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('website')
        .displayName('Website')
        .accessor((user) => user.website)
        .searchable({ debounce: 500 })
        .asUrl()
        .build();

      expect(column.type).toBe('url');
      expect(column.id).toBe('website');
      expect(column.displayName).toBe('Website');
      expect(column.filter?.debounce).toBe(500);
    });

    it('should support method chaining with asUrl', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('website')
        .displayName('Website')
        .accessor((user) => user.website)
        .asUrl()
        .transform('lowercase')
        .build();

      expect(column.type).toBe('url');
      expect(column.meta?.textTransform).toBe('lowercase');
    });

    it('should work with textOperators', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('website')
        .displayName('Website')
        .accessor((user) => user.website)
        .asUrl()
        .textOperators(['equals', 'startsWith', 'contains'])
        .build();

      expect(column.type).toBe('url');
      expect(column.filter?.operators).toEqual(['equals', 'startsWith', 'contains']);
    });

    it('should override previous type when asUrl is called after asPhone', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('contact')
        .displayName('Contact')
        .accessor((user) => user.phone)
        .asPhone()
        .asUrl()
        .build();

      expect(column.type).toBe('url');
    });
  });

  describe('textOperators method', () => {
    it('should set specific text operators', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .textOperators(['contains', 'equals', 'startsWith'])
        .build();

      expect(column.filter?.operators).toEqual(['contains', 'equals', 'startsWith']);
    });

    it('should set all available text operators', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .textOperators(['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'])
        .build();

      expect(column.filter?.operators).toHaveLength(6);
      expect(column.filter?.operators).toContain('contains');
      expect(column.filter?.operators).toContain('isEmpty');
      expect(column.filter?.operators).toContain('isNotEmpty');
    });

    it('should override operators from searchable when textOperators is called', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .searchable()
        .textOperators(['equals', 'contains'])
        .build();

      expect(column.filter?.operators).toEqual(['equals', 'contains']);
      expect(column.filter?.debounce).toBe(300); // From searchable default
    });

    it('should work with asPhone', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('phone')
        .displayName('Phone')
        .accessor((user) => user.phone)
        .asPhone()
        .textOperators(['equals', 'startsWith'])
        .build();

      expect(column.type).toBe('phone');
      expect(column.filter?.operators).toEqual(['equals', 'startsWith']);
    });

    it('should work with asUrl', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('website')
        .displayName('Website')
        .accessor((user) => user.website)
        .asUrl()
        .textOperators(['contains', 'equals'])
        .build();

      expect(column.type).toBe('url');
      expect(column.filter?.operators).toEqual(['contains', 'equals']);
    });

    it('should support method chaining with textOperators', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .textOperators(['contains', 'equals'])
        .truncate({ maxLength: 50 })
        .transform('capitalize')
        .build();

      expect(column.filter?.operators).toEqual(['contains', 'equals']);
      expect(column.meta?.truncate?.maxLength).toBe(50);
      expect(column.meta?.textTransform).toBe('capitalize');
    });

    it('should handle empty operators array', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .textOperators([])
        .build();

      expect(column.filter?.operators).toEqual([]);
    });

    it('should override operators when set multiple times', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .textOperators(['contains', 'equals'])
        .textOperators(['startsWith'])
        .build();

      expect(column.filter?.operators).toEqual(['startsWith']);
    });
  });

  describe('Method combinations', () => {
    it('should combine asPhone with textOperators and other methods', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('phone')
        .displayName('Phone')
        .accessor((user) => user.phone)
        .asPhone()
        .textOperators(['equals', 'contains'])
        .truncate({ maxLength: 20 })
        .build();

      expect(column.type).toBe('phone');
      expect(column.filter?.operators).toEqual(['equals', 'contains']);
      expect(column.meta?.truncate?.maxLength).toBe(20);
    });

    it('should combine asUrl with textOperators and other methods', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('website')
        .displayName('Website')
        .accessor((user) => user.website)
        .asUrl()
        .textOperators(['equals', 'startsWith', 'contains'])
        .transform('lowercase')
        .build();

      expect(column.type).toBe('url');
      expect(column.filter?.operators).toEqual(['equals', 'startsWith', 'contains']);
      expect(column.meta?.textTransform).toBe('lowercase');
    });

    it('should combine searchable with textOperators', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .searchable({ debounce: 400, includeNull: true })
        .textOperators(['equals', 'contains'])
        .build();

      expect(column.filter?.debounce).toBe(400);
      expect(column.filter?.includeNull).toBe(true);
      expect(column.filter?.operators).toEqual(['equals', 'contains']);
    });
  });

  describe('Edge cases', () => {
    it('should handle asPhone on a non-text column', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('phone')
        .displayName('Phone')
        .accessor((user) => user.phone)
        .asEmail() // Change to email first
        .asPhone() // Then change to phone
        .build();

      expect(column.type).toBe('phone');
    });

    it('should handle textOperators with single operator', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .textOperators(['equals'])
        .build();

      expect(column.filter?.operators).toEqual(['equals']);
    });

    it('should handle textOperators with duplicate operators', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('name')
        .displayName('Name')
        .accessor((user) => user.name)
        .textOperators(['equals', 'equals', 'contains'])
        .build();

      expect(column.filter?.operators).toEqual(['equals', 'equals', 'contains']);
    });

    it('should handle asUrl and asPhone chaining', () => {
      const builder = new TextColumnBuilder<TestUser>();
      const column = builder
        .id('contact')
        .displayName('Contact')
        .accessor((user) => user.phone)
        .asUrl()
        .asPhone()
        .asUrl()
        .build();

      expect(column.type).toBe('url'); // Last one wins
    });
  });
});
