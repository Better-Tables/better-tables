import { describe, expect, it } from 'vitest';
import type { ColumnDefinition } from '../../src/types/column';
import {
  getColumnVisibilityModifications,
  getDefaultColumnVisibility,
  mergeColumnVisibility,
} from '../../src/utils/column-visibility';

interface TestData {
  id: string;
  name: string;
  email: string;
}

describe('Column Visibility Utilities', () => {
  const createMockColumn = (
    id: string,
    defaultVisible?: boolean,
    hideable?: boolean
  ): ColumnDefinition<TestData, unknown> => ({
    id,
    displayName: id,
    accessor: () => null,
    type: 'text',
    defaultVisible,
    hideable,
  });

  describe('getDefaultColumnVisibility', () => {
    it('should return visibility based on column defaultVisible', () => {
      const columns = [
        createMockColumn('name', true),
        createMockColumn('email', false),
        createMockColumn('age'), // undefined defaultVisible
      ];

      const visibility = getDefaultColumnVisibility(columns);

      expect(visibility).toEqual({
        name: true,
        email: false,
        age: true, // defaults to true when undefined
      });
    });

    it('should default to true when defaultVisible is not specified', () => {
      const columns = [createMockColumn('id'), createMockColumn('name')];

      const visibility = getDefaultColumnVisibility(columns);

      expect(visibility).toEqual({
        id: true,
        name: true,
      });
    });

    it('should handle empty columns array', () => {
      const visibility = getDefaultColumnVisibility([]);

      expect(visibility).toEqual({});
    });

    it('should handle single column', () => {
      const columns = [createMockColumn('id', false)];
      const visibility = getDefaultColumnVisibility(columns);

      expect(visibility).toEqual({ id: false });
    });

    it('should handle mix of visible and hidden columns', () => {
      const columns = [
        createMockColumn('id', true),
        createMockColumn('name', true),
        createMockColumn('secret', false),
      ];

      const visibility = getDefaultColumnVisibility(columns);

      expect(visibility).toEqual({
        id: true,
        name: true,
        secret: false,
      });
    });
  });

  describe('getColumnVisibilityModifications', () => {
    it('should return empty object when visibility matches defaults', () => {
      const columns = [createMockColumn('name', true), createMockColumn('email', false)];

      const currentVisibility = {
        name: true,
        email: false,
      };

      const modifications = getColumnVisibilityModifications(columns, currentVisibility);

      expect(modifications).toEqual({});
    });

    it('should return only columns that differ from defaults', () => {
      const columns = [
        createMockColumn('name', true),
        createMockColumn('email', false),
        createMockColumn('age', true),
      ];

      const currentVisibility = {
        name: false, // changed from default
        email: false, // matches default
        age: false, // changed from default
      };

      const modifications = getColumnVisibilityModifications(columns, currentVisibility);

      expect(modifications).toEqual({
        name: false,
        age: false,
      });
    });

    it('should handle partial visibility state', () => {
      const columns = [
        createMockColumn('name', true),
        createMockColumn('email', true),
        createMockColumn('age', true),
      ];

      const currentVisibility = {
        name: false,
        // email not specified
        age: true,
      };

      const modifications = getColumnVisibilityModifications(columns, currentVisibility);

      expect(modifications).toEqual({
        name: false, // Only this one differs
      });
    });

    it('should handle empty visibility object', () => {
      const columns = [createMockColumn('name', true), createMockColumn('email', false)];

      const modifications = getColumnVisibilityModifications(columns, {});

      // Should return empty because no columns specified
      expect(modifications).toEqual({});
    });

    it('should handle undefined values in visibility', () => {
      const columns = [createMockColumn('name', true), createMockColumn('email', true)];

      const currentVisibility = {
        name: false,
        email: undefined as unknown as boolean,
      };

      const modifications = getColumnVisibilityModifications(columns, currentVisibility);

      expect(modifications).toEqual({
        name: false,
      });
    });
  });

  describe('mergeColumnVisibility', () => {
    it('should merge modifications with defaults', () => {
      const columns = [
        createMockColumn('name', true),
        createMockColumn('email', true),
        createMockColumn('age', false),
      ];

      const modifications = {
        name: false, // override default
        email: true, // matches default
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        name: false,
        email: true,
        age: false,
      });
    });

    it('should preserve non-modified columns', () => {
      const columns = [
        createMockColumn('id', true),
        createMockColumn('name', true),
        createMockColumn('email', false),
      ];

      const modifications = {
        id: false, // Only modify this one
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        id: false,
        name: true, // preserved from default
        email: false, // preserved from default
      });
    });

    it('should ignore modifications to hideable:false columns', () => {
      const columns = [
        createMockColumn('id', true, false), // hideable: false
        createMockColumn('name', true, true), // hideable: true
      ];

      const modifications = {
        id: false, // Try to hide non-hideable column
        name: false, // Hide hideable column
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        id: true, // Cannot be hidden
        name: false, // Can be hidden
      });
    });

    it('should allow showing hideable:false columns', () => {
      const columns = [createMockColumn('id', true, false)]; // hideable: false

      const modifications = {
        id: true, // Show is always allowed
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        id: true,
      });
    });

    it('should handle empty modifications', () => {
      const columns = [createMockColumn('name', true), createMockColumn('email', false)];

      const visibility = mergeColumnVisibility(columns, {});

      expect(visibility).toEqual({
        name: true,
        email: false,
      });
    });

    it('should handle undefined defaultVisible', () => {
      const columns = [
        createMockColumn('name'), // defaultVisible undefined
        createMockColumn('email'),
      ];

      const modifications = {
        name: false,
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        name: false,
        email: true, // defaultVisible undefined defaults to true
      });
    });

    it('should ignore modifications for non-existent columns', () => {
      const columns = [createMockColumn('name', true)];

      const modifications = {
        name: false,
        invalid: true, // This column doesn't exist
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        name: false,
        // invalid column is ignored
      });
    });

    it('should not mutate the modifications object', () => {
      const columns = [createMockColumn('name', true), createMockColumn('email', false)];

      const modifications = {
        name: false,
        email: true,
      };

      const originalModifications = { ...modifications };
      mergeColumnVisibility(columns, modifications);

      // Verify modifications object was not mutated
      expect(modifications).toEqual(originalModifications);
    });

    it('should handle modifications with multiple non-existent columns', () => {
      const columns = [createMockColumn('id', true)];

      const modifications = {
        id: false,
        nonExistent1: true,
        nonExistent2: false,
        nonExistent3: true,
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        id: false,
        // All non-existent columns should be ignored
      });
    });

    it('should handle columns map lookup correctly for large column arrays', () => {
      const columns = Array.from({ length: 100 }, (_, i) =>
        createMockColumn(`col${i}`, i % 2 === 0)
      );

      const modifications = {
        col0: false,
        col50: true,
        col99: false,
        invalid: true,
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility.col0).toBe(false);
      expect(visibility.col50).toBe(true);
      expect(visibility.col99).toBe(false);
      expect(visibility.invalid).toBeUndefined();
      // Check that defaults are preserved
      expect(visibility.col1).toBe(false); // defaultVisible from column
    });

    it('should handle single column', () => {
      const columns = [createMockColumn('id', false)];
      const modifications = { id: true };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({ id: true });
    });
  });

  describe('Edge cases', () => {
    it('should handle columns with no defaultVisible', () => {
      const columns = [
        createMockColumn('id'),
        createMockColumn('name'),
        createMockColumn('secret'),
      ];

      const visibility = getDefaultColumnVisibility(columns);

      // All should default to true
      expect(visibility).toEqual({
        id: true,
        name: true,
        secret: true,
      });
    });

    it('should handle complex hideable configurations', () => {
      const columns = [
        createMockColumn('id', true, false), // Required column
        createMockColumn('name', true, true),
        createMockColumn('secret', false, false), // Hidden required column
      ];

      const modifications = {
        id: false, // Cannot hide
        name: false, // Can hide
        secret: false, // Cannot hide
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        id: true, // Forced visible
        name: false, // Successfully hidden
        secret: false, // Matches default
      });
    });

    it('should handle empty columns array with modifications', () => {
      const visibility = mergeColumnVisibility([], { any: true });

      expect(visibility).toEqual({});
    });

    it('should handle modifications with all columns specified', () => {
      const columns = [
        createMockColumn('a', true),
        createMockColumn('b', true),
        createMockColumn('c', true),
      ];

      const modifications = {
        a: false,
        b: false,
        c: false,
      };

      const visibility = mergeColumnVisibility(columns, modifications);

      expect(visibility).toEqual({
        a: false,
        b: false,
        c: false,
      });
    });
  });
});
