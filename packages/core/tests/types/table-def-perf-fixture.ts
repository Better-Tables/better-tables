/**
 * @fileoverview Type-performance stress fixture for the PRODUCTION path-typed
 * runtime (`src/factory.ts` + `src/types/paths.ts`), retargeted from the
 * plan 011 experimental prototype per plan 018 Step 1.
 *
 * @remarks
 * NOT a functional test -- this file exists to be fed to
 * `tsc --noEmit --extendedDiagnostics` so the design doc
 * (`plans/design/table-definition-dx.md`, Step 5) can record real
 * Check-time / Instantiation numbers against a synthetic schema shaped like
 * a realistic large app: 30 tables, 5-15 columns each, ~15 relations
 * (including a deliberate 2-table mutual recursion AND a longer 15-table
 * cycle back to table1), and 10 `defineTable` calls with ~8 columns each.
 * `t.count()` calls from the original prototype fixture are replaced with
 * `t.number('relX.score')` (a numeric path traversal THROUGH the array
 * relation) since aggregate builders are deferred out of plan 018's scope --
 * this is an equal-or-greater type-complexity substitute, not a reduction.
 *
 * Originally generated once by a throwaway authoring script (not checked
 * in); edit by hand from here on -- see plans/design/table-definition-dx.md
 * Step 5 for the measurement command and recorded budget numbers.
 *
 * Measure with:
 *   cd packages/core && bunx tsc --noEmit --extendedDiagnostics \
 *     tests/types/table-def-perf-fixture.ts 2>&1 | grep -E "Check time|Instantiations"
 */
import { betterTables, defineTable } from '../../src/factory';
import type { SchemaAwareAdapter } from '../../src/types/paths';

// ----------------------------------------------------------------------------
// 30-table synthetic schema, 5-15 columns each, ~15 relations, includes a
// deliberate mutual recursion (Table1 <-> Table2) and a longer 15-node cycle
// (Table3 -> Table4 -> ... -> Table15 -> Table1).
// ----------------------------------------------------------------------------

interface Table1 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  rel2: Table2[];
}

interface Table2 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  rel1?: Table1 | null;
}

interface Table3 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  rel4: Table4[];
}

interface Table4 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  rel5?: Table5 | null;
}

interface Table5 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  rel6: Table6[];
}

interface Table6 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  code: string;
  rel7?: Table7 | null;
}

interface Table7 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  code: string;
  rank: number;
  rel8: Table8[];
}

interface Table8 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  rel9?: Table9 | null;
}

interface Table9 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  rel10: Table10[];
}

interface Table10 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  rel11?: Table11 | null;
}

interface Table11 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  rel12: Table12[];
}

interface Table12 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  rel13?: Table13 | null;
}

interface Table13 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  rel14: Table14[];
}

interface Table14 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  rel15?: Table15 | null;
}

interface Table15 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  code: string;
  rank: number;
  rel1?: Table1 | null;
}

interface Table16 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
}

interface Table17 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
}

interface Table18 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
}

interface Table19 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
}

interface Table20 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
}

interface Table21 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
}

interface Table22 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  code: string;
}

interface Table23 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  code: string;
  rank: number;
}

interface Table24 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
}

interface Table25 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
}

interface Table26 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
}

interface Table27 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
}

interface Table28 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
}

interface Table29 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
}

interface Table30 {
  id: string;
  name: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  isEnabled: boolean;
  weight: number;
  tag: string;
  note?: string | null;
  priority?: number | null;
  archived: boolean;
  updatedAt?: Date | null;
  code: string;
}

type Schema = {
  table1: { row: Table1 };
  table2: { row: Table2 };
  table3: { row: Table3 };
  table4: { row: Table4 };
  table5: { row: Table5 };
  table6: { row: Table6 };
  table7: { row: Table7 };
  table8: { row: Table8 };
  table9: { row: Table9 };
  table10: { row: Table10 };
  table11: { row: Table11 };
  table12: { row: Table12 };
  table13: { row: Table13 };
  table14: { row: Table14 };
  table15: { row: Table15 };
  table16: { row: Table16 };
  table17: { row: Table17 };
  table18: { row: Table18 };
  table19: { row: Table19 };
  table20: { row: Table20 };
  table21: { row: Table21 };
  table22: { row: Table22 };
  table23: { row: Table23 };
  table24: { row: Table24 };
  table25: { row: Table25 };
  table26: { row: Table26 };
  table27: { row: Table27 };
  table28: { row: Table28 };
  table29: { row: Table29 };
  table30: { row: Table30 };
};

const fakeAdapter = {} as SchemaAwareAdapter<{ tables: Schema }>;
const tables = betterTables({ database: fakeAdapter });

// ----------------------------------------------------------------------------
// 10 defineTable calls, ~8 columns each.
// ----------------------------------------------------------------------------

const table1Def = defineTable<typeof tables>()('table1', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.number('rel2.score'),
    t.number('weight'),
  ],
}));

const table2Def = defineTable<typeof tables>()('table2', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.text('id'),
    t.text('rel1.name'),
  ],
}));

const table3Def = defineTable<typeof tables>()('table3', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.number('rel4.score'),
    t.number('weight'),
  ],
}));

const table4Def = defineTable<typeof tables>()('table4', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.text('id'),
    t.text('rel5.name'),
  ],
}));

const table5Def = defineTable<typeof tables>()('table5', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.number('rel6.score'),
    t.number('weight'),
  ],
}));

const table6Def = defineTable<typeof tables>()('table6', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.text('id'),
    t.text('rel7.name'),
  ],
}));

const table7Def = defineTable<typeof tables>()('table7', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.number('rel8.score'),
    t.number('weight'),
  ],
}));

const table8Def = defineTable<typeof tables>()('table8', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.text('id'),
    t.text('rel9.name'),
  ],
}));

const table9Def = defineTable<typeof tables>()('table9', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.number('rel10.score'),
    t.number('weight'),
  ],
}));

const table10Def = defineTable<typeof tables>()('table10', (t) => ({
  columns: [
    t.text('name').displayName('Name'),
    t.number('score').range(0, 1000),
    t.boolean('isEnabled'),
    t.date('createdAt'),
    t.option('status').options([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ]),
    t.computed('display', (row) => `${row.name} (${row.score})`),
    t.text('id'),
    t.text('rel11.name'),
  ],
}));

export const perfFixtureTableDefs = [
  table1Def,
  table2Def,
  table3Def,
  table4Def,
  table5Def,
  table6Def,
  table7Def,
  table8Def,
  table9Def,
  table10Def,
];
