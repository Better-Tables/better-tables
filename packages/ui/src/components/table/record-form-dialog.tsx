'use client';

import type { ColumnDefinition, TableAdapter } from '@better-tables/core';
import { getFormatterForType, normalizeEditableConfig } from '@better-tables/core';
import * as React from 'react';
import { V1_EDITABLE_TYPES } from '../../hooks/use-editable-cells';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { FieldEditor } from './editable-cell';

/**
 * Row id for `updateRecord` — a real persisted row must carry an actual
 * identifier; unlike the table's own row-rendering fallback
 * (`defaultGetRowId` in lib/utils.ts, which degrades to a positional
 * `row-${index}` id for DISPLAY purposes), silently writing to a
 * positional id here would corrupt an unrelated record. Throw instead.
 */
function defaultGetRowId(row: unknown): string {
  if (row && typeof row === 'object') {
    const obj = row as Record<string, unknown>;
    if ('id' in obj && obj.id != null) return String(obj.id);
    if ('_id' in obj && obj._id != null) return String(obj._id);
    if ('uuid' in obj && obj.uuid != null) return String(obj.uuid);
  }
  throw new Error(
    '<RecordFormDialog>: could not determine the row id for updateRecord (no id/_id/uuid field). Pass `getRowId`.'
  );
}

/** Whether a column has a `<FieldEditor>` (a V1 built-in editor, or a custom `editRenderer`). */
function isEditableColumn<TData>(
  type: string,
  editable: ColumnDefinition<TData>['editable']
): boolean {
  if (V1_EDITABLE_TYPES.has(type)) return true;
  return normalizeEditableConfig(editable)?.editRenderer != null;
}

export interface RecordFormDialogProps<TData = unknown> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `create` renders an empty form and calls `adapter.createRecord`; `edit` pre-fills from `row` and calls `adapter.updateRecord`. */
  mode: 'create' | 'edit';
  /**
   * The same resolved columns the grid renders (`InferredColumnSpec`-backed
   * `ColumnDefinition[]`, plan 054/065) — one field per column whose
   * `writable` isn't `false`. Columns with a `derived` spec are skipped
   * entirely (server-computed, never part of a write payload).
   */
  columns: ColumnDefinition<TData, unknown>[];
  /** Existing row to pre-fill from. Required for `mode: 'edit'`. */
  row?: TData;
  /** Row id for `updateRecord`. Defaults to reading `id`/`_id`/`uuid` off `row`. */
  getRowId?: (row: TData) => string;
  /** Adapter write methods — only the one `mode` needs is ever called. */
  adapter: Pick<TableAdapter<TData>, 'createRecord' | 'updateRecord'>;
  /**
   * Explicit mutation target — forwarded as `{ table }` to `createRecord`/
   * `updateRecord`. REQUIRED for a multi-table adapter (e.g. `<TableNavigator>`,
   * plan 065 Phase 6): without it, a multi-table adapter has no way to know
   * which table this dialog is editing and either throws on ambiguity or
   * silently falls back to some `defaultMutationTable`. Single-table
   * adapters/schemas can omit it.
   */
  table?: string;
  /** Defaults to "Create record" / "Edit record" based on `mode`. */
  title?: string;
  description?: string;
  /** Called after a successful create/update, before the dialog closes. */
  onSuccess?: (record: TData) => void;
  /** Called when the adapter call throws; the dialog stays open showing the error. */
  onError?: (error: unknown) => void;
}

/**
 * Generic create/edit record form (plan 065 Phase 4): one field per
 * writable column, rendered via {@link FieldEditor} — the SAME per-type
 * editor dispatch `<EditableCell>` uses for inline cell editing, so there
 * is exactly one implementation of "how does a `date` column get edited",
 * never two. Read-only columns (`writable: false` — primary keys, anything
 * the adapter can't write back) render disabled, not editable.
 */
