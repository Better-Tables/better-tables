import React, { useState, useEffect, useCallback } from 'react';
import type { BooleanFilterInputProps } from './types';

/**
 * Basic boolean filter input component
 */
export const BooleanFilterInput: React.FC<BooleanFilterInputProps> = ({
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
  showRemove = true,
  trueLabel = 'True',
  falseLabel = 'False',
  nullLabel = 'Not Set',
  showIndeterminate = false,
  ...props
}) => {
  const [selectedValue, setSelectedValue] = useState<boolean | null>(
    values.length > 0 ? values[0] : null
  );

  // Update local state when values prop changes externally
  useEffect(() => {
    setSelectedValue(values.length > 0 ? values[0] : null);
  }, [values]);

  const handleOperatorChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    onOperatorChange(event.target.value as any);
  }, [onOperatorChange]);

  const handleValueChange = useCallback((value: boolean | null) => {
    setSelectedValue(value);
    
    // Handle different operators
    if (operator === 'isTrue') {
      onValuesChange([]);
    } else if (operator === 'isFalse') {
      onValuesChange([]);
    } else if (operator === 'isNull') {
      onValuesChange([]);
    } else if (operator === 'isNotNull') {
      onValuesChange([]);
    } else {
      // For generic operators, pass the actual value
      onValuesChange(value !== null ? [value] : []);
    }
  }, [operator, onValuesChange]);

  const handleRemove = useCallback(() => {
    onRemove();
  }, [onRemove]);

  // Get operator definition
  const currentOperator = operators.find(op => op.key === operator);
  const needsValue = currentOperator?.valueCount !== 0;

  // For no-value operators, determine the implied value
  const getImpliedValue = (): boolean | null => {
    switch (operator) {
      case 'isTrue':
        return true;
      case 'isFalse':
        return false;
      case 'isNull':
        return null;
      case 'isNotNull':
        return selectedValue !== null ? selectedValue : true;
      default:
        return selectedValue;
    }
  };

  const displayValue = getImpliedValue();

  // Base classes with theme overrides
  const containerClass = `filter-input filter-input--boolean ${theme?.container || ''} ${className}`.trim();
  const operatorSelectClass = `filter-input__operator ${theme?.operatorSelect || ''}`.trim();
  const valueInputClass = `filter-input__value ${theme?.valueInput || ''}`.trim();
  const removeButtonClass = `filter-input__remove ${theme?.removeButton || ''}`.trim();
  const labelClass = `filter-input__label ${theme?.label || ''}`.trim();

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

      {/* Value Input */}
      {needsValue && (
        <div className="filter-input__boolean-container">
          {/* Radio Button Style */}
          <div className="filter-input__boolean-options">
            <label className="filter-input__boolean-option">
              <input
                type="radio"
                name={`boolean-${filter.columnId}`}
                checked={selectedValue === true}
                onChange={() => handleValueChange(true)}
                disabled={disabled}
              />
              <span>{trueLabel}</span>
            </label>

            <label className="filter-input__boolean-option">
              <input
                type="radio"
                name={`boolean-${filter.columnId}`}
                checked={selectedValue === false}
                onChange={() => handleValueChange(false)}
                disabled={disabled}
              />
              <span>{falseLabel}</span>
            </label>

            {showIndeterminate && (
              <label className="filter-input__boolean-option">
                <input
                  type="radio"
                  name={`boolean-${filter.columnId}`}
                  checked={selectedValue === null}
                  onChange={() => handleValueChange(null)}
                  disabled={disabled}
                />
                <span>{nullLabel}</span>
              </label>
            )}
          </div>

          {/* Alternative: Select Dropdown */}
          <select
            className={`${valueInputClass} filter-input__boolean-select`}
            value={selectedValue === null ? 'null' : selectedValue.toString()}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'null') {
                handleValueChange(null);
              } else {
                handleValueChange(value === 'true');
              }
            }}
            disabled={disabled}
            aria-label={`Value for ${column.displayName}`}
            style={{ display: 'none' }} // Hide by default, can be shown via CSS or theme
          >
            <option value="true">{trueLabel}</option>
            <option value="false">{falseLabel}</option>
            {showIndeterminate && <option value="null">{nullLabel}</option>}
          </select>
        </div>
      )}

      {/* Value Display for No-Value Operators */}
      {!needsValue && (
        <div className="filter-input__boolean-display">
          <span className="filter-input__boolean-implied">
            {displayValue === true ? trueLabel : 
             displayValue === false ? falseLabel : 
             nullLabel}
          </span>
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

export default BooleanFilterInput; 