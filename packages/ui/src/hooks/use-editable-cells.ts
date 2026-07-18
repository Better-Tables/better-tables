'use client';

import type {
  CellEditAction,
  CellWriteTarget,
  ColumnDefinition,
  TableAdapter,
} from '@better-tables/core';
import {
  buildPathAccessor,
  normalizeEditableConfig,
  resolveEditableField,
  runValidationRules,
} from '@better-tables/core';
import { useCallback, useRef, useState } from 'react';

// ONE implementation (plan 055 Step 1): the editable helpers moved to core's
// cell-edit-core module (shared with `cellEditAction` and the HTTP write
// proxy); re-exported here so this module's public surface is unchanged.
export { normalizeEditableConfig, resolveEditableField, runValidationRules };

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
  /**
   * Serializable save function (plan 055) — typically the app's
   * `'use server'` wrapper around `tables.cellEditAction(def)`. Save
   * resolution order: `onCellEdit` → `saveAction` → direct adapter.
   */
  saveAction?: CellEditAction;
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

/**
 * Client-side knowledge of a dot column's write target (plan 055):
 * a resolved {@link CellWriteTarget}, `null` (resolved: not writable),
 * `'pending'` (resolution in flight), or `'unavailable'` (no capability).
 */
export type WriteTargetState = CellWriteTarget | null | 'pending' | 'unavailable';

/** Sentinel reason while a dot column's write target resolves — not warned. */
export const RESOLVING_WRITE_TARGET_REASON = 'resolving relationship write target';

export type EditabilityResult =
  | {
      editable: true;
      field: string | null;
      savePath: 'callback' | 'action' | 'adapter';
      /** Resolved write target for relationship-path columns. */
      target?: CellWriteTarget;
    }
  | { editable: false; reason: string };

/**
 * Pure save-path / editability matrix (plan 053 Step 5; plan 055 adds the
 * `saveAction` path and relationship-path columns via CellWriteTarget).
 * Save resolution order: onCellEdit → saveAction → direct adapter →
 * read-only. Row-level `when` (and a null related object for dot columns)
 * is applied separately via {@link isRowEditable} / `isRowCellEditable`.
 */
