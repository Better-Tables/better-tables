import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { MultiOptionFilterInputProps } from './types';
import { useDebounce } from '../../hooks/use-debounce';

/**
 * Multi-option filter input component for selecting multiple values
 */
export const MultiOptionFilterInput: React.FC<MultiOptionFilterInputProps> = ({
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
  maxSelectedOptions,
  loading = false,
  onLoadMore,
  optionRenderer,
  selectedOptionRenderer,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>(values || []);
  
  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!debouncedSearchQuery) return options;
    
    return options.filter(option =>
      option.label.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      option.value.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
  }, [options, debouncedSearchQuery]);

  // Get visible options (limited by maxVisibleOptions)
  const visibleOptions = useMemo(() => {
    return filteredOptions.slice(0, maxVisibleOptions);
  }, [filteredOptions, maxVisibleOptions]);

  // Check if we can create a new option
  const canCreateOption = useMemo(() => {
    if (!creatable || !debouncedSearchQuery) return false;
    
    const existingOption = options.find(
      option => option.value.toLowerCase() === debouncedSearchQuery.toLowerCase()
    );
    
    return !existingOption;
  }, [creatable, debouncedSearchQuery, options]);

  // Update local state when values prop changes externally
  useEffect(() => {
    if (JSON.stringify(values) !== JSON.stringify(selectedValues)) {
      setSelectedValues(values || []);
    }
  }, [values]);

  // Update parent when selected values change
  useEffect(() => {
    if (JSON.stringify(selectedValues) !== JSON.stringify(values)) {
      onValuesChange(selectedValues);
    }
  }, [selectedValues, values, onValuesChange]);

  const handleOperatorChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    onOperatorChange(event.target.value as any);
  }, [onOperatorChange]);

  const handleRemove = useCallback(() => {
    onRemove();
  }, [onRemove]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleOptionClick = useCallback((optionValue: string) => {
    const isSelected = selectedValues.includes(optionValue);
    
    if (isSelected) {
      // Remove from selection
      setSelectedValues(prev => prev.filter(v => v !== optionValue));
    } else {
      // Add to selection (if not at max limit)
      if (!maxSelectedOptions || selectedValues.length < maxSelectedOptions) {
        setSelectedValues(prev => [...prev, optionValue]);
      }
    }
  }, [selectedValues, maxSelectedOptions]);

  const handleRemoveSelectedOption = useCallback((optionValue: string) => {
    setSelectedValues(prev => prev.filter(v => v !== optionValue));
  }, []);

  const handleCreateOption = useCallback(() => {
    if (!canCreateOption) return;
    
    const newValue = debouncedSearchQuery.trim();
    if (newValue && !selectedValues.includes(newValue)) {
      setSelectedValues(prev => [...prev, newValue]);
      setSearchQuery('');
    }
  }, [canCreateOption, debouncedSearchQuery, selectedValues]);

  const handleToggleDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen(!isOpen);
  }, [disabled, isOpen]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('.filter-input--multi-option')) {
      setIsOpen(false);
    }
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  // Get operator definition
  const currentOperator = operators.find(op => op.key === operator);
  const needsValue = currentOperator?.valueCount !== 0;

  // Get selected options for display
  const selectedOptions = useMemo(() => {
    return selectedValues.map(value => {
      const option = options.find(opt => opt.value === value);
      return option || { value, label: value, count: 0 };
    });
  }, [selectedValues, options]);

  // Base classes with theme overrides
  const containerClass = `filter-input filter-input--multi-option ${theme?.container || ''} ${className}`.trim();
  const operatorSelectClass = `filter-input__operator ${theme?.operatorSelect || ''}`.trim();
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

      {/* Multi-Option Selector */}
      {needsValue && (
        <div className="filter-input__multi-option-container">
          {/* Selected Options Display */}
          {selectedOptions.length > 0 && (
            <div className="filter-input__selected-options">
              {selectedOptions.map(option => (
                <div key={option.value} className="filter-input__selected-option">
                  {selectedOptionRenderer ? (
                    selectedOptionRenderer(option)
                  ) : (
                    <>
                      <span className="filter-input__selected-option-label">
                        {option.label}
                      </span>
                      <button
                        type="button"
                        className="filter-input__selected-option-remove"
                        onClick={() => handleRemoveSelectedOption(option.value)}
                        disabled={disabled}
                        aria-label={`Remove ${option.label}`}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Dropdown Toggle */}
          <button
            type="button"
            className={`filter-input__dropdown-toggle ${isOpen ? 'filter-input__dropdown-toggle--open' : ''}`}
            onClick={handleToggleDropdown}
            disabled={disabled}
            aria-label={`Toggle ${column.displayName} options`}
          >
            {selectedOptions.length > 0 
              ? `${selectedOptions.length} selected` 
              : placeholder || `Select ${column.displayName.toLowerCase()}...`}
            <span className="filter-input__dropdown-arrow">
              {isOpen ? '▲' : '▼'}
            </span>
          </button>

          {/* Dropdown Content */}
          {isOpen && (
            <div className="filter-input__multi-option-dropdown">
              {/* Search Input */}
              {searchable && (
                <div className="filter-input__search-container">
                  <input
                    type="text"
                    className="filter-input__search"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search options..."
                    disabled={disabled}
                  />
                </div>
              )}

              {/* Options List */}
              <div className="filter-input__options-list">
                {loading && (
                  <div className="filter-input__loading">Loading...</div>
                )}

                {visibleOptions.map(option => {
                  const isSelected = selectedValues.includes(option.value);
                  const isDisabled = disabled || (
                    maxSelectedOptions && 
                    selectedValues.length >= maxSelectedOptions && 
                    !isSelected
                  );

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`filter-input__option ${isSelected ? 'filter-input__option--selected' : ''} ${isDisabled ? 'filter-input__option--disabled' : ''}`}
                      onClick={() => handleOptionClick(option.value)}
                      disabled={Boolean(isDisabled)}
                      aria-label={`${isSelected ? 'Remove' : 'Select'} ${option.label}`}
                    >
                      {optionRenderer ? (
                        optionRenderer(option)
                      ) : (
                        <>
                          <span className="filter-input__option-checkbox">
                            {isSelected ? '☑' : '☐'}
                          </span>
                          <span className="filter-input__option-label">
                            {option.label}
                          </span>
                          {showCounts && option.count !== undefined && (
                            <span className="filter-input__option-count">
                              ({option.count})
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}

                {/* Create Option */}
                {canCreateOption && (
                  <button
                    type="button"
                    className="filter-input__create-option"
                    onClick={handleCreateOption}
                    disabled={disabled}
                    aria-label={`Create option "${debouncedSearchQuery}"`}
                  >
                    Create "{debouncedSearchQuery}"
                  </button>
                )}

                {/* Load More */}
                {onLoadMore && filteredOptions.length > maxVisibleOptions && (
                  <button
                    type="button"
                    className="filter-input__load-more"
                    onClick={onLoadMore}
                    disabled={disabled || loading}
                    aria-label="Load more options"
                  >
                    Load more...
                  </button>
                )}

                {/* No Options */}
                {!loading && visibleOptions.length === 0 && !canCreateOption && (
                  <div className="filter-input__no-options">
                    No options found
                  </div>
                )}
              </div>
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

export default MultiOptionFilterInput; 