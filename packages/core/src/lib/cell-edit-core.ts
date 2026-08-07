/**
 * @fileoverview Shared cell-edit validation/coercion policy (plan 055).
 * @module lib/cell-edit-core
 *
 * @description
 * ONE implementation of "which columns may a single-cell write touch, and
 * how is the wire value coerced/validated", consumed by BOTH
 * `tables.cellEditAction(def)` (the server-action path) and the opt-in HTTP
 * write proxy. Everything here is derived from the table definition — the
 * editable columns, each column's type-driven coercer, its declared option
 * choices, and its ValidationRules — so the client can never redirect a
 * write to a table/field no editable column exposes.
 *
 * Joined-table editing: a relationship-path column
 * (`t.text('customer.company').editable()`) resolves its write target via
 * the adapter's `resolveCellWriteTarget` capability — the write lands in the
 * RELATED table, addressed by the related row's id. One-to-many paths and
 * schema-unwritable fields are rejected at policy BUILD time.
 */

import type { CellWriteTarget, TableAdapter } from '../types/adapter';
import type { ColumnDefinition, ColumnType, EditableConfig, ValidationRule } from '../types/column';
import type { TableDefinition } from '../types/factory';
import type { FilterOption } from '../types/filter';

// ============================================================================
// Wire-safe action shapes
// ============================================================================

/**
 * The serializable input of a cell-edit action / wire write. `value` is
 * wire-safe (`string | number | boolean | null`; dates as ISO strings or
 * epoch numbers — in-process callers may also pass a real `Date`).
 */
export interface CellEditActionInput {
  /** TARGET row id (the RELATED row's id for relationship-path columns). */
  id: string;
  /** The COLUMN id (may be dotted, e.g. 'customer.company'). */
  field: string;
  /** Wire-safe new value. */
  value: unknown;
}

/** The serializable result of a cell-edit action / wire write. */
export type CellEditActionResult = { ok: true; data?: unknown } | { ok: false; error: string };

/** A cell-edit save function — plain async, serializable input/output. */
export type CellEditAction = (input: CellEditActionInput) => Promise<CellEditActionResult>;

// ============================================================================
// Shared editable helpers (moved from @better-tables/ui — plan 055 Step 1;
// the ui package re-exports these so there is ONE implementation)
// ============================================================================

/** Normalize `column.editable` to a config object, or null when disabled. */
export function normalizeEditableConfig<TData, TValue>(
  editable: ColumnDefinition<TData, TValue>['editable']
): EditableConfig<TData, TValue> | null {
  if (editable == null || editable === false) return null;
  if (editable === true) return {};
  return editable;
}

/**
 * Resolve the storage field for the OWN-TABLE save path.
 * Returns null when the column id is a relationship path and no `field`
 * override is set (such columns resolve via `resolveCellWriteTarget`).
 */
export function resolveEditableField(
  columnId: string,
  config: { field?: string } | null
): string | null {
  if (config?.field) return config.field;
  if (!columnId.includes('.')) return columnId;
  return null;
}

/** Run a column's ValidationRules; first failure wins. Null = valid. */
export function runValidationRules<TValue>(
  rules: ValidationRule<TValue>[] | undefined,
  value: TValue
): string | null {
  if (!rules?.length) return null;
  for (const rule of rules) {
    const result = rule.validate(value);
    if (result === false) {
      return rule.message ?? `Validation failed (${rule.id})`;
    }
    if (typeof result === 'string') {
      return result;
    }
  }
  return null;
}

// ============================================================================
// Type-driven coercion (field-agnostic — reused by the HTTP write proxy)
// ============================================================================

