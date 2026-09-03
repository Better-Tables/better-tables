'use client';

import type { ColumnDefinition, EditableConfig, EditRendererProps } from '@better-tables/core';
import { Pencil } from 'lucide-react';
import * as React from 'react';
import { useColumnOptions } from '../../hooks/use-column-options';
import { normalizeEditableConfig, V1_EDITABLE_TYPES } from '../../hooks/use-editable-cells';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export type EditableCellProps<TData = unknown, TValue = unknown> = {
  row: TData;
  rowId: string;
  column: ColumnDefinition<TData, TValue>;
  value: TValue;
  /** Display content when not editing (formatter / cellRenderer output). */
  children: React.ReactNode;
  editing: boolean;
  saving?: boolean;
  error?: string | null;
  onBeginEdit: () => void;
  onCommit: (value: TValue) => void;
  onCancel: () => void;
};

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function TextEditor<TValue>({
  value,
  multiline,
  placeholder,
  onCommit,
  onCancel,
}: {
  value: TValue;
  multiline?: boolean;
  placeholder?: string;
  onCommit: (value: TValue) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = React.useState(value == null ? '' : String(value));
  const committedRef = React.useRef(false);

  const commit = React.useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(draft as TValue);
  }, [draft, onCommit]);

  const cancel = React.useCallback(() => {
    committedRef.current = true;
    onCancel();
  }, [onCancel]);

  if (multiline) {
    return (
      <Textarea
        autoFocus
        value={draft}
        placeholder={placeholder}
        aria-label="Edit cell"
        className="min-h-16 w-full text-sm"
        onChange={(e) => {
          committedRef.current = false;
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancel();
            return;
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
        }}
      />
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      placeholder={placeholder}
      aria-label="Edit cell"
      className="h-7 w-full"
      onChange={(e) => {
        committedRef.current = false;
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancel();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          commit();
        }
      }}
    />
  );
}

function NumberEditor<TValue>({
  value,
  placeholder,
  onCommit,
  onCancel,
  onInvalid,
}: {
  value: TValue;
  placeholder?: string;
  onCommit: (value: TValue) => void;
  onCancel: () => void;
  onInvalid: (message: string) => void;
}) {
  const initial =
    typeof value === 'number' && !Number.isNaN(value)
      ? String(value)
      : value == null
        ? ''
        : String(value);
  const [draft, setDraft] = React.useState(initial);
  const committedRef = React.useRef(false);

  /** Returns whether the draft committed (or was already committed); false on a parse error. */
  const commit = React.useCallback((): boolean => {
    if (committedRef.current) return true;
    const trimmed = draft.trim();
    if (trimmed === '') {
      committedRef.current = true;
      onCommit(null as TValue);
      return true;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      onInvalid('Enter a valid number');
      return false;
    }
    committedRef.current = true;
    onCommit(parsed as TValue);
    return true;
  }, [draft, onCommit, onInvalid]);

  const cancel = React.useCallback(() => {
    committedRef.current = true;
    onCancel();
  }, [onCancel]);

  return (
    <Input
      autoFocus
      // text + decimal inputMode: type=number coerces invalid keystrokes away
      // (blocking our NaN guard) and adds spinner UX that fights dense cells.
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder={placeholder}
      aria-label="Edit cell"
      className="h-7 w-full"
      onChange={(e) => {
        committedRef.current = false;
        setDraft(e.target.value);
      }}
      onBlur={(e) => {
        const committed = commit();
        // Invalid input: refocus so the user can fix it instead of silently
        // losing focus (and the editor) on an unresolved parse error.
        if (!committed) {
          e.target.focus();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancel();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          commit();
        }
      }}
    />
  );
}

