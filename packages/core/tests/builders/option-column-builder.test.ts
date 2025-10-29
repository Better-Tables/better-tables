import { describe, expect, it, vi } from 'vitest';
import { OptionColumnBuilder } from '../../src/builders/option-column-builder';
import type { FilterOption } from '../../src/types/filter';

interface TestUser {
  id: string;
  status: string;
  priority: string;
  category: string;
}

describe('OptionColumnBuilder Enhancements', () => {
  const mockOptions: FilterOption[] = [
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'inactive', label: 'Inactive', color: 'red' },
    { value: 'pending', label: 'Pending', color: 'yellow' },
  ];

  describe('priority method', () => {
    it('should configure priority with default options', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority()
        .build();

      expect(column.filter?.options).toBeDefined();
      expect(column.meta?.priority).toBeDefined();
      expect(column.meta?.priority?.showBadge).toBe(true);
      expect(column.meta?.priority?.sortByOrder).toBe(true);
    });

    it('should configure priority with custom priorities', () => {
      const customPriorities = [
        { value: 'low', label: 'Low', color: 'gray', order: 1 },
        { value: 'medium', label: 'Medium', color: 'yellow', order: 2 },
        { value: 'high', label: 'High', color: 'orange', order: 3 },
        { value: 'critical', label: 'Critical', color: 'red', order: 4 },
      ];

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority(customPriorities)
        .build();

      expect(column.filter?.options).toHaveLength(4);
      expect(column.filter?.options?.[0]?.value).toBe('low');
      expect(column.filter?.options?.[3]?.value).toBe('critical');
      expect(column.meta?.priority).toBeDefined();
    });

    it('should sort priorities by order', () => {
      const unsortedPriorities = [
        { value: 'high', label: 'High', color: 'red', order: 3 },
        { value: 'low', label: 'Low', color: 'gray', order: 1 },
        { value: 'medium', label: 'Medium', color: 'yellow', order: 2 },
      ];

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority(unsortedPriorities)
        .build();

      expect(column.filter?.options?.[0]?.value).toBe('low');
      expect(column.filter?.options?.[1]?.value).toBe('medium');
      expect(column.filter?.options?.[2]?.value).toBe('high');
    });

    it('should configure priority with defaultValue', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority([], { defaultValue: 'medium' })
        .build();

      expect(column.meta?.priority?.defaultValue).toBe('medium');
    });

    it('should configure priority with includeNull', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority([], { includeNull: true })
        .build();

      expect(column.filter?.includeNull).toBe(true);
    });

    it('should include order in priority meta', () => {
      const priorities = [
        { value: 'low', label: 'Low', color: 'gray', order: 1 },
        { value: 'high', label: 'High', color: 'red', order: 2 },
      ];

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority(priorities)
        .build();

      const firstOption = column.filter?.options?.[0];
      expect(firstOption?.meta?.order).toBe(1);
      expect(column.filter?.options?.[1]?.meta?.order).toBe(2);
    });

    it('should support method chaining with priority', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority([{ value: 'high', label: 'High', color: 'red', order: 1 }])
        .showBadges()
        .build();

      expect(column.meta?.priority).toBeDefined();
      expect(column.meta?.display?.type).toBe('badge');
    });
  });

  describe('category method', () => {
    it('should configure category with options', () => {
      const categories = [
        { value: 'tech', label: 'Technology', color: 'blue' },
        { value: 'design', label: 'Design', color: 'purple' },
        { value: 'marketing', label: 'Marketing', color: 'green' },
      ];

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('category')
        .displayName('Category')
        .accessor((user) => user.category)
        .category(categories)
        .build();

      expect(column.filter?.options).toEqual(categories);
      expect(column.meta?.category).toBeDefined();
      expect(column.meta?.category?.showIcons).toBe(true);
    });

    it('should configure category with includeNull', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('category')
        .displayName('Category')
        .accessor((user) => user.category)
        .category([], { includeNull: true })
        .build();

      expect(column.filter?.includeNull).toBe(true);
    });

    it('should configure category with searchable', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('category')
        .displayName('Category')
        .accessor((user) => user.category)
        .category([], { searchable: false })
        .build();

      expect(column.meta?.options?.searchable).toBe(false);
    });

    it('should configure category with showIcons', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('category')
        .displayName('Category')
        .accessor((user) => user.category)
        .category([], { showIcons: false })
        .build();

      expect(column.meta?.category?.showIcons).toBe(false);
    });

    it('should support method chaining with category', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('category')
        .displayName('Category')
        .accessor((user) => user.category)
        .category(mockOptions, { searchable: true })
        .showBadges()
        .build();

      expect(column.meta?.category).toBeDefined();
      expect(column.meta?.display?.type).toBe('badge');
    });
  });

  describe('asyncOptions method', () => {
    it('should configure async options loader', async () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader)
        .build();

      expect(column.meta?.options?.async).toBe(true);
      expect(column.meta?.options?.optionsLoader).toBe(mockLoader);

      // Verify loader works
      const result = await mockLoader();
      expect(result).toEqual(mockOptions);
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('should configure async options with default loading placeholder', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader)
        .build();

      expect(column.meta?.options?.loadingPlaceholder).toBe('Loading options...');
    });

    it('should configure async options with custom loading placeholder', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader, { loadingPlaceholder: 'Fetching...' })
        .build();

      expect(column.meta?.options?.loadingPlaceholder).toBe('Fetching...');
    });

    it('should configure async options with includeNull', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader, { includeNull: true })
        .build();

      expect(column.filter?.includeNull).toBe(true);
    });

    it('should configure async options with validation', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);
      const validation = vi.fn<(value: string) => boolean>().mockReturnValue(true);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader, { validation })
        .build();

      expect(column.filter?.validation).toBe(validation);
    });

    it('should configure async options with searchable', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader, { searchable: false })
        .build();

      expect(column.meta?.options?.searchable).toBe(false);
    });

    it('should configure async options with placeholder', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader, { placeholder: 'Select status...' })
        .build();

      expect(column.meta?.options?.placeholder).toBe('Select status...');
    });

    it('should set correct operators for async options', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader)
        .build();

      expect(column.filter?.operators).toEqual(['is', 'isNot', 'isAnyOf', 'isNoneOf']);
    });

    it('should support method chaining with asyncOptions', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader, { placeholder: 'Select...' })
        .showBadges()
        .build();

      expect(column.meta?.options?.async).toBe(true);
      expect(column.meta?.display?.type).toBe('badge');
    });
  });

  describe('optionOperators method', () => {
    it('should set specific option operators', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .options(mockOptions)
        .optionOperators(['is', 'isNot'])
        .build();

      expect(column.filter?.operators).toEqual(['is', 'isNot']);
    });

    it('should set all available option operators', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .options(mockOptions)
        .optionOperators(['is', 'isNot', 'isAnyOf', 'isNoneOf'])
        .build();

      expect(column.filter?.operators).toHaveLength(4);
      expect(column.filter?.operators).toContain('is');
      expect(column.filter?.operators).toContain('isAnyOf');
      expect(column.filter?.operators).toContain('isNoneOf');
    });

    it('should override operators when set multiple times', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .options(mockOptions)
        .optionOperators(['is', 'isNot'])
        .optionOperators(['is'])
        .build();

      expect(column.filter?.operators).toEqual(['is']);
    });

    it('should work with priority method', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority([{ value: 'high', label: 'High', color: 'red', order: 1 }])
        .optionOperators(['is', 'isNot'])
        .build();

      expect(column.filter?.operators).toEqual(['is', 'isNot']);
      expect(column.meta?.priority).toBeDefined();
    });

    it('should work with category method', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('category')
        .displayName('Category')
        .accessor((user) => user.category)
        .category(mockOptions)
        .optionOperators(['isAnyOf', 'isNoneOf'])
        .build();

      expect(column.filter?.operators).toEqual(['isAnyOf', 'isNoneOf']);
      expect(column.meta?.category).toBeDefined();
    });

    it('should work with asyncOptions', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader)
        .optionOperators(['is', 'isAnyOf'])
        .build();

      expect(column.filter?.operators).toEqual(['is', 'isAnyOf']);
      expect(column.meta?.options?.async).toBe(true);
    });

    it('should support method chaining with optionOperators', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .options(mockOptions)
        .optionOperators(['is', 'isNot'])
        .showBadges()
        .build();

      expect(column.filter?.operators).toEqual(['is', 'isNot']);
      expect(column.meta?.display?.type).toBe('badge');
    });

    it('should handle empty operators array', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .options(mockOptions)
        .optionOperators([])
        .build();

      expect(column.filter?.operators).toEqual([]);
    });
  });

  describe('Method combinations', () => {
    it('should combine priority with optionOperators', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority([{ value: 'high', label: 'High', color: 'red', order: 1 }])
        .optionOperators(['is', 'isNot'])
        .showBadges()
        .build();

      expect(column.meta?.priority).toBeDefined();
      expect(column.filter?.operators).toEqual(['is', 'isNot']);
      expect(column.meta?.display?.type).toBe('badge');
    });

    it('should combine category with asyncOptions', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('category')
        .displayName('Category')
        .accessor((user) => user.category)
        .category(mockOptions)
        .asyncOptions(mockLoader)
        .build();

      // asyncOptions should override category's options
      expect(column.meta?.options?.async).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle priority with empty array', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('priority')
        .displayName('Priority')
        .accessor((user) => user.priority)
        .priority([])
        .build();

      expect(column.filter?.options).toEqual([]);
      expect(column.meta?.priority).toBeDefined();
    });

    it('should handle category with empty array', () => {
      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('category')
        .displayName('Category')
        .accessor((user) => user.category)
        .category([])
        .build();

      expect(column.filter?.options).toEqual([]);
      expect(column.meta?.category).toBeDefined();
    });

    it('should handle asyncOptions loader that throws', async () => {
      const mockLoader = vi
        .fn<() => Promise<FilterOption[]>>()
        .mockRejectedValue(new Error('Failed'));

      const builder = new OptionColumnBuilder<TestUser>();
      const column = builder
        .id('status')
        .displayName('Status')
        .accessor((user) => user.status)
        .asyncOptions(mockLoader)
        .build();

      expect(column.meta?.options?.async).toBe(true);
      await expect(mockLoader()).rejects.toThrow('Failed');
    });
  });
});
