'use client';

import type {
  ColumnDefinition,
  EditableConfig,
  TableAdapter,
  ValidationRule,
} from '@better-tables/core';
import { useCallback, useRef, useState } from 'react';

/** Column types that ship a built-in in-cell editor in v1 (plan 053). */
export const V1_EDITABLE_TYPES = new Set([
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

export type CellEditContext<TData = unknown, TValue = unknown> = {
  row: TData;
  rowId: string;
  column: ColumnDefinition<TData, TValue>;
  field: string | null;
  value: TValue;
  previousValue: TValue;
};

export type CellEditHandler<TData = unknown> = (
  ctx: CellEditContext<TData, unknown>
) => void | Promise<void>;

export type CellEditErrorHandler<TData = unknown> = (ctx: {
  error: unknown;
  row: TData;
  rowId: string;
  column: ColumnDefinition<TData, unknown>;
  field: string | null;
  value: unknown;
  previousValue: unknown;
}) => void;

export type UseEditableCellsOptions<TData = unknown> = {
  adapter?: TableAdapter<TData> | null;
  /** Table name for adapter `updateRecord` options (from `BetterTable table` prop). */
  tableName?: string;
  onCellEdit?: CellEditHandler<TData>;
  onCellEditError?: CellEditErrorHandler<TData>;
  /** Table-level master switch. Default true. */
  editing?: boolean;
};

export type CellEditState = {
  editing: boolean;
  saving: boolean;
  error: string | null;
};

function cellKey(rowId: string, columnId: string): string {
  return `${rowId}:${columnId}`;
}

/** Normalize `column.editable` to a config object, or null when disabled. */
export function normalizeEditableConfig<TData, TValue>(
  editable: ColumnDefinition<TData, TValue>['editable']
): EditableConfig<TData, TValue> | null {
  if (editable == null || editable === false) return null;
  if (editable === true) return {};
  return editable;
}

/**
 * Resolve the storage field for the adapter save path.
 * Returns null when the column id is a relationship path and no `field` override is set.
 */
export function resolveEditableField(
  columnId: string,
  config: { field?: string } | null
): string | null {
  if (config?.field) return config.field;
  if (!columnId.includes('.')) return columnId;
  return null;
}

export type EditabilityResult =
  | { editable: true; field: string | null; savePath: 'callback' | 'adapter' }
  | { editable: false; reason: string };

/**
 * Pure save-path / editability matrix (plan 053 Step 5).
 * Row-level `when` is applied separately via {@link isRowEditable}.
 */
export function resolveColumnEditability<TData, TValue>(options: {
  editing?: boolean;
  column: ColumnDefinition<TData, TValue>;
  adapter?: TableAdapter<TData> | null;
  hasOnCellEdit: boolean;
  /** Whether a row id can be resolved for saves (adapter path). */
  canResolveRowId?: boolean;
}): EditabilityResult {
  const editing = options.editing !== false;
  const { column, hasOnCellEdit } = options;
  const adapter = options.adapter ?? null;
  const canResolveRowId = options.canResolveRowId !== false;

  if (!editing) {
    return { editable: false, reason: 'editing disabled on table' };
  }

  const config = normalizeEditableConfig(column.editable);
  if (!config) {
    return { editable: false, reason: 'column has no editable config' };
  }

  if (!V1_EDITABLE_TYPES.has(column.type)) {
    return {
      editable: false,
      reason: `column type "${column.type}" has no v1 editor (multiOption/json are read-only)`,
    };
  }

  if (column.type === 'custom' && !config.editRenderer) {
    return {
      editable: false,
      reason: 'custom columns require editable.editRenderer',
    };
  }

  if (hasOnCellEdit) {
    return {
      editable: true,
      field: resolveEditableField(column.id, config),
      savePath: 'callback',
    };
  }

  const supportsUpdate =
    Boolean(adapter?.meta?.features?.update) && typeof adapter?.updateRecord === 'function';
  if (!supportsUpdate) {
    return {
      editable: false,
      reason:
        'no save path — pass onCellEdit, or use an adapter with features.update + updateRecord',
    };
  }

  const field = resolveEditableField(column.id, config);
  if (!field) {
    return {
      editable: false,
      reason:
        'relationship-path column: pass editable.field or onCellEdit (adapter save unavailable for dotted ids in v1)',
    };
  }

  if (!canResolveRowId) {
    return { editable: false, reason: 'row id could not be resolved for adapter save' };
  }

  return { editable: true, field, savePath: 'adapter' };
}

/** Per-row gate from `editable.when`. */
export function isRowEditable<TData, TValue>(
  column: ColumnDefinition<TData, TValue>,
  row: TData
): boolean {
  const config = normalizeEditableConfig(column.editable);
  if (!config) return false;
  if (config.when) return config.when(row);
  return true;
}

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

const EMPTY_OVERLAY: Readonly<Record<string, unknown>> = Object.freeze({});
const EMPTY_ERRORS: Readonly<Record<string, string>> = Object.freeze({});
const EMPTY_SAVING: ReadonlySet<string> = new Set();

export function useEditableCells<TData = unknown>(options: UseEditableCellsOptions<TData>) {
  const { adapter, tableName, onCellEdit, onCellEditError, editing = true } = options;

  const [pendingEdits, setPendingEdits] = useState(() => new Map<string, unknown>());
  const [savingCells, setSavingCells] = useState(() => new Set<string>());
  const [cellErrors, setCellErrors] = useState(() => new Map<string, string>());
  const [activeEditKey, setActiveEditKey] = useState<string | null>(null);

  const warnedColumnsRef = useRef(new Set<string>());
  const pendingEditsRef = useRef(pendingEdits);
  pendingEditsRef.current = pendingEdits;
  const savingCellsRef = useRef(savingCells);
  savingCellsRef.current = savingCells;
  const onCellEditRef = useRef(onCellEdit);
  onCellEditRef.current = onCellEdit;
  const onCellEditErrorRef = useRef(onCellEditError);
  onCellEditErrorRef.current = onCellEditError;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const tableNameRef = useRef(tableName);
  tableNameRef.current = tableName;

  const hasOnCellEdit = Boolean(onCellEdit);

  const warnOnce = useCallback((columnId: string, message: string) => {
    if (process.env.NODE_ENV === 'production') return;
    if (warnedColumnsRef.current.has(columnId)) return;
    warnedColumnsRef.current.add(columnId);
    console.warn(`[better-tables] editable column "${columnId}": ${message}`);
  }, []);

  const getColumnEditability = useCallback(
    <TValue>(column: ColumnDefinition<TData, TValue>): EditabilityResult => {
      const result = resolveColumnEditability({
        editing,
        column,
        hasOnCellEdit,
        ...(adapter != null ? { adapter } : {}),
      });
      if (!result.editable && column.editable) {
        warnOnce(column.id, result.reason);
      }
      return result;
    },
    [adapter, editing, hasOnCellEdit, warnOnce]
  );

  const isColumnPotentiallyEditable = useCallback(
    <TValue>(column: ColumnDefinition<TData, TValue>): boolean => {
      return getColumnEditability(column).editable;
    },
    [getColumnEditability]
  );

  const getDisplayValue = useCallback(
    <TValue>(rowId: string, columnId: string, accessorValue: TValue): TValue => {
      const key = cellKey(rowId, columnId);
      if (pendingEditsRef.current.has(key)) {
        return pendingEditsRef.current.get(key) as TValue;
      }
      return accessorValue;
    },
    []
  );

  const getRowOverlay = useCallback(
    (rowId: string): Readonly<Record<string, unknown>> => {
      let overlay: Record<string, unknown> | null = null;
      for (const [key, value] of pendingEdits) {
        if (!key.startsWith(`${rowId}:`)) continue;
        const columnId = key.slice(rowId.length + 1);
        overlay ??= {};
        overlay[columnId] = value;
      }
      return overlay ?? EMPTY_OVERLAY;
    },
    [pendingEdits]
  );

  const getRowErrors = useCallback(
    (rowId: string): Readonly<Record<string, string>> => {
      let errors: Record<string, string> | null = null;
      for (const [key, message] of cellErrors) {
        if (!key.startsWith(`${rowId}:`)) continue;
        const columnId = key.slice(rowId.length + 1);
        errors ??= {};
        errors[columnId] = message;
      }
      return errors ?? EMPTY_ERRORS;
    },
    [cellErrors]
  );

  const getRowSavingColumns = useCallback(
    (rowId: string): ReadonlySet<string> => {
      let saving: Set<string> | null = null;
      for (const key of savingCells) {
        if (!key.startsWith(`${rowId}:`)) continue;
        const columnId = key.slice(rowId.length + 1);
        saving ??= new Set();
        saving.add(columnId);
      }
      return saving ?? EMPTY_SAVING;
    },
    [savingCells]
  );

  const getCellState = useCallback(
    (rowId: string, columnId: string): CellEditState => {
      const key = cellKey(rowId, columnId);
      return {
        editing: activeEditKey === key,
        saving: savingCells.has(key),
        error: cellErrors.get(key) ?? null,
      };
    },
    [activeEditKey, cellErrors, savingCells]
  );

  const beginEdit = useCallback((rowId: string, columnId: string) => {
    const key = cellKey(rowId, columnId);
    setActiveEditKey(key);
    setCellErrors((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const cancelEdit = useCallback((rowId: string, columnId: string) => {
    const key = cellKey(rowId, columnId);
    setActiveEditKey((current) => (current === key ? null : current));
    setCellErrors((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const commitEdit = useCallback(
    async <TValue>(args: {
      row: TData;
      rowId: string;
      column: ColumnDefinition<TData, TValue>;
      value: TValue;
      previousValue: TValue;
    }) => {
      const { row, rowId, column, value, previousValue } = args;
      const key = cellKey(rowId, column.id);

      if (savingCellsRef.current.has(key)) {
        return;
      }

      const validationError = runValidationRules(column.validation, value);
      if (validationError) {
        setCellErrors((prev) => {
          const next = new Map(prev);
          next.set(key, validationError);
          return next;
        });
        setActiveEditKey(key);
        return;
      }

      const currentAdapter = adapterRef.current;
      const editability = resolveColumnEditability({
        editing,
        column,
        hasOnCellEdit: Boolean(onCellEditRef.current),
        canResolveRowId: Boolean(rowId),
        ...(currentAdapter != null ? { adapter: currentAdapter } : {}),
      });

      if (!editability.editable) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[better-tables] commitEdit on non-editable column "${column.id}": ${editability.reason}`
          );
        }
        return;
      }

      // Optimistic overlay
      setPendingEdits((prev) => {
        const next = new Map(prev);
        next.set(key, value);
        return next;
      });
      setCellErrors((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setActiveEditKey((current) => (current === key ? null : current));
      setSavingCells((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      const field = editability.field;
      const ctx: CellEditContext<TData, unknown> = {
        row,
        rowId,
        column: column as ColumnDefinition<TData, unknown>,
        field,
        value,
        previousValue,
      };

      try {
        const callback = onCellEditRef.current;
        if (callback) {
          await callback(ctx);
        } else {
          if (!currentAdapter?.updateRecord || !field) {
            throw new Error('No save path available for cell edit');
          }
          const updated = await currentAdapter.updateRecord(
            rowId,
            { [field]: value } as Partial<TData>,
            tableNameRef.current != null ? { table: tableNameRef.current } : undefined
          );
          // Prefer confirmed value from the returned record when present.
          if (updated && typeof updated === 'object' && field in (updated as object)) {
            const confirmed = (updated as Record<string, unknown>)[field];
            setPendingEdits((prev) => {
              const next = new Map(prev);
              next.set(key, confirmed);
              return next;
            });
          }
        }
      } catch (error) {
        setPendingEdits((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        const message = error instanceof Error ? error.message : 'Failed to save cell';
        setCellErrors((prev) => {
          const next = new Map(prev);
          next.set(key, message);
          return next;
        });
        onCellEditErrorRef.current?.({
          error,
          row,
          rowId,
          column: column as ColumnDefinition<TData, unknown>,
          field,
          value,
          previousValue,
        });
      } finally {
        setSavingCells((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [editing]
  );

  return {
    editingEnabled: editing !== false,
    hasOnCellEdit,
    pendingEdits,
    savingCells,
    cellErrors,
    activeEditKey,
    getDisplayValue,
    getRowOverlay,
    getRowErrors,
    getRowSavingColumns,
    getCellState,
    beginEdit,
    cancelEdit,
    commitEdit,
    getColumnEditability,
    isColumnPotentiallyEditable,
    isRowEditable,
    warnOnce,
    /** Stable empty sentinels for memoized rows with no overlay/errors. */
    EMPTY_OVERLAY,
    EMPTY_ERRORS,
    EMPTY_SAVING,
  };
}

export type EditableCellsApi<TData = unknown> = ReturnType<typeof useEditableCells<TData>>;