export function RecordFormDialog<TData = unknown>({
  open,
  onOpenChange,
  mode,
  columns,
  row,
  getRowId = defaultGetRowId,
  adapter,
  table,
  title,
  description,
  onSuccess,
  onError,
}: RecordFormDialogProps<TData>) {
  const fields = React.useMemo(() => columns.filter((c) => !c.derived), [columns]);

  const buildInitialData = React.useCallback((): Record<string, unknown> => {
    if (mode === 'edit' && row != null) {
      return Object.fromEntries(fields.map((c) => [c.id, c.accessor(row)]));
    }
    return {};
  }, [fields, mode, row]);

  const [formData, setFormData] = React.useState<Record<string, unknown>>(buildInitialData);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Reset local state every time the dialog is (re)opened — a stale draft
  // from a previous open (a different row, or a cancelled create) must
  // never leak into this one. Deliberately keyed on `open` alone: this must
  // NOT re-run just because `row`/`fields` changed while the dialog stays
  // open (that would wipe an in-progress edit out from under the user).
  React.useEffect(() => {
    if (open) {
      setFormData(buildInitialData());
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [open]);

  const liveRow = React.useMemo(
    () => ({ ...(row as object), ...formData }) as TData,
    [row, formData]
  );

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const writableFields = fields.filter((c) => c.writable !== false);
      const payload = Object.fromEntries(
        writableFields.map((c) => [c.id, formData[c.id]])
      ) as Partial<TData>;

      // Only pass `options` at all when `table` is actually set — an
      // explicit `undefined` second argument is a different call shape than
      // omitting it entirely (matters for adapters that branch on arity).
      let result: TData;
      if (mode === 'create') {
        if (!adapter.createRecord) {
          throw new Error('This adapter does not support createRecord.');
        }
        result =
          table !== undefined
            ? await adapter.createRecord(payload, { table })
            : await adapter.createRecord(payload);
      } else {
        if (!adapter.updateRecord) {
          throw new Error('This adapter does not support updateRecord.');
        }
        if (row == null) {
          throw new Error('<RecordFormDialog>: mode "edit" requires a `row`.');
        }
        result =
          table !== undefined
            ? await adapter.updateRecord(getRowId(row), payload, { table })
            : await adapter.updateRecord(getRowId(row), payload);
      }
      onSuccess?.(result);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      onError?.(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title ?? (mode === 'create' ? 'Create record' : 'Edit record')}
          </DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <FieldGroup>
          {fields.map((column) => {
            const value = formData[column.id];
            const writable = column.writable !== false;
            const editable = writable && isEditableColumn(column.type, column.editable);

            return (
              <Field key={column.id} data-invalid={fieldErrors[column.id] ? true : undefined}>
                <FieldLabel htmlFor={`record-form-${column.id}`}>{column.displayName}</FieldLabel>
                <FieldContent>
                  {editable ? (
                    <FieldEditor
                      column={column}
                      row={liveRow}
                      value={value}
                      config={normalizeEditableConfig(column.editable) ?? {}}
                      defaultOpen={false}
                      onCommit={(next) => {
                        setFieldErrors((prev) => {
                          if (!(column.id in prev)) return prev;
                          const { [column.id]: _removed, ...rest } = prev;
                          return rest;
                        });
                        setFormData((prev) => ({ ...prev, [column.id]: next }));
                      }}
                      onCancel={() => {}}
                      onInvalid={(message) =>
                        setFieldErrors((prev) => ({ ...prev, [column.id]: message }))
                      }
                    />
                  ) : (
                    <Input
                      id={`record-form-${column.id}`}
                      disabled
                      readOnly
                      value={
                        value == null
                          ? ''
                          : String(getFormatterForType(column.type, value, column.meta))
                      }
                    />
                  )}
                  <FieldError>{fieldErrors[column.id]}</FieldError>
                </FieldContent>
              </Field>
            );
          })}
        </FieldGroup>

        {submitError ? (
          <p role="alert" className="text-xs/relaxed text-destructive">
            {submitError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || Object.keys(fieldErrors).length > 0}
          >
            {submitting ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
