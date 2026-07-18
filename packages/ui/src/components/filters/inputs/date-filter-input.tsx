'use client';

import {
  type ColumnDefinition,
  type DatePreset,
  type FilterState,
  formatDateRange,
  formatDateWithConfig,
  getCommonPresets,
  getDatePresetConfig,
  getFilterValueAsDate,
} from '@better-tables/core';
import { Clock } from 'lucide-react';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { useFilterValidation } from '../../../hooks';
import { Button } from '../../ui/button';
import { Calendar } from '../../ui/calendar';
import { Label } from '../../ui/label';
import { Separator } from '../../ui/separator';

export interface DateFilterInputProps<TData = unknown> {
  /** Filter state */
  filter: FilterState;
  /** Column definition */
  column: ColumnDefinition<TData>;
  /** Value change handler */
  onChange: (values: unknown[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Date filter input — calendar + quick-select embedded inline (no nested popover).
 *
 * Pattern: Controlled component with local UI state
 * - Data state comes from parent (filter.values as dates)
 * - UI state (selected dates in calendar) managed locally
 * - Updates sent back to parent immediately (no debounce needed)
 * - Syncs from parent only when date values actually change
 */
export function DateFilterInput<TData = unknown>({
  filter,
  column,
  onChange,
  disabled = false,
}: DateFilterInputProps<TData>) {
  const needsDateRange = filter.operator === 'between' || filter.operator === 'notBetween';
  const needsNoValues = [
    'isToday',
    'isYesterday',
    'isThisWeek',
    'isThisMonth',
    'isThisYear',
    'isNull',
    'isNotNull',
  ].includes(filter.operator);

  // Get date formatting configuration from column filter config
  const dateFormat = React.useMemo(() => {
    const filterConfig = column.filter;
    return {
      format: filterConfig?.format || 'PPP',
      locale: 'en-US',
      showTime: filterConfig?.includeTime || false,
      showRelative: false,
    };
  }, [column.filter]);

  // Get date preset configuration
  const presetConfig = React.useMemo(() => getDatePresetConfig(column.meta), [column.meta]);

  // Get presets to show
  const presets = React.useMemo(() => {
    if (presetConfig.presets && presetConfig.presets.length > 0) {
      return presetConfig.presets.slice(0, presetConfig.maxPresets || 12);
    }
    return getCommonPresets();
  }, [presetConfig]);

  // Store onChange in ref to prevent effect dependencies
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Timestamps of the last values we pushed to the parent. Used so sync-from-parent
  // does not overwrite local state while the parent (URL / store) is still catching up.
  const lastEmittedRef = React.useRef<number[] | null>(null);
  // Snapshot of what the parent's value looked like right before we emitted. Lets
  // sync-from-parent tell "parent hasn't caught up yet" (still equals this snapshot)
  // apart from "parent moved to a genuinely different value" (matches neither this
  // snapshot nor what we emitted) — the latter must be accepted, not swallowed forever.
  const preEmitBaselineRef = React.useRef<number[] | null>(null);

  const emitValues = React.useCallback((values: Date[], baseline: Date[] = []) => {
    preEmitBaselineRef.current = baseline.map((d) => d.getTime());
    lastEmittedRef.current = values.map((d) => d.getTime());
    onChangeRef.current(values);
  }, []);

  // UI-only state: selected dates in calendar
  const [singleDate, setSingleDate] = React.useState<Date | undefined>(() => {
    return getFilterValueAsDate(filter, 0) || undefined;
  });

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    if (filter.values.length >= 2) {
      const from = getFilterValueAsDate(filter, 0);
      const to = getFilterValueAsDate(filter, 1);
      if (from && to) {
        return { from, to };
      }
    }
    return undefined;
  });

  // Convert dates when operator changes AND immediately sync to parent
  const prevNeedsDateRangeRef = React.useRef(needsDateRange);

  React.useEffect(() => {
    const prevNeedsDateRange = prevNeedsDateRangeRef.current;
    const operatorChanged = prevNeedsDateRange !== needsDateRange;

    if (operatorChanged) {
      // Convert from single to range: use single date (or first filter value) for both from/to
      if (needsDateRange) {
        const dateToUse = singleDate || getFilterValueAsDate(filter, 0);
        if (dateToUse) {
          setDateRange({ from: dateToUse, to: dateToUse });
          // Immediately send both dates to parent to avoid validation error
          const priorFrom = getFilterValueAsDate(filter, 0);
          emitValues([dateToUse, dateToUse], priorFrom ? [priorFrom] : []);
        }
      }
      // Convert from range to single: use the from date (or first filter value)
      else if (!needsDateRange) {
        const dateToUse = dateRange?.from || getFilterValueAsDate(filter, 0);
        if (dateToUse) {
          setSingleDate(dateToUse);
          // Immediately send the single date to parent
          const priorFrom = getFilterValueAsDate(filter, 0);
          const priorTo = getFilterValueAsDate(filter, 1);
          emitValues(
            [dateToUse],
            [priorFrom, priorTo].filter((d): d is Date => d != null)
          );
        }
      }

      prevNeedsDateRangeRef.current = needsDateRange;
    }
  }, [needsDateRange, singleDate, dateRange, filter, emitValues]);

  // Prepare values for validation
  const validationValues = React.useMemo(() => {
    if (needsNoValues) return [];
    if (needsDateRange) {
      const values = [];
      if (dateRange?.from) values.push(dateRange.from);
      if (dateRange?.to) values.push(dateRange.to);
      return values;
    }
    return singleDate ? [singleDate] : [];
  }, [singleDate, dateRange, needsDateRange, needsNoValues]);

  // Validate the current values
  // For date ranges, only validate when both dates are selected (prevents error while user is selecting)
  const shouldValidate = React.useMemo(() => {
    if (needsNoValues) return true;
    if (needsDateRange) {
      // Only validate if we have both dates
      return validationValues.length === 2;
    }
    return validationValues.length > 0;
  }, [needsDateRange, needsNoValues, validationValues.length]);

  const validation = useFilterValidation({
    filter,
    column,
    values: validationValues,
    immediate: shouldValidate,
  });

  // Sync TO parent when dates change
  React.useEffect(() => {
    if (needsNoValues) {
      lastEmittedRef.current = [];
      preEmitBaselineRef.current = [];
      onChangeRef.current([]);
    } else if (needsDateRange) {
      // For date range, only send values when BOTH dates are selected
      if (dateRange?.from && dateRange?.to) {
        const priorFrom = getFilterValueAsDate(filter, 0);
        const priorTo = getFilterValueAsDate(filter, 1);
        emitValues(
          [dateRange.from, dateRange.to],
          [priorFrom, priorTo].filter((d): d is Date => d != null)
        );
      }
    } else {
      // Single date
      if (singleDate) {
        const priorFrom = getFilterValueAsDate(filter, 0);
        emitValues([singleDate], priorFrom ? [priorFrom] : []);
      }
    }
    // `filter` intentionally omitted: this effect must only fire on local
    // (singleDate/dateRange) changes, not whenever the parent's value moves —
    // it reads `filter` solely to snapshot the pre-emit baseline for the
    // sync-from-parent effect below.
  }, [singleDate, dateRange, needsDateRange, needsNoValues, emitValues]);

  // Sync FROM parent when filter values change
  // Get external values and compare timestamps to detect actual changes
  const externalFrom = getFilterValueAsDate(filter, 0);
  const externalTo = getFilterValueAsDate(filter, 1);

  React.useEffect(() => {
    const externalTimes = [externalFrom, externalTo]
      .filter((d): d is Date => d != null)
      .map((d) => d.getTime());
    const lastEmitted = lastEmittedRef.current;
    const baseline = preEmitBaselineRef.current;

    // Parent caught up to our last emit — clear the pending markers.
    if (
      lastEmitted &&
      lastEmitted.length === externalTimes.length &&
      lastEmitted.every((t, i) => t === externalTimes[i])
    ) {
      lastEmittedRef.current = null;
      preEmitBaselineRef.current = null;
    }

    // True only while the parent is still echoing the stale snapshot from right
    // before we emitted. A parent value that matches neither that snapshot nor
    // what we emitted is a genuine external change and must be accepted below,
    // not suppressed indefinitely.
    const parentStillOnPreEmitSnapshot =
      baseline != null &&
      baseline.length === externalTimes.length &&
      baseline.every((t, i) => t === externalTimes[i]);

    if (needsDateRange && filter.values.length >= 2) {
      const from = externalFrom;
      const to = externalTo;

      if (from && to) {
        setDateRange((prev) => {
          // In-progress range pick: DayPicker sets `{ from, to: undefined }` after
          // the first click. Parent still holds the previous complete pair — do not
          // clobber the partial local selection or the second click can never land.
          if (prev?.from && !prev.to) {
            return prev;
          }

          // We just emitted a complete range and the parent is still stale — keep
          // local until it catches up (or a different external value arrives).
          const weAreWaitingOnOurEmit =
            lastEmitted &&
            lastEmitted.length === 2 &&
            prev?.from &&
            prev?.to &&
            prev.from.getTime() === lastEmitted[0] &&
            prev.to.getTime() === lastEmitted[1] &&
            (from.getTime() !== lastEmitted[0] || to.getTime() !== lastEmitted[1]);

          if (weAreWaitingOnOurEmit && parentStillOnPreEmitSnapshot) {
            return prev;
          }

          const needsUpdate =
            !prev?.from ||
            !prev?.to ||
            prev.from.getTime() !== from.getTime() ||
            prev.to.getTime() !== to.getTime();

          return needsUpdate ? { from, to } : prev;
        });
      }
    } else if (!needsDateRange) {
      const date = externalFrom;

      setSingleDate((prev) => {
        const weAreWaitingOnOurEmit =
          lastEmitted &&
          lastEmitted.length === 1 &&
          prev &&
          prev.getTime() === lastEmitted[0] &&
          (!date || date.getTime() !== lastEmitted[0]);

        if (weAreWaitingOnOurEmit && parentStillOnPreEmitSnapshot) {
          return prev;
        }

        const needsUpdate =
          (!prev && date) || (prev && !date) || (prev && date && prev.getTime() !== date.getTime());

        return needsUpdate ? date || undefined : prev;
      });
    }
  }, [externalFrom, externalTo, needsDateRange, filter.values.length]);

  // Handle preset selection
  const handlePresetSelect = React.useCallback(
    (preset: DatePreset) => {
      const range = preset.getRange();

      if (needsDateRange) {
        setDateRange({ from: range.from, to: range.to });
      } else {
        setSingleDate(range.from);
      }
    },
    [needsDateRange]
  );

  // Preset component
  const PresetButtons = React.useMemo(
    () => (
      <div className="flex flex-col gap-1 p-2">
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs font-medium text-muted-foreground">Quick Select</Label>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              variant="ghost"
              size="sm"
              onClick={() => handlePresetSelect(preset)}
              className="h-8 justify-start px-2 py-1 text-xs"
              title={preset.description}
              disabled={disabled}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    ),
    [presets, handlePresetSelect, disabled]
  );

  if (needsNoValues) {
    return (
      <div className="text-sm text-muted-foreground">
        This filter doesn't require a date selection.
      </div>
    );
  }

  const selectedSummary = needsDateRange
    ? dateRange?.from
      ? formatDateRange(dateRange.from, dateRange.to, dateFormat)
      : null
    : singleDate
      ? formatDateWithConfig(singleDate, dateFormat)
      : null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <Label className="text-sm font-semibold tracking-tight">
          {needsDateRange ? 'Date Range' : 'Date'}
        </Label>
        {selectedSummary ? (
          <span className="truncate text-xs text-muted-foreground">{selectedSummary}</span>
        ) : null}
      </div>

      <div className="flex min-w-0 rounded-md border">
        <div className="shrink-0">{PresetButtons}</div>
        <Separator orientation="vertical" className="h-auto" />
        {needsDateRange ? (
          <Calendar
            autoFocus
            mode="range"
            numberOfMonths={2}
            resetOnSelect
            disabled={disabled}
            className="min-w-0"
            {...(dateRange?.from !== undefined && { defaultMonth: dateRange.from })}
            {...(dateRange !== undefined && { selected: dateRange })}
            {...(!disabled && { onSelect: setDateRange })}
          />
        ) : (
          <Calendar
            mode="single"
            autoFocus
            disabled={disabled}
            {...(singleDate !== undefined && { selected: singleDate })}
            {...(!disabled && { onSelect: setSingleDate })}
          />
        )}
      </div>

      {!validation.isValid && validation.error && validationValues.length > 0 && (
        <p className="text-sm text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
