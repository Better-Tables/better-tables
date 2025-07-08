import React, { useState, useEffect, useCallback } from 'react';
import type { DateFilterInputProps } from './types';
import { useDebounce } from '../../hooks/use-debounce';

/**
 * Basic date filter input component
 */
export const DateFilterInput: React.FC<DateFilterInputProps> = ({
  filter,
  column,
  operators,
  operator,
  values,
  onOperatorChange,
  onValuesChange,
  onRemove,
  disabled = false,
  className = '',
  theme,
  placeholder,
  showRemove = true,
  format = 'yyyy-MM-dd',
  minDate,
  maxDate,
  showTime = false,
  timeFormat = 'HH:mm',
  locale = 'en-US',
  presets = [],
  ...props
}) => {
  const [inputValues, setInputValues] = useState<string[]>(
    values.map(v => formatDateValue(v, format, showTime, timeFormat))
  );
  
  const [showPresets, setShowPresets] = useState(false);
  
  // Debounce the input values
  const debouncedValues = useDebounce(inputValues, 300);

  // Update parent when debounced values change
  useEffect(() => {
    const dateValues = debouncedValues
      .map(v => parseDateValue(v, format, showTime))
      .filter(v => v instanceof Date && !isNaN(v.getTime()));
    
    if (JSON.stringify(dateValues.map(d => d.getTime())) !== JSON.stringify(values.map(d => d.getTime()))) {
      onValuesChange(dateValues);
    }
  }, [debouncedValues, values, onValuesChange, format, showTime]);

  // Update local state when values prop changes externally
  useEffect(() => {
    const displayValues = values.map(v => formatDateValue(v, format, showTime, timeFormat));
    if (JSON.stringify(displayValues) !== JSON.stringify(inputValues)) {
      setInputValues(displayValues);
    }
  }, [values, format, showTime, timeFormat]);

  const handleInputChange = useCallback((index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValues = [...inputValues];
    newValues[index] = event.target.value;
    setInputValues(newValues);
  }, [inputValues]);

  const handleOperatorChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    onOperatorChange(event.target.value as any);
  }, [onOperatorChange]);

  const handleRemove = useCallback(() => {
    onRemove();
  }, [onRemove]);

  const handlePresetClick = useCallback((preset: typeof presets[0]) => {
    if (preset.relative) {
      // Handle relative presets by recalculating the date range
      const now = new Date();
      const range = calculateRelativeRange(preset.key, now);
      onValuesChange([range.start, range.end]);
    } else {
      onValuesChange([preset.range.start, preset.range.end]);
    }
    setShowPresets(false);
  }, [onValuesChange]);

  // Get operator definition
  const currentOperator = operators.find(op => op.key === operator);
  const needsValue = currentOperator?.valueCount !== 0;
  const valueCount = currentOperator?.valueCount === 'variable' ? 1 : (currentOperator?.valueCount || 0);
  const needsRange = operator === 'between' || operator === 'notBetween';

  // Ensure we have the right number of input values
  const requiredInputs = needsRange ? 2 : valueCount;
  const currentInputs = Array.from({ length: requiredInputs }, (_, i) => inputValues[i] || '');

  // Base classes with theme overrides
  const containerClass = `filter-input filter-input--date ${theme?.container || ''} ${className}`.trim();
  const operatorSelectClass = `filter-input__operator ${theme?.operatorSelect || ''}`.trim();
  const valueInputClass = `filter-input__value ${theme?.valueInput || ''}`.trim();
  const removeButtonClass = `filter-input__remove ${theme?.removeButton || ''}`.trim();
  const labelClass = `filter-input__label ${theme?.label || ''}`.trim();

  // Get input properties
  const inputType = showTime ? 'datetime-local' : 'date';
  const inputMin = minDate ? formatDateValue(minDate, format, showTime, timeFormat) : undefined;
  const inputMax = maxDate ? formatDateValue(maxDate, format, showTime, timeFormat) : undefined;

  return (
    <div className={containerClass} {...props}>
      {/* Column Label */}
      <span className={labelClass}>
        {column.displayName}
      </span>

      {/* Operator Selector */}
      <select
        className={operatorSelectClass}
        value={operator}
        onChange={handleOperatorChange}
        disabled={disabled}
        aria-label={`Operator for ${column.displayName}`}
      >
        {operators.map(op => (
          <option key={op.key} value={op.key}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value Inputs */}
      {needsValue && currentInputs.map((value, index) => (
        <React.Fragment key={index}>
          {index > 0 && needsRange && (
            <span className="filter-input__range-separator">and</span>
          )}
          <input
            type={inputType}
            className={valueInputClass}
            value={value}
            onChange={handleInputChange(index)}
            placeholder={
              placeholder || 
              (needsRange && index === 0 ? 'Start date' : 
               needsRange && index === 1 ? 'End date' : 
               `Select ${column.displayName.toLowerCase()}...`)
            }
            disabled={disabled}
            min={inputMin}
            max={inputMax}
            aria-label={
              needsRange && index === 0 ? `Start ${column.displayName}` :
              needsRange && index === 1 ? `End ${column.displayName}` :
              `Value for ${column.displayName}`
            }
          />
        </React.Fragment>
      ))}

      {/* Date Presets */}
      {presets.length > 0 && needsValue && (
        <div className="filter-input__presets">
          <button
            type="button"
            className="filter-input__presets-toggle"
            onClick={() => setShowPresets(!showPresets)}
            disabled={disabled}
            aria-label="Toggle date presets"
          >
            Presets
          </button>
          {showPresets && (
            <div className="filter-input__presets-dropdown">
              {presets.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  className="filter-input__preset-option"
                  onClick={() => handlePresetClick(preset)}
                  disabled={disabled}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove Button */}
      {showRemove && (
        <button
          type="button"
          className={removeButtonClass}
          onClick={handleRemove}
          disabled={disabled}
          aria-label={`Remove ${column.displayName} filter`}
          title="Remove filter"
        >
          ×
        </button>
      )}
    </div>
  );
};

/**
 * Format a date value for display
 */
function formatDateValue(value: Date, format: string, showTime: boolean, timeFormat: string): string {
  if (!(value instanceof Date) || isNaN(value.getTime())) return '';
  
  try {
    if (showTime) {
      // Use custom time format if provided, otherwise use datetime-local format
      if (timeFormat && timeFormat !== 'HH:mm') {
        // Simple time format implementation
        const hours = value.getHours().toString().padStart(2, '0');
        const minutes = value.getMinutes().toString().padStart(2, '0');
        const seconds = value.getSeconds().toString().padStart(2, '0');
        
        // Replace format placeholders
        const formattedTime = timeFormat
          .replace('HH', hours)
          .replace('mm', minutes)
          .replace('ss', seconds);
        
        // Combine with date
        const dateStr = value.toISOString().slice(0, 10);
        return `${dateStr}T${formattedTime}`;
      } else {
        // Default datetime-local format
        return value.toISOString().slice(0, 16);
      }
    } else {
      // Use custom date format if provided, otherwise use ISO date format
      if (format && format !== 'yyyy-MM-dd') {
        // Simple date format implementation
        const year = value.getFullYear();
        const month = (value.getMonth() + 1).toString().padStart(2, '0');
        const day = value.getDate().toString().padStart(2, '0');
        
        // Replace format placeholders
        const formattedDate = format
          .replace('yyyy', year.toString())
          .replace('MM', month)
          .replace('dd', day);
        
        return formattedDate;
      } else {
        // Default ISO date format
        return value.toISOString().slice(0, 10);
      }
    }
  } catch (error) {
    return '';
  }
}

/**
 * Parse a date value from input
 */
function parseDateValue(value: string, format: string, showTime: boolean): Date {
  if (!value) return new Date(NaN);
  
  try {
    if (showTime) {
      // Parse datetime-local format
      return new Date(value);
    } else {
      // Parse date format
      if (format && format !== 'yyyy-MM-dd') {
        // Parse custom date format
        const yearMatch = format.match(/yyyy/);
        const monthMatch = format.match(/MM/);
        const dayMatch = format.match(/dd/);
        
        if (yearMatch && monthMatch && dayMatch) {
          const yearIndex = yearMatch.index!;
          const monthIndex = monthMatch.index!;
          const dayIndex = dayMatch.index!;
          
          const year = parseInt(value.substring(yearIndex, yearIndex + 4));
          const month = parseInt(value.substring(monthIndex, monthIndex + 2)) - 1; // Month is 0-indexed
          const day = parseInt(value.substring(dayIndex, dayIndex + 2));
          
          return new Date(year, month, day);
        }
      }
      
      // Default ISO date format
      return new Date(value + 'T00:00:00');
    }
  } catch (error) {
    return new Date(NaN);
  }
}

/**
 * Calculate relative date range
 */
function calculateRelativeRange(presetKey: string, now: Date): { start: Date; end: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (presetKey) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
    
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return { start: yesterday, end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1) };
    
    case 'thisWeek':
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return { start: startOfWeek, end: endOfWeek };
    
    case 'lastWeek':
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      return { start: lastWeekStart, end: lastWeekEnd };
    
    case 'thisMonth':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: startOfMonth, end: endOfMonth };
    
    case 'lastMonth':
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: lastMonthStart, end: lastMonthEnd };
    
    case 'thisYear':
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      return { start: startOfYear, end: endOfYear };
    
    case 'lastYear':
      const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
      return { start: lastYearStart, end: lastYearEnd };
    
    default:
      return { start: today, end: today };
  }
}

export default DateFilterInput; 