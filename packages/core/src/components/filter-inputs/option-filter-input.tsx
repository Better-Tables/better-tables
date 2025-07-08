import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { OptionFilterInputProps } from './types';

/**
 * Basic option filter input component
 */
export const OptionFilterInput: React.FC<OptionFilterInputProps> = ({
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
  options = [],
  searchable = true,
  showCounts = false,
  creatable = false,
  maxVisibleOptions = 10,
  loading = false,
  onLoadMore,
  optionRenderer,
  ...props
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(values);

  // Update local state when values prop changes externally
  useEffect(() => {
    setSelectedValues(values);
  }, [values]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm || !searchable) return options;
    
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, searchable]);

  // Visible options with limit
  const visibleOptions = useMemo(() => {
    return filteredOptions.slice(0, maxVisibleOptions);
  }, [filteredOptions, maxVisibleOptions]);

  const handleOperatorChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    onOperatorChange(event.target.value as any);
  }, [onOperatorChange]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleOptionSelect = useCallback((optionValue: string) => {
    const currentOperator = operators.find(op => op.key === operator);
    const allowsMultiple = currentOperator?.valueCount === 'variable';

    let newValues: string[];
    
    if (allowsMultiple) {
      // Multi-select for operators like 'isAnyOf'
      if (selectedValues.includes(optionValue)) {
        newValues = selectedValues.filter(v => v !== optionValue);
      } else {
        newValues = [...selectedValues, optionValue];
      }
    } else {
      // Single select for operators like 'is'
      newValues = [optionValue];
      setIsOpen(false);
    }

    setSelectedValues(newValues);
    onValuesChange(newValues);
  }, [operator, operators, selectedValues, onValuesChange]);

  const handleRemoveValue = useCallback((valueToRemove: string) => {
    const newValues = selectedValues.filter(v => v !== valueToRemove);
    setSelectedValues(newValues);
    onValuesChange(newValues);
  }, [selectedValues, onValuesChange]);

  const handleRemove = useCallback(() => {
    onRemove();
  }, [onRemove]);

  const handleCreateOption = useCallback(() => {
    if (creatable && searchTerm && !options.find(opt => opt.value === searchTerm)) {
      handleOptionSelect(searchTerm);
      setSearchTerm('');
    }
  }, [creatable, searchTerm, options, handleOptionSelect]);

  // Get operator definition
  const currentOperator = operators.find(op => op.key === operator);
  const needsValue = currentOperator?.valueCount !== 0;
  const allowsMultiple = currentOperator?.valueCount === 'variable';

  // Base classes with theme overrides
  const containerClass = `filter-input filter-input--option ${theme?.container || ''} ${className}`.trim();
  const operatorSelectClass = `filter-input__operator ${theme?.operatorSelect || ''}`.trim();
  const valueInputClass = `filter-input__value ${theme?.valueInput || ''}`.trim();
  const removeButtonClass = `filter-input__remove ${theme?.removeButton || ''}`.trim();
  const labelClass = `filter-input__label ${theme?.label || ''}`.trim();

  // Get selected option labels
  const selectedOptions = selectedValues.map(value => 
    options.find(opt => opt.value === value)
  ).filter(Boolean);

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

      {/* Value Selector */}
      {needsValue && (
        <div className="filter-input__option-container">
          {/* Selected Values Display */}
          {selectedValues.length > 0 && (
            <div className="filter-input__selected-values">
              {selectedOptions.map((option, index) => (
                <span key={option?.value || index} className="filter-input__selected-value">
                  {optionRenderer ? optionRenderer(option!) : option?.label}
                  {allowsMultiple && (
                    <button
                      type="button"
                      className="filter-input__remove-value"
                      onClick={() => handleRemoveValue(option!.value)}
                      disabled={disabled}
                      aria-label={`Remove ${option?.label}`}
                    >
                      ×
                    </button>
                  )}
                  {showCounts && option?.count && (
                    <span className="filter-input__option-count">({option.count})</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Search/Select Input */}
          <div className="filter-input__option-input">
            {searchable ? (
              <input
                type="text"
                className={valueInputClass}
                value={searchTerm}
                onChange={handleSearchChange}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                placeholder={placeholder || `Search ${column.displayName.toLowerCase()}...`}
                disabled={disabled}
                aria-label={`Search ${column.displayName}`}
              />
            ) : (
              <button
                type="button"
                className={valueInputClass}
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                aria-label={`Select ${column.displayName}`}
              >
                {selectedValues.length === 0 ? 
                  (placeholder || `Select ${column.displayName.toLowerCase()}...`) :
                  `${selectedValues.length} selected`
                }
              </button>
            )}

            {/* Dropdown Options */}
            {isOpen && (
              <div className="filter-input__option-dropdown">
                {loading && (
                  <div className="filter-input__option-loading">Loading...</div>
                )}
                
                {visibleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`filter-input__option ${
                      selectedValues.includes(option.value) ? 'filter-input__option--selected' : ''
                    }`}
                    onClick={() => handleOptionSelect(option.value)}
                    disabled={disabled}
                  >
                    {optionRenderer ? optionRenderer(option) : (
                      <>
                        {option.icon && <span className="filter-input__option-icon"><option.icon /></span>}
                        <span className="filter-input__option-label">{option.label}</span>
                        {showCounts && option.count && (
                          <span className="filter-input__option-count">({option.count})</span>
                        )}
                      </>
                    )}
                  </button>
                ))}

                {/* Create New Option */}
                {creatable && searchTerm && !options.find(opt => opt.value === searchTerm) && (
                  <button
                    type="button"
                    className="filter-input__option filter-input__option--create"
                    onClick={handleCreateOption}
                    disabled={disabled}
                  >
                    Create "{searchTerm}"
                  </button>
                )}

                {/* Load More */}
                {filteredOptions.length > visibleOptions.length && onLoadMore && (
                  <button
                    type="button"
                    className="filter-input__option filter-input__option--load-more"
                    onClick={onLoadMore}
                    disabled={disabled || loading}
                  >
                    Load more...
                  </button>
                )}

                {/* No Options */}
                {visibleOptions.length === 0 && !loading && (
                  <div className="filter-input__option-empty">
                    {searchTerm ? 'No options found' : 'No options available'}
                  </div>
                )}
              </div>
            )}
          </div>
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

export default OptionFilterInput; 