function OptionEditor<TValue>({
  value,
  options,
  onCommit,
  onCancel,
  defaultOpen = true,
}: {
  value: TValue;
  options: { value: string; label: string }[];
  onCommit: (value: TValue) => void;
  onCancel: () => void;
  /**
   * Whether the popover starts open. `true` (default) matches inline-cell
   * editing, where the user just clicked to edit and opening immediately
   * saves a click. `<RecordFormDialog>` (plan 065 Phase 4) passes `false` —
   * a form with many fields must not force every picker open on mount.
   */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const committedRef = React.useRef(false);
  const stringValue = value == null ? '' : String(value);
  const selectedLabel = options.find((o) => o.value === stringValue)?.label ?? 'Select…';

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && !committedRef.current) onCancel();
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full min-w-28 justify-between px-2 font-normal"
            aria-label="Edit cell"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }
            }}
          />
        }
      >
        <span className="truncate">{selectedLabel}</span>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div role="listbox" aria-label="Options" className="flex flex-col gap-0.5">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={option.value === stringValue ? 'secondary' : 'ghost'}
              size="sm"
              role="option"
              aria-selected={option.value === stringValue}
              className="h-7 justify-start px-2 font-normal"
              onClick={() => {
                committedRef.current = true;
                onCommit(option.value as TValue);
                setOpen(false);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Option editor with the facet fallback (plan 054): declared/enriched
 * options render immediately; a column without options lazily fetches
 * `adapter.getFilterOptions(columnId)` on first open (this component mounts
 * when editing begins). "No options" remains only for an empty/failed fetch.
 */
function OptionEditorWithFallback<TData, TValue>({
  column,
  value,
  onCommit,
  onCancel,
  defaultOpen = true,
}: {
  column: ColumnDefinition<TData, TValue>;
  value: TValue;
  onCommit: (value: TValue) => void;
  onCancel: () => void;
  defaultOpen?: boolean;
}) {
  const { options, loading } = useColumnOptions(column as ColumnDefinition<TData, unknown>);

  if (loading) {
    return <span className="text-muted-foreground text-xs">Loading options…</span>;
  }
  if (options.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>No options</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          autoFocus
          onClick={onCancel}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <OptionEditor
      value={value}
      options={options.map((o) => ({ value: String(o.value), label: o.label }))}
      onCommit={onCommit}
      onCancel={onCancel}
      defaultOpen={defaultOpen}
    />
  );
}

function BooleanEditor<TValue>({
  value,
  onCommit,
  onCancel,
}: {
  value: TValue;
  onCommit: (value: TValue) => void;
  onCancel: () => void;
}) {
  const checked = Boolean(value);
  return (
    <Switch
      autoFocus
      checked={checked}
      aria-label="Edit cell"
      onCheckedChange={(next) => {
        onCommit(next as TValue);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    />
  );
}

function DateEditor<TValue>({
  value,
  onCommit,
  onCancel,
  defaultOpen = true,
}: {
  value: TValue;
  onCommit: (value: TValue) => void;
  onCancel: () => void;
  /** See {@link OptionEditor}'s `defaultOpen` doc. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const committedRef = React.useRef(false);
  const selected = toDate(value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && !committedRef.current) onCancel();
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 font-normal"
            aria-label="Edit cell"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }
            }}
          />
        }
      >
        {selected ? selected.toLocaleDateString() : 'Pick a date'}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          autoFocus
          selected={selected}
          onSelect={(date) => {
            if (date) {
              committedRef.current = true;
              onCommit(date as TValue);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export interface FieldEditorProps<TData, TValue> {
  column: ColumnDefinition<TData, TValue>;
  row: TData;
  value: TValue;
  config: EditableConfig<TData, TValue>;
  onCommit: (value: TValue) => void;
  onCancel: () => void;
  onInvalid: (message: string) => void;
  /**
   * Whether an `option`/`date` field's popover starts open. `true` (default)
   * matches inline-cell editing (see {@link OptionEditor}'s doc);
   * `<RecordFormDialog>` (plan 065 Phase 4) passes `false`.
   */
  defaultOpen?: boolean;
}

/**
 * Per-`ColumnType` field editor dispatch — the ONE place that maps a column
 * type to its editor component. Used by {@link EditableCell} for inline
 * cell editing AND by `<RecordFormDialog>` (plan 065 Phase 4) for the
 * generic create/edit record form, so there is exactly one implementation
 * of each type's editing UI, never two.
 */
export function FieldEditor<TData, TValue>({
  column,
  row,
  value,
  config,
  onCommit,
  onCancel,
  onInvalid,
  defaultOpen = true,
}: FieldEditorProps<TData, TValue>) {
  if (config.editRenderer) {
    const props: EditRendererProps<TData, TValue> = {
      value,
      row,
      column,
      commit: onCommit,
      cancel: onCancel,
    };
    return <>{config.editRenderer(props)}</>;
  }

  switch (column.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return (
        <TextEditor
          value={value}
          {...(config.multiline ? { multiline: true } : {})}
          {...(config.placeholder != null ? { placeholder: config.placeholder } : {})}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      );
    case 'number':
    case 'currency':
    case 'percentage':
      return (
        <NumberEditor
          value={value}
          {...(config.placeholder != null ? { placeholder: config.placeholder } : {})}
          onCommit={onCommit}
          onCancel={onCancel}
          onInvalid={onInvalid}
        />
      );
    case 'option':
      return (
        <OptionEditorWithFallback
          column={column}
          value={value}
          onCommit={onCommit}
          onCancel={onCancel}
          defaultOpen={defaultOpen}
        />
      );
    case 'boolean':
      return <BooleanEditor value={value} onCommit={onCommit} onCancel={onCancel} />;
    case 'date':
      return (
        <DateEditor
          value={value}
          onCommit={onCommit}
          onCancel={onCancel}
          defaultOpen={defaultOpen}
        />
      );
    default:
      return null;
  }
}

/**
 * Inline editable cell wrapper. Renders display children until editing, then
 * swaps in a type-appropriate editor (plan 053).
 */
export function EditableCell<TData = unknown, TValue = unknown>({
  row,
  column,
  value,
  children,
  editing,
  saving = false,
  error = null,
  onBeginEdit,
  onCommit,
  onCancel,
}: EditableCellProps<TData, TValue>) {
  const config = normalizeEditableConfig(column.editable) ?? {};
  const [localError, setLocalError] = React.useState<string | null>(null);
  const displayError = localError ?? error;

  React.useEffect(() => {
    if (!editing) setLocalError(null);
  }, [editing]);

  const handleBegin = React.useCallback(
    (event?: React.SyntheticEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      onBeginEdit();
    },
    [onBeginEdit]
  );

  if (!V1_EDITABLE_TYPES.has(column.type) && !config.editRenderer) {
    return <>{children}</>;
  }

  if (editing) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: stop row-click while the editor owns pointer/keyboard
      <div
        data-slot="editable-cell"
        data-editing="true"
        data-saving={saving ? 'true' : undefined}
        className={cn(
          'relative w-full min-w-0',
          saving && 'opacity-70',
          displayError && 'ring-2 ring-destructive/40 rounded-md'
        )}
        title={displayError ?? undefined}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <FieldEditor
          column={column}
          row={row}
          value={value}
          config={config}
          onCommit={(next) => {
            setLocalError(null);
            onCommit(next);
          }}
          onCancel={onCancel}
          onInvalid={(message) => setLocalError(message)}
        />
        {displayError ? (
          <p className="mt-0.5 text-[10px] text-destructive truncate" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  const content = (
    // biome-ignore lint/a11y/useSemanticElements: focusable cell affordance nested inside <td>
    <div
      data-slot="editable-cell"
      data-saving={saving ? 'true' : undefined}
      tabIndex={0}
      role="button"
      aria-label={`Edit ${column.displayName}`}
      title={displayError ?? `Double-click or press Enter to edit ${column.displayName}`}
      className={cn(
        'group/editable relative inline-flex max-w-full items-center gap-1.5 -mx-1 min-w-0 rounded-sm px-1 outline-none',
        'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/30',
        saving && 'opacity-70',
        displayError && 'ring-2 ring-destructive/40'
      )}
      onDoubleClick={handleBegin}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBegin(e);
        }
      }}
      onClick={(e) => {
        // Always stop propagation, even on the FIRST click of a double-click
        // sequence -- the row's own `onClick` (which can navigate) fires on
        // that first click too, before `onDoubleClick` ever gets a chance to
        // open the editor. Gating this on `e.detail > 1` (native browsers
        // report `detail: 1` for that first click, `2` for the second) let
        // the first click reach the row handler and steal the interaction.
        e.stopPropagation();
      }}
    >
      <span className="min-w-0 shrink-0">{children}</span>
      <Pencil
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/editable:opacity-70 group-focus-visible/editable:opacity-70"
      />
    </div>
  );

  if (displayError) {
    return (
      <Tooltip>
        <TooltipTrigger render={<div className="min-w-0" />}>{content}</TooltipTrigger>
        <TooltipContent side="top">{displayError}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
