/**
 * @fileoverview Tests for SQL utility functions
 * @module @better-tables/drizzle-adapter/tests/sql-utils
 *
 * Tests for SQL identifier escaping and other SQL utility functions.
 */

import { describe, expect, it } from 'bun:test';
import { escapeSqlIdentifier } from '../src/utils/sql-utils';

describe('escapeSqlIdentifier', () => {
  describe('Default quote character (double quote)', () => {
    it('should return unchanged identifier when no quotes present', () => {
      expect(escapeSqlIdentifier('user_name')).toBe('user_name');
      expect(escapeSqlIdentifier('table_name')).toBe('table_name');
      expect(escapeSqlIdentifier('column123')).toBe('column123');
    });

    it('should escape double quotes in identifier', () => {
      expect(escapeSqlIdentifier('user"name')).toBe('user""name');
      expect(escapeSqlIdentifier('table"name')).toBe('table""name');
      expect(escapeSqlIdentifier('"quoted"')).toBe('""quoted""');
    });

    it('should escape multiple double quotes', () => {
      expect(escapeSqlIdentifier('user"name"test')).toBe('user""name""test');
      expect(escapeSqlIdentifier('"start"middle"end"')).toBe('""start""middle""end""');
    });

    it('should handle empty string', () => {
      expect(escapeSqlIdentifier('')).toBe('');
    });

    it('should handle identifier with only quotes', () => {
      expect(escapeSqlIdentifier('""')).toBe('""""');
      expect(escapeSqlIdentifier('"""')).toBe('""""""');
    });
  });

  describe('Custom quote character (backtick for MySQL)', () => {
    it('should return unchanged identifier when no backticks present', () => {
      expect(escapeSqlIdentifier('user_name', '`')).toBe('user_name');
      expect(escapeSqlIdentifier('my-table', '`')).toBe('my-table');
    });

    it('should escape backticks in identifier', () => {
      expect(escapeSqlIdentifier('my`table', '`')).toBe('my``table');
      expect(escapeSqlIdentifier('column`name', '`')).toBe('column``name');
      expect(escapeSqlIdentifier('`quoted`', '`')).toBe('``quoted``');
    });

    it('should escape multiple backticks', () => {
      expect(escapeSqlIdentifier('my`table`name', '`')).toBe('my``table``name');
      expect(escapeSqlIdentifier('`start`middle`end`', '`')).toBe('``start``middle``end``');
    });
  });

  describe('Special regex characters in quote character', () => {
    it('should handle quote character with special regex characters', () => {
      // Test with various special regex characters as quote chars
      expect(escapeSqlIdentifier('test.value', '.')).toBe('test..value');
      expect(escapeSqlIdentifier('test*value', '*')).toBe('test**value');
      expect(escapeSqlIdentifier('test+value', '+')).toBe('test++value');
      expect(escapeSqlIdentifier('test?value', '?')).toBe('test??value');
      expect(escapeSqlIdentifier('test^value', '^')).toBe('test^^value');
      expect(escapeSqlIdentifier('test$value', '$')).toBe('test$$value');
      expect(escapeSqlIdentifier('test|value', '|')).toBe('test||value');
      expect(escapeSqlIdentifier('test(value', '(')).toBe('test((value');
      expect(escapeSqlIdentifier('test)value', ')')).toBe('test))value');
      expect(escapeSqlIdentifier('test[value', '[')).toBe('test[[value');
      expect(escapeSqlIdentifier('test]value', ']')).toBe('test]]value');
      expect(escapeSqlIdentifier('test{value', '{')).toBe('test{{value');
      expect(escapeSqlIdentifier('test}value', '}')).toBe('test}}value');
    });
  });

  describe('Edge cases', () => {
    it('should handle identifiers with mixed quotes and regular characters', () => {
      expect(escapeSqlIdentifier('user"name_test')).toBe('user""name_test');
      expect(escapeSqlIdentifier('table"123"column', '`')).toBe('table"123"column'); // No backticks to escape
    });

    it('should handle very long identifiers', () => {
      const longIdentifier = `${'a'.repeat(1000)}"${'b'.repeat(1000)}`;
      const result = escapeSqlIdentifier(longIdentifier);
      expect(result).toBe(`${'a'.repeat(1000)}""${'b'.repeat(1000)}`);
      expect(result.length).toBe(2002); // 1000 + 2 + 1000
    });

    it('should handle unicode characters', () => {
      expect(escapeSqlIdentifier('用户"名称')).toBe('用户""名称');
      expect(escapeSqlIdentifier('表"名', '`')).toBe('表"名'); // No backticks
    });
  });

  describe('Security considerations', () => {
    it('should prevent SQL injection via quote characters', () => {
      // Attempted injection: closing quote and adding malicious SQL
      const malicious = 'name" OR 1=1--';
      const escaped = escapeSqlIdentifier(malicious);
      // The escaped version should have all quotes doubled, preventing injection
      expect(escaped).toBe('name"" OR 1=1--');
      // When used in SQL: "name"" OR 1=1--" is treated as a single identifier, not SQL code
    });

    it('should handle multiple injection attempts', () => {
      const malicious = 'name"; DROP TABLE users; --';
      const escaped = escapeSqlIdentifier(malicious);
      expect(escaped).toBe('name""; DROP TABLE users; --');
    });
  });
});