export function resolveColumnEditability<TData, TValue>(options: {
  editing?: boolean;
  column: ColumnDefinition<TData, TValue>;
  adapter?: TableAdapter<TData> | null;
  hasOnCellEdit: boolean;
  hasSaveAction?: boolean;
  /** Write-target state for relationship-path (dot-id) columns. */
  writeTarget?: WriteTargetState;
  /** Whether a row id can be resolved for saves (adapter path). */
  canResolveRowId?: boolean;
}): EditabilityResult {
  const editing = options.editing !== false;
  const { column, hasOnCellEdit } = options;
  const hasSaveAction = options.hasSaveAction === true;
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

  const ownField = resolveEditableField(column.id, config);

  if (hasOnCellEdit) {
    return { editable: true, field: ownField, savePath: 'callback' };
  }

  const supportsUpdate =
    Boolean(adapter?.meta?.features?.update) && typeof adapter?.updateRecord === 'function';

  if (ownField) {
    // Own-table column (flat id, or explicit `editable.field` override).
    if (hasSaveAction) {
      return { editable: true, field: ownField, savePath: 'action' };
    }
    if (!supportsUpdate) {
      return {
        editable: false,
        reason:
          'no save path — pass onCellEdit/saveAction, or use an adapter with features.update + updateRecord',
      };
    }
    if (!canResolveRowId) {
      return { editable: false, reason: 'row id could not be resolved for adapter save' };
    }
    return { editable: true, field: ownField, savePath: 'adapter' };
  }

  // Relationship-path column (plan 055): the write target must be resolved
  // so the RELATED row can be addressed — even under saveAction (admission
  // is the server policy's job, but the target id comes from
  // `relatedIdPath` in row data).
  const targetState = options.writeTarget ?? 'unavailable';
  if (targetState === 'pending') {
    return { editable: false, reason: RESOLVING_WRITE_TARGET_REASON };
  }
  if (targetState === 'unavailable') {
    return {
      editable: false,
      reason:
        'relationship-path column: adapter has no resolveCellWriteTarget — pass editable.field or onCellEdit',
    };
  }
  if (targetState === null) {
    return {
      editable: false,
      reason: 'relationship-path column has no resolvable write target',
    };
  }
  if (!targetState.single) {
    return {
      editable: false,
      reason: 'one-to-many relationship columns are never cell-editable',
    };
  }
  if (!targetState.writable) {
    return {
      editable: false,
      reason: 'relationship write target is not writable (schema)',
    };
  }

  if (hasSaveAction) {
    return { editable: true, field: targetState.field, savePath: 'action', target: targetState };
  }
  if (!supportsUpdate) {
    return {
      editable: false,
      reason:
        'no save path — pass onCellEdit/saveAction, or use an adapter with features.update + updateRecord',
    };
  }
  if (!canResolveRowId) {
    return { editable: false, reason: 'row id could not be resolved for adapter save' };
  }
  return { editable: true, field: targetState.field, savePath: 'adapter', target: targetState };
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

const EMPTY_OVERLAY: Readonly<Record<string, unknown>> = Object.freeze({});
const EMPTY_ERRORS: Readonly<Record<string, string>> = Object.freeze({});
const EMPTY_SAVING: ReadonlySet<string> = new Set();

export function useEditableCells<TData = unknown>(options: UseEditableCellsOptions<TData>) {
  const { adapter, tableName, onCellEdit, onCellEditError, saveAction, editing = true } = options;

  const [pendingEdits, setPendingEdits] = useState(() => new Map<string, unknown>());
  const [savingCells, setSavingCells] = useState(() => new Set<string>());
  const [cellErrors, setCellErrors] = useState(() => new Map<string, string>());
  const [activeEditKey, setActiveEditKey] = useState<string | null>(null);
  /** Resolved write targets for relationship-path columns (plan 055). */
  const [resolvedTargets, setResolvedTargets] = useState(
    () => new Map<string, CellWriteTarget | null>()
  );

  const warnedColumnsRef = useRef(new Set<string>());
  const pendingEditsRef = useRef(pendingEdits);
  pendingEditsRef.current = pendingEdits;
  const savingCellsRef = useRef(savingCells);
  savingCellsRef.current = savingCells;
  const onCellEditRef = useRef(onCellEdit);
  onCellEditRef.current = onCellEdit;
  const onCellEditErrorRef = useRef(onCellEditError);
  onCellEditErrorRef.current = onCellEditError;
  const saveActionRef = useRef(saveAction);
  saveActionRef.current = saveAction;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const tableNameRef = useRef(tableName);
  tableNameRef.current = tableName;
  const resolvedTargetsRef = useRef(resolvedTargets);
  resolvedTargetsRef.current = resolvedTargets;
  const resolvingTargetsRef = useRef(new Set<string>());

  const hasOnCellEdit = Boolean(onCellEdit);
  const hasSaveAction = Boolean(saveAction);

  const warnOnce = useCallback((columnId: string, message: string) => {
    if (process.env.NODE_ENV === 'production') return;
    if (warnedColumnsRef.current.has(columnId)) return;
    warnedColumnsRef.current.add(columnId);
    console.warn(`[better-tables] editable column "${columnId}": ${message}`);
  }, []);

  /**
   * Lazily resolve a dot column's write target through the adapter
   * capability, once per column (plan 055). The kick-off is a guarded
   * fire-and-forget: state lands asynchronously, never during render.
   */
  const requestTargetResolution = useCallback((columnId: string) => {
    if (resolvedTargetsRef.current.has(columnId)) return;
    if (resolvingTargetsRef.current.has(columnId)) return;
    const currentAdapter = adapterRef.current;
    const resolve = currentAdapter?.resolveCellWriteTarget;
    if (typeof resolve !== 'function') return;
    resolvingTargetsRef.current.add(columnId);
    resolve
      .call(currentAdapter, columnId, tableNameRef.current)
      .then(
        (target) => {
          setResolvedTargets((prev) => new Map(prev).set(columnId, target));
        },
        () => {
          setResolvedTargets((prev) => new Map(prev).set(columnId, null));
        }
      )
      .finally(() => {
        resolvingTargetsRef.current.delete(columnId);
      });
  }, []);

  /** Write-target state for a column: only dot ids (without a field override) need one. */
  const getWriteTargetState = useCallback(
    <TValue>(column: ColumnDefinition<TData, TValue>): WriteTargetState | undefined => {
      const config = normalizeEditableConfig(column.editable);
      if (!config) return undefined;
      if (resolveEditableField(column.id, config)) return undefined; // own-table
      const capability = adapterRef.current?.resolveCellWriteTarget;
      if (typeof capability !== 'function') return 'unavailable';
      if (resolvedTargets.has(column.id)) {
        return resolvedTargets.get(column.id) ?? null;
      }
      requestTargetResolution(column.id);
      return 'pending';
    },
    [requestTargetResolution, resolvedTargets]
  );

  const getColumnEditability = useCallback(
    <TValue>(column: ColumnDefinition<TData, TValue>): EditabilityResult => {
      const writeTarget = getWriteTargetState(column);
      const result = resolveColumnEditability({
        editing,
        column,
        hasOnCellEdit,
        hasSaveAction,
        ...(writeTarget !== undefined ? { writeTarget } : {}),
        ...(adapter != null ? { adapter } : {}),
      });
      if (
        !result.editable &&
        column.editable &&
        // In-flight target resolution is transient — don't burn the
        // column's one warn on it.
        result.reason !== RESOLVING_WRITE_TARGET_REASON
      ) {
        warnOnce(column.id, result.reason);
      }
      return result;
    },
    [adapter, editing, hasOnCellEdit, hasSaveAction, getWriteTargetState, warnOnce]
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
      const config = normalizeEditableConfig(column.editable);
      const isDotColumn = config != null && !resolveEditableField(column.id, config);
      let writeTarget: WriteTargetState | undefined;
      if (isDotColumn) {
        writeTarget =
          typeof currentAdapter?.resolveCellWriteTarget === 'function'
            ? resolvedTargetsRef.current.has(column.id)
              ? (resolvedTargetsRef.current.get(column.id) ?? null)
              : 'pending'
            : 'unavailable';
      }
      const editability = resolveColumnEditability({
        editing,
        column,
        hasOnCellEdit: Boolean(onCellEditRef.current),
        hasSaveAction: Boolean(saveActionRef.current),
        canResolveRowId: Boolean(rowId),
        ...(writeTarget !== undefined ? { writeTarget } : {}),
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

      // Resolve the TARGET row id: the own row for flat columns, the value
      // at the target's relatedIdPath for relationship-path columns
      // (plan 055) — a null related object makes the cell unsaveable.
      const target = editability.savePath === 'callback' ? undefined : editability.target;
      let targetRowId = rowId;
      if (target?.relatedIdPath) {
        const relatedId = buildPathAccessor(target.relatedIdPath)(row);
        if (relatedId == null) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              `[better-tables] commitEdit on "${column.id}": related row id missing at ` +
                `'${target.relatedIdPath}' — cell is read-only for this row`
            );
          }
          return;
        }
        targetRowId = String(relatedId);
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

      // The storage field the save writes (related-table field for dot columns).
      const writeField = target ? target.field : field;

      /** Prefer the confirmed value from a returned record when present. */
      const confirmFromRecord = (updated: unknown) => {
        if (
          writeField &&
          updated &&
          typeof updated === 'object' &&
          writeField in (updated as object)
        ) {
          const confirmed = (updated as Record<string, unknown>)[writeField];
          setPendingEdits((prev) => {
            const next = new Map(prev);
            next.set(key, confirmed);
            return next;
          });
        }
      };

      try {
        const callback = onCellEditRef.current;
        const action = saveActionRef.current;
        if (callback) {
          await callback(ctx);
        } else if (action) {
          // Serializable boundary (plan 055): Dates go out as ISO strings;
          // `field` on the wire is the COLUMN id — the server-side policy
          // re-resolves it to (table, field) so the client can never
          // redirect a write.
          const wireValue = value instanceof Date ? value.toISOString() : value;
          const result = await action({ id: targetRowId, field: column.id, value: wireValue });
          if (!result.ok) {
            throw new Error(result.error);
          }
          confirmFromRecord(result.data);
        } else {
          if (!currentAdapter?.updateRecord || !writeField) {
            throw new Error('No save path available for cell edit');
          }
          const writeTable = target ? target.table : tableNameRef.current;
          const updated = await currentAdapter.updateRecord(
            targetRowId,
            { [writeField]: value } as Partial<TData>,
            writeTable != null ? { table: writeTable } : undefined
          );
          confirmFromRecord(updated);
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

  /**
   * Row-level editability gate: `editable.when` PLUS, for relationship-path
   * columns, the presence of the related row id in this row's data
   * (plan 055 — a null related object renders that row's cell read-only).
   */
  const isRowCellEditable = useCallback(
    (column: ColumnDefinition<TData, unknown>, row: TData): boolean => {
      if (!isRowEditable(column, row)) return false;
      const target = resolvedTargetsRef.current.get(column.id);
      if (target?.relatedIdPath) {
        return buildPathAccessor(target.relatedIdPath)(row) != null;
      }
      return true;
    },
    []
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
    isRowCellEditable,
    warnOnce,
    /** Stable empty sentinels for memoized rows with no overlay/errors. */
    EMPTY_OVERLAY,
    EMPTY_ERRORS,
    EMPTY_SAVING,
  };
}

export type EditableCellsApi<TData = unknown> = ReturnType<typeof useEditableCells<TData>>;
