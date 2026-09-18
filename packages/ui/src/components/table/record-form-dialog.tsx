'use client';

import type { ColumnDefinition, TableAdapter } from '@better-tables/core';
import {
  getFormatterForType,
  normalizeEditableConfig,
  resolveEditableField,
  runValidationRules,
} from '@better-tables/core';
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
  const hasEditRenderer = normalizeEditableConfig(editable)?.editRenderer != null;
  if (hasEditRenderer) return true;
  // 'custom' is in V1_EDITABLE_TYPES (it ships an inline editing AFFORDANCE),
  // but FieldEditor's type switch has no built-in editor for it — without an
  // editRenderer it falls through to `default: return null`, rendering
  // nothing. Every OTHER v1 type does have a built-in editor.
  return type !== 'custom' && V1_EDITABLE_TYPES.has(type);
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
  // Bumped every time the dialog transitions closed -> open; used as the
  // `<FieldGroup>` key below to force every field's editor to remount fresh.
  const [formKey, setFormKey] = React.useState(0);

  // Reset local state every time the dialog is (re)opened — a stale draft
  // from a previous open (a different row, or a cancelled create) must never
  // leak into this one. Deliberately keyed on the closed->open TRANSITION,
  // not `row`/`fields` changing while the dialog stays open (that would wipe
  // an in-progress edit out from under the user).
  //
  // This runs synchronously during render (the "adjusting state on a prop
  // change" pattern), not a post-commit `useEffect`: each `FieldEditor`
  // (TextEditor et al. in editable-cell.tsx) seeds its own internal draft
  // via `useState(value)` ONLY at mount, so a `setFormData` that lands after
  // the editors already mounted for a new row can't reach them — they'd
  // keep showing the PREVIOUS row's values. Resetting `formData` here AND
  // bumping `formKey` (which remounts the editors below) in the same render
  // ensures the editors that mount on this pass already see the fresh data.
  const wasOpenRef = React.useRef(open);
  if (open !== wasOpenRef.current) {
    wasOpenRef.current = open;
    if (open) {
      setFormData(buildInitialData());
      setFieldErrors({});
      setSubmitError(null);
      setFormKey((k) => k + 1);
    }
  }

  const liveRow = React.useMemo(
    () => ({ ...(row as object), ...formData }) as TData,
    [row, formData]
  );

  async function handleSubmit() {
    setSubmitError(null);

    const writableFields = fields.filter((c) => c.writable !== false);

    // Run each column's ValidationRules before touching the adapter — inline
    // cell editing enforces these (cell-edit-core.ts); this form must reject
    // the same invalid values instead of forwarding them straight through.
    const validationErrors: Record<string, string> = {};
    for (const c of writableFields) {
      const message = runValidationRules(c.validation, formData[c.id]);
      if (message) validationErrors[c.id] = message;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const c of writableFields) {
        const message = validationErrors[c.id];
        if (message) {
          next[c.id] = message;
        } else {
          delete next[c.id];
        }
      }
      return next;
    });
    if (Object.keys(validationErrors).length > 0) return;

    // Payload keys are the column's CONFIGURED storage field (`editable:
    // { field: '...' }`), not the column id — they diverge for mapped
    // columns. A relationship-path column with no field override
    // (resolveEditableField returns null) has no flat key a create/update
    // payload can address; skip it. Skip untouched fields too: option/date/
    // boolean editors only commit on an explicit selection/toggle, so an
    // untouched field's `formData[c.id]` is `undefined` — including it would
    // send an explicit `undefined` (or null, for a cleared number) that can
    // override an adapter/server default. Text/number fields auto-commit on
    // blur and are never `undefined` here unless genuinely untouched too.
    const payloadEntries: [string, unknown][] = [];
    for (const c of writableFields) {
      const field = resolveEditableField(c.id, normalizeEditableConfig(c.editable));
      if (field == null) continue;
      const value = formData[c.id];
      if (value === undefined) continue;
      payloadEntries.push([field, value]);
    }
    const payload = Object.fromEntries(payloadEntries) as Partial<TData>;

    setSubmitting(true);
    let result: TData;
    try {
      if (mode === 'create') {
        if (!adapter.createRecord) {
          throw new Error('This adapter does not support createRecord.');
        }
        result = await adapter.createRecord(payload);
      } else {
        if (!adapter.updateRecord) {
          throw new Error('This adapter does not support updateRecord.');
        }
        if (row == null) {
          throw new Error('<RecordFormDialog>: mode "edit" requires a `row`.');
        }
        result = await adapter.updateRecord(getRowId(row), payload);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      onError?.(error);
      setSubmitting(false);
      return;
    }
    // Outside the try/catch on purpose: a throw from the CONSUMER's
    // onSuccess is not an adapter/mutation failure and must not be reported
    // as one (which would also incorrectly leave the dialog open).
    setSubmitting(false);
    try {
      onSuccess?.(result);
    } catch (callbackError) {
      // Never leak this across the write boundary as a (false) "Save
      // failed" — the mutation itself already succeeded.
      console.error('[better-tables] RecordFormDialog onSuccess threw:', callbackError);
    }
    onOpenChange(false);
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

        <FieldGroup key={formKey}>
          {fields.map((column) => {
            const value = formData[column.id];
            const writable = column.writable !== false;
            const editable = writable && isEditableColumn(column.type, column.editable);
            const fieldId = `record-form-${column.id}`;

            return (
              <Field key={column.id} data-invalid={fieldErrors[column.id] ? true : undefined}>
                <FieldLabel htmlFor={fieldId}>{column.displayName}</FieldLabel>
                <FieldContent>
                  {editable ? (
                    <FieldEditor
                      column={column}
                      row={liveRow}
                      value={value}
                      config={normalizeEditableConfig(column.editable) ?? {}}
                      defaultOpen={false}
                      id={fieldId}
                      ariaLabel={column.displayName}
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
                      id={fieldId}
                      disabled
                      readOnly
                      value={
                        value == null
                          ? ''
                          : column.type === 'boolean'
                            ? String(Boolean(value))
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