/** Outcome of coercing a wire value for a column type. */
export type CellValueCoercion = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * Coerce a wire-safe value for a column TYPE (plan 055 Step 1):
 * - `null` is only accepted when `nullable` is `true` — the column-builder
 *   default is `false` (bug fix: this used to admit `null` unconditionally,
 *   regardless of the column's declared nullability).
 * - `date`: `Date` (in-process) / ISO string / epoch number → `Date`;
 *   invalid dates rejected.
 * - `number`/`currency`/`percentage`: finite number.
 * - `boolean`: requires a boolean.
 * - `option`: when `options` are declared/inferred the value must be one of
 *   them; otherwise a string.
 * - text family (`text`/`email`/`url`/`phone`): string.
 * - `custom`: wire-safe primitive passthrough (`string|number|boolean`).
 * - anything else (`multiOption`/`json`/unknown): rejected — no v1 editor.
 *
 * @param nullable - Whether `null` is an admissible value for this column.
 *   Defaults to `false`, matching `ColumnBuilder`'s default.
 */
export function coerceCellValue(
  type: ColumnType,
  value: unknown,
  options?: ReadonlyArray<Pick<FilterOption, 'value'>>,
  nullable = false
): CellValueCoercion {
  if (value === null) {
    return nullable ? { ok: true, value: null } : { ok: false, error: 'This field is required.' };
  }
  switch (type) {
    case 'date': {
      if (value instanceof Date) {
        return Number.isNaN(value.getTime())
          ? { ok: false, error: 'Invalid date value.' }
          : { ok: true, value };
      }
      if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
          ? { ok: false, error: 'Invalid date value.' }
          : { ok: true, value: parsed };
      }
      return { ok: false, error: 'Expected a date (ISO string or epoch).' };
    }
    case 'number':
    case 'currency':
    case 'percentage': {
      if (typeof value === 'number' && Number.isFinite(value)) return { ok: true, value };
      return { ok: false, error: 'Expected a finite number.' };
    }
    case 'boolean': {
      if (typeof value === 'boolean') return { ok: true, value };
      return { ok: false, error: 'Expected a boolean.' };
    }
    case 'option': {
      if (options && options.length > 0) {
        const allowed = options.some((option) => option.value === value);
        return allowed
          ? { ok: true, value }
          : { ok: false, error: 'Value is not one of the column options.' };
      }
      if (typeof value === 'string') return { ok: true, value };
      return { ok: false, error: 'Expected a string option value.' };
    }
    case 'text':
    case 'email':
    case 'url':
    case 'phone': {
      if (typeof value === 'string') return { ok: true, value };
      return { ok: false, error: 'Expected a string.' };
    }
    case 'custom': {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return { ok: true, value };
      }
      return { ok: false, error: 'Expected a primitive value.' };
    }
    default:
      return { ok: false, error: `Column type "${type}" is not cell-editable.` };
  }
}

// ============================================================================
// The policy
// ============================================================================

/** One admitted column: its definition plus where its writes land. */
export interface CellEditPolicyEntry {
  column: ColumnDefinition<unknown, unknown>;
  target: CellWriteTarget;
}

/** Outcome of checking one {@link CellEditActionInput} against the policy. */
export type CellEditPolicyCheck =
  | { ok: true; target: CellWriteTarget; value: unknown }
  | { ok: false; error: string };

/** The compiled admit/coerce/validate policy for one table definition. */
export interface CellEditPolicy {
  /** Admitted columns by column id. */
  entries: ReadonlyMap<string, CellEditPolicyEntry>;
  /** Validate an input: maps columnId → target, coerces, runs ValidationRules. */
  check(input: CellEditActionInput): CellEditPolicyCheck;
}

/** Column types with a v1 editor — the save-admission ceiling. */
const POLICY_EDITABLE_TYPES = new Set<ColumnType>([
  'text',
  'email',
  'url',
  'phone',
  'number',
  'currency',
  'percentage',
  'option',
  'boolean',
  'date',
  'custom',
]);

function devWarn(_message: string): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
}

/** The one adapter member the policy build needs (structural). */
type CellWriteTargetSource = Pick<TableAdapter<unknown>, 'resolveCellWriteTarget'>;

/**
 * Build the cell-edit policy for a table definition (plan 055 Step 1):
 * admits exactly the columns that are editable-and-saveable —
 *
 * - own-table columns (dot-free id, or an explicit `editable.field`
 *   override) resolve LOCALLY, without the adapter;
 * - relationship-path columns resolve via
 *   `adapter.resolveCellWriteTarget(columnId, def.tableName)`; a missing
 *   capability, unresolvable path, one-to-many path (`single: false`), or
 *   schema-unwritable field (`writable: false`) rejects the column at BUILD
 *   time with a dev warn naming the reason (the column stays callback-only,
 *   as under plan 053).
 *
 * The resulting policy's `check` re-resolves column → (table, field)
 * server-side on every input, so a client can never redirect a write.
 */
