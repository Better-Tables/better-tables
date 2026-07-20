/**
 * @fileoverview Dropped-filter visibility
 *
 * A filter leaf that cannot be translated is skipped rather than thrown
 * (plan 038: partial URL/UI filter state must still fetch). But dropping a leaf
 * WIDENS the result set -- under implicit-AND the query returns more rows than
 * the caller asked for -- so a drop caused by a malformed filter must never be
 * silent. Verified live against Postgres before this test existed: a filter
 * with a mismatched type returned the full 1,000,000-row table instead of the
 * 49,937 matching rows, with no error and no warning.
 *
 * Deliberately asymmetric:
 * - malformed (operator not valid for the type) -> dropped WITH a warning
 * - incomplete values for a supported operator  -> dropped SILENTLY (normal
 *   mid-edit UI state; warning here would fire on every keystroke)
 */

import { describe, expect, it, spyOn } from 'bun:test';
import type { FilterOperator, FilterState } from '@better-tables/core';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { FilterHandler } from '../src/filter-handler';
import { RelationshipManager } from '../src/relationship-manager';

const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: text('name'),
  role: text('role'),
});

const schema = { users };

function createHandler() {
  const relationshipManager = new RelationshipManager(schema, {});
  return new FilterHandler(schema, relationshipManager, 'postgres');
}

function captureWarnings<T>(run: () => T): { result: T; warnings: string[] } {
  const spy = spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const result = run();
    const warnings = spy.mock.calls.map((call) => String(call[0]));
    return { result, warnings };
  } finally {
    spy.mockRestore();
  }
}

describe('dropped filter visibility', () => {
  it('warns when an operator is not valid for the filter type', () => {
    const handler = createHandler();
    // `is` belongs to OPTION_OPERATORS, not TEXT_OPERATORS.
    const filters = [
      { columnId: 'role', type: 'text', operator: 'is' as FilterOperator, values: ['admin'] },
    ] as unknown as FilterState[];

    const { result, warnings } = captureWarnings(() =>
      handler.handleCrossTableFilters(filters, 'users')
    );

    // Still dropped (fail-soft preserved) ...
    expect(result.conditions).toHaveLength(0);
    // ... but no longer silent.
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('role');
    expect(warnings[0]).toContain('not valid for type');
  });

  it('warns for an entirely unknown operator', () => {
    const handler = createHandler();
    const filters = [
      {
        columnId: 'name',
        type: 'text',
        operator: 'notARealOperator' as FilterOperator,
        values: ['x'],
      },
    ] as unknown as FilterState[];

    const { result, warnings } = captureWarnings(() =>
      handler.handleCrossTableFilters(filters, 'users')
    );

    expect(result.conditions).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it('never logs filter values (value-free warning convention)', () => {
    const handler = createHandler();
    const secret = 'super-secret-value';
    const filters = [
      { columnId: 'name', type: 'text', operator: 'is' as FilterOperator, values: [secret] },
    ] as unknown as FilterState[];

    const { warnings } = captureWarnings(() => handler.handleCrossTableFilters(filters, 'users'));

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).not.toContain(secret);
  });

  it('stays silent for incomplete values on a supported operator (partial UI state)', () => {
    const handler = createHandler();
    // `contains` IS valid for text; the user simply has not typed a value yet.
    const filters: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: [] },
    ];

    const { result, warnings } = captureWarnings(() =>
      handler.handleCrossTableFilters(filters, 'users')
    );

    expect(result.conditions).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('does not warn for a valid, complete filter', () => {
    const handler = createHandler();
    const filters: FilterState[] = [
      { columnId: 'name', type: 'text', operator: 'contains', values: ['ada'] },
    ];

    const { result, warnings } = captureWarnings(() =>
      handler.handleCrossTableFilters(filters, 'users')
    );

    expect(result.conditions).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });
});
