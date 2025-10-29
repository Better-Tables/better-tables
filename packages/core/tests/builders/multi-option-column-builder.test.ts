import { describe, expect, it, vi } from 'vitest';
import { MultiOptionColumnBuilder } from '../../src/builders/multi-option-column-builder';
import type { FilterOption } from '../../src/types/filter';

interface TestArticle {
  id: string;
  tags: string[];
  categories: string[];
  roles: string[];
  skills: string[];
}

describe('MultiOptionColumnBuilder Enhancements', () => {
  const mockOptions: FilterOption[] = [
    { value: 'javascript', label: 'JavaScript', color: 'yellow' },
    { value: 'react', label: 'React', color: 'blue' },
    { value: 'typescript', label: 'TypeScript', color: 'blue' },
    { value: 'vue', label: 'Vue', color: 'green' },
  ];

  describe('categories method', () => {
    it('should configure categories with default options', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories(mockOptions)
        .build();

      expect(column.filter?.options).toEqual(mockOptions);
      expect(column.meta?.categories).toBeDefined();
      expect(column.meta?.categories?.showHierarchy).toBe(true);
      expect(column.meta?.categories?.showIcons).toBe(true);
    });

    it('should configure categories with includeNull', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories([], { includeNull: true })
        .build();

      expect(column.filter?.includeNull).toBe(true);
    });

    it('should configure categories with searchable', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories([], { searchable: false })
        .build();

      expect(column.meta?.options?.searchable).toBe(false);
    });

    it('should configure categories with showHierarchy', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories([], { showHierarchy: false })
        .build();

      expect(column.meta?.categories?.showHierarchy).toBe(false);
    });

    it('should configure categories with maxCategories', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories([], { maxCategories: 5 })
        .build();

      expect(column.meta?.options?.maxSelections).toBe(5);
    });

    it('should support method chaining with categories', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories(mockOptions, { maxCategories: 3 })
        .showBadges()
        .build();

      expect(column.meta?.categories).toBeDefined();
      expect(column.meta?.options?.maxSelections).toBe(3);
      expect(column.meta?.display?.type).toBe('chips');
    });
  });

  describe('roles method', () => {
    const roleOptions: FilterOption[] = [
      { value: 'admin', label: 'Admin', color: 'red' },
      { value: 'editor', label: 'Editor', color: 'blue' },
      { value: 'viewer', label: 'Viewer', color: 'gray' },
    ];

    it('should configure roles with default options', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles(roleOptions)
        .build();

      expect(column.filter?.options).toEqual(roleOptions);
      expect(column.meta?.roles).toBeDefined();
      expect(column.meta?.roles?.showDescriptions).toBe(true);
      expect(column.meta?.roles?.showBadges).toBe(true);
    });

    it('should configure roles with includeNull', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles([], { includeNull: true })
        .build();

      expect(column.filter?.includeNull).toBe(true);
    });

    it('should configure roles with searchable', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles([], { searchable: false })
        .build();

      expect(column.meta?.options?.searchable).toBe(false);
    });

    it('should configure roles with showDescriptions', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles([], { showDescriptions: false })
        .build();

      expect(column.meta?.roles?.showDescriptions).toBe(false);
    });

    it('should configure roles with maxRoles', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles([], { maxRoles: 10 })
        .build();

      expect(column.meta?.options?.maxSelections).toBe(10);
    });

    it('should support method chaining with roles', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles(roleOptions, { maxRoles: 5 })
        .showBadges({ removable: true })
        .build();

      expect(column.meta?.roles).toBeDefined();
      expect(column.meta?.options?.maxSelections).toBe(5);
      expect(column.meta?.display?.type).toBe('chips');
      expect(column.meta?.display?.removable).toBe(true);
    });
  });

  describe('asyncOptions method', () => {
    it('should configure async options loader', async () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
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

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader)
        .build();

      expect(column.meta?.options?.loadingPlaceholder).toBe('Loading options...');
    });

    it('should configure async options with custom loading placeholder', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader, { loadingPlaceholder: 'Fetching tags...' })
        .build();

      expect(column.meta?.options?.loadingPlaceholder).toBe('Fetching tags...');
    });

    it('should configure async options with includeNull', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader, { includeNull: true })
        .build();

      expect(column.filter?.includeNull).toBe(true);
    });

    it('should configure async options with validation', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);
      const validation = vi.fn<(value: string[]) => boolean>().mockReturnValue(true);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader, { validation })
        .build();

      expect(column.filter?.validation).toBe(validation);
    });

    it('should configure async options with maxSelections', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader, { maxSelections: 5 })
        .build();

      expect(column.meta?.options?.maxSelections).toBe(5);
    });

    it('should configure async options with minSelections', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader, { minSelections: 1 })
        .build();

      expect(column.meta?.options?.minSelections).toBe(1);
    });

    it('should set correct operators for async options', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader)
        .build();

      expect(column.filter?.operators).toEqual([
        'includes',
        'excludes',
        'includesAny',
        'includesAll',
        'excludesAny',
        'excludesAll',
      ]);
    });

    it('should support method chaining with asyncOptions', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader, { placeholder: 'Select tags...' })
        .showBadges()
        .build();

      expect(column.meta?.options?.async).toBe(true);
      expect(column.meta?.display?.type).toBe('chips');
    });
  });

  describe('validate method', () => {
    it('should configure validation with maxSelections', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .validate({ maxSelections: 5 })
        .build();

      expect(column.meta?.validation?.maxSelections).toBe(5);
    });

    it('should configure validation with minSelections', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .validate({ minSelections: 1 })
        .build();

      expect(column.meta?.validation?.minSelections).toBe(1);
    });

    it('should configure validation with custom validation function', () => {
      const customValidation = vi
        .fn<(values: string[]) => boolean | string>()
        .mockReturnValue(true);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .validate({ custom: customValidation })
        .build();

      expect(column.meta?.validation?.custom).toBe(customValidation);
    });

    it('should configure validation with all options', () => {
      const customValidation = vi
        .fn<(values: string[]) => boolean | string>()
        .mockReturnValue(true);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .validate({
          maxSelections: 10,
          minSelections: 2,
          custom: customValidation,
        })
        .build();

      expect(column.meta?.validation?.maxSelections).toBe(10);
      expect(column.meta?.validation?.minSelections).toBe(2);
      expect(column.meta?.validation?.custom).toBe(customValidation);
    });

    it('should support method chaining with validate', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .validate({ maxSelections: 5 })
        .showBadges()
        .build();

      expect(column.meta?.validation?.maxSelections).toBe(5);
      expect(column.meta?.display?.type).toBe('chips');
    });

    it('should allow updating validation options', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .validate({ maxSelections: 5 })
        .validate({ maxSelections: 10, minSelections: 1 })
        .build();

      expect(column.meta?.validation?.maxSelections).toBe(10);
      expect(column.meta?.validation?.minSelections).toBe(1);
    });
  });

  describe('multiOptionOperators method', () => {
    it('should set specific multi-option operators', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .multiOptionOperators(['includes', 'excludes'])
        .build();

      expect(column.filter?.operators).toEqual(['includes', 'excludes']);
    });

    it('should set all available multi-option operators', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .multiOptionOperators([
          'includes',
          'excludes',
          'includesAny',
          'includesAll',
          'excludesAny',
          'excludesAll',
        ])
        .build();

      expect(column.filter?.operators).toHaveLength(6);
      expect(column.filter?.operators).toContain('includes');
      expect(column.filter?.operators).toContain('includesAll');
      expect(column.filter?.operators).toContain('excludesAll');
    });

    it('should override operators when set multiple times', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .multiOptionOperators(['includes', 'excludes'])
        .multiOptionOperators(['includesAny'])
        .build();

      expect(column.filter?.operators).toEqual(['includesAny']);
    });

    it('should work with categories method', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories(mockOptions)
        .multiOptionOperators(['includes', 'includesAny'])
        .build();

      expect(column.filter?.operators).toEqual(['includes', 'includesAny']);
      expect(column.meta?.categories).toBeDefined();
    });

    it('should work with roles method', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles(mockOptions)
        .multiOptionOperators(['includesAll', 'excludesAny'])
        .build();

      expect(column.filter?.operators).toEqual(['includesAll', 'excludesAny']);
      expect(column.meta?.roles).toBeDefined();
    });

    it('should work with asyncOptions', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader)
        .multiOptionOperators(['includes', 'includesAny'])
        .build();

      expect(column.filter?.operators).toEqual(['includes', 'includesAny']);
      expect(column.meta?.options?.async).toBe(true);
    });

    it('should work with validate method', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .multiOptionOperators(['includes'])
        .validate({ maxSelections: 5 })
        .build();

      expect(column.filter?.operators).toEqual(['includes']);
      expect(column.meta?.validation?.maxSelections).toBe(5);
    });

    it('should support method chaining with multiOptionOperators', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .multiOptionOperators(['includes', 'excludes'])
        .showBadges()
        .build();

      expect(column.filter?.operators).toEqual(['includes', 'excludes']);
      expect(column.meta?.display?.type).toBe('chips');
    });

    it('should handle empty operators array', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .multiOptionOperators([])
        .build();

      expect(column.filter?.operators).toEqual([]);
    });
  });

  describe('Method combinations', () => {
    it('should combine categories with multiOptionOperators and validate', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories(mockOptions, { maxCategories: 5 })
        .multiOptionOperators(['includes', 'includesAny'])
        .validate({ maxSelections: 3 })
        .build();

      expect(column.meta?.categories).toBeDefined();
      expect(column.filter?.operators).toEqual(['includes', 'includesAny']);
      expect(column.meta?.validation?.maxSelections).toBe(3);
    });

    it('should combine roles with asyncOptions and validate', () => {
      const mockLoader = vi.fn<() => Promise<FilterOption[]>>().mockResolvedValue(mockOptions);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles(mockOptions, { maxRoles: 10 })
        .asyncOptions(mockLoader)
        .validate({ maxSelections: 5 })
        .build();

      expect(column.meta?.roles).toBeDefined();
      expect(column.meta?.options?.async).toBe(true);
      expect(column.meta?.validation?.maxSelections).toBe(5);
    });

    it('should combine all enhancement methods', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .multiOptionOperators(['includes', 'includesAny', 'excludes'])
        .validate({ maxSelections: 10, minSelections: 1 })
        .showBadges({ removable: true })
        .build();

      expect(column.filter?.operators).toHaveLength(3);
      expect(column.meta?.validation?.maxSelections).toBe(10);
      expect(column.meta?.validation?.minSelections).toBe(1);
      expect(column.meta?.display?.type).toBe('chips');
    });
  });

  describe('Edge cases', () => {
    it('should handle categories with empty array', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('categories')
        .displayName('Categories')
        .accessor((article) => article.categories)
        .categories([])
        .build();

      expect(column.filter?.options).toEqual([]);
      expect(column.meta?.categories).toBeDefined();
    });

    it('should handle roles with empty array', () => {
      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('roles')
        .displayName('Roles')
        .accessor((article) => article.roles)
        .roles([])
        .build();

      expect(column.filter?.options).toEqual([]);
      expect(column.meta?.roles).toBeDefined();
    });

    it('should handle asyncOptions loader that throws', async () => {
      const mockLoader = vi
        .fn<() => Promise<FilterOption[]>>()
        .mockRejectedValue(new Error('Failed'));

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .asyncOptions(mockLoader)
        .build();

      expect(column.meta?.options?.async).toBe(true);
      await expect(mockLoader()).rejects.toThrow('Failed');
    });

    it('should handle validate with only custom validation', () => {
      const customValidation = vi.fn<(values: string[]) => boolean>().mockReturnValue(true);

      const builder = new MultiOptionColumnBuilder<TestArticle>();
      const column = builder
        .id('tags')
        .displayName('Tags')
        .accessor((article) => article.tags)
        .options(mockOptions)
        .validate({ custom: customValidation })
        .build();

      expect(column.meta?.validation?.custom).toBe(customValidation);
      expect(column.meta?.validation?.maxSelections).toBeUndefined();
      expect(column.meta?.validation?.minSelections).toBeUndefined();
    });
  });
});