export async function buildCellEditPolicy<TName extends string, TRow>(
  def: TableDefinition<TName, TRow>,
  adapter?: CellWriteTargetSource | null
): Promise<CellEditPolicy> {
  const entries = new Map<string, CellEditPolicyEntry>();
  const resolveTarget = adapter?.resolveCellWriteTarget;

  for (const column of def.columns as ReadonlyArray<ColumnDefinition<unknown, unknown>>) {
    const config = normalizeEditableConfig(column.editable);
    if (!config) continue;

    if (!POLICY_EDITABLE_TYPES.has(column.type)) {
      devWarn(
        `[better-tables] cellEditPolicy('${def.tableName}'): column '${column.id}' is editable ` +
          `but type '${column.type}' has no v1 editor — not admitted.`
      );
      continue;
    }

    const ownField = resolveEditableField(column.id, config);
    if (ownField) {
      // Own-table write (flat id, or explicit field override — including on
      // dotted ids, where `editable.field` means "write THIS own-table
      // field", the plan-053 semantic).
      //
      // Consult the adapter's schema writability for THIS field when the
      // capability is available (bug fix: this path used to hardcode
      // `writable: true`, admitting primary keys and other
      // schema-unwritable own-table fields — `resolveCellWriteTarget`
      // already reports real writability for flat ids, see the Drizzle
      // adapter). No capability (or the adapter doesn't recognize the
      // field) keeps the previous permissive default so callback-only /
      // adapter-less setups are unaffected.
      let writable = true;
      if (typeof resolveTarget === 'function') {
        try {
          const resolved = await resolveTarget.call(adapter, ownField, def.tableName);
          if (resolved && resolved.table === def.tableName && resolved.relatedIdPath === null) {
            writable = resolved.writable;
          }
        } catch {
          // Introspection failure — fall back to the permissive default
          // rather than blocking own-table saves on an adapter quirk.
        }
      }
      if (!writable) {
        devWarn(
          `[better-tables] cellEditPolicy('${def.tableName}'): column '${column.id}' targets a ` +
            `schema-unwritable field ('${ownField}') — not admitted.`
        );
        continue;
      }
      entries.set(column.id, {
        column,
        target: {
          table: def.tableName,
          field: ownField,
          relatedIdPath: null,
          single: true,
          writable: true,
        },
      });
      continue;
    }

    // Relationship-path column: needs the adapter capability.
    if (typeof resolveTarget !== 'function') {
      devWarn(
        `[better-tables] cellEditPolicy('${def.tableName}'): column '${column.id}' is a ` +
          `relationship path and the adapter has no resolveCellWriteTarget — not admitted ` +
          `(callback-only).`
      );
      continue;
    }

    let target: CellWriteTarget | null;
    try {
      target = await resolveTarget.call(adapter, column.id, def.tableName);
    } catch (error) {
      devWarn(
        `[better-tables] cellEditPolicy('${def.tableName}'): resolveCellWriteTarget failed for ` +
          `'${column.id}' (${error instanceof Error ? error.message : String(error)}) — not admitted.`
      );
      continue;
    }

    if (!target) {
      devWarn(
        `[better-tables] cellEditPolicy('${def.tableName}'): column '${column.id}' has no ` +
          `resolvable write target — not admitted.`
      );
      continue;
    }
    if (!target.single) {
      devWarn(
        `[better-tables] cellEditPolicy('${def.tableName}'): column '${column.id}' crosses a ` +
          `one-to-many relationship — never cell-editable, not admitted.`
      );
      continue;
    }
    if (!target.writable) {
      devWarn(
        `[better-tables] cellEditPolicy('${def.tableName}'): column '${column.id}' targets a ` +
          `schema-unwritable field — not admitted.`
      );
      continue;
    }

    entries.set(column.id, { column, target });
  }

  return {
    entries,
    check(input: CellEditActionInput): CellEditPolicyCheck {
      if (!input || typeof input !== 'object') {
        return { ok: false, error: 'Malformed cell edit input.' };
      }
      if (typeof input.id !== 'string' || input.id.length === 0) {
        return { ok: false, error: 'A target row id is required.' };
      }
      if (typeof input.field !== 'string' || input.field.length === 0) {
        return { ok: false, error: 'A column id is required.' };
      }

      const entry = entries.get(input.field);
      if (!entry) {
        return { ok: false, error: `Column "${input.field}" is not editable.` };
      }

      const coerced = coerceCellValue(
        entry.column.type,
        input.value,
        entry.column.filter?.options,
        entry.column.nullable ?? false
      );
      if (!coerced.ok) {
        return { ok: false, error: coerced.error };
      }

      const validationError = runValidationRules(entry.column.validation, coerced.value);
      if (validationError) {
        return { ok: false, error: validationError };
      }

      return { ok: true, target: entry.target, value: coerced.value };
    },
  };
}
