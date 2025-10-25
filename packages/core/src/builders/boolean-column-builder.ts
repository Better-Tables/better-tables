/**
 * @fileoverview Boolean column builder with specialized boolean handling methods.
 *
 * This module provides a specialized column builder for boolean columns,
 * including display formatting, filtering options, and interactive controls.
 *
 * @module builders/boolean-column-builder
 */

import type { FilterConfig } from '../types/filter';
import { ColumnBuilder } from './column-builder';

/**
 * Boolean column builder with boolean-specific methods.
 *
 * Extends the base column builder with specialized methods for boolean columns,
 * including display formatting, filtering options, and interactive controls.
 *
 * @template TData - The type of row data
 *
 * @example
 * ```typescript
 * const activeColumn = new BooleanColumnBuilder<User>()
 *   .id('isActive')
 *   .displayName('Active')
 *   .accessor(user => user.isActive)
 *   .activeInactive({ showBadges: true })
 *   .booleanFilter({ includeNull: false })
 *   .build();
 * ```
 */
export class BooleanColumnBuilder<TData = unknown> extends ColumnBuilder<TData, boolean> {
  constructor() {
    super('boolean');
  }

  /**
   * Set specific boolean operators for filtering.
   *
   * Configures which boolean filter operators are available
   * for this column, allowing fine-grained control over filtering.
   *
   * @param operators - Array of boolean filter operators to enable
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const statusColumn = new BooleanColumnBuilder<User>()
   *   .id('isActive')
   *   .displayName('Status')
   *   .accessor(user => user.isActive)
   *   .booleanOperators(['isTrue', 'isFalse', 'isNull'])
   *   .build();
   * ```
   */
  booleanOperators(operators: Array<'isTrue' | 'isFalse' | 'isNull' | 'isNotNull'>): this {
    this.config.filter = {
      ...this.config.filter,
      operators,
    };
    return this;
  }

  /**
   * Configure boolean filtering.
   *
   * Sets up comprehensive boolean filtering with validation,
   * null handling, and default value options.
   *
   * @param options - Boolean filter configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const verifiedColumn = new BooleanColumnBuilder<User>()
   *   .id('isVerified')
   *   .displayName('Verified')
   *   .accessor(user => user.isVerified)
   *   .booleanFilter({
   *     includeNull: false,
   *     defaultValue: false,
   *     validation: (value) => typeof value === 'boolean' || 'Must be true or false'
   *   })
   *   .build();
   * ```
   */
  booleanFilter(
    options: {
      /** Whether to include null values (default: false) */
      includeNull?: boolean;
      /** Custom validation for boolean values */
      validation?: (value: boolean) => boolean | string;
      /** Default value for null/undefined */
      defaultValue?: boolean;
    } = {}
  ): this {
    const { includeNull = false, validation, defaultValue } = options;

    const filterConfig: FilterConfig<boolean> = {
      operators: ['isTrue', 'isFalse', 'isNull', 'isNotNull'],
      includeNull,
      validation,
    };

    this.config.filter = { ...this.config.filter, ...filterConfig };

    if (defaultValue !== undefined) {
      this.config.meta = {
        ...this.config.meta,
        defaultValue,
      };
    }

    return this;
  }

  /**
   * Configure display format for boolean values.
   *
   * Sets how boolean values are displayed in the column,
   * including text, badges, icons, checkboxes, or switches.
   *
   * @param format - Display format configuration
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const statusColumn = new BooleanColumnBuilder<User>()
   *   .id('isActive')
   *   .displayName('Status')
   *   .accessor(user => user.isActive)
   *   .displayFormat({
   *     type: 'badge',
   *     trueText: 'Active',
   *     falseText: 'Inactive',
   *     trueColor: 'green',
   *     falseColor: 'red',
   *     showIcons: true
   *   })
   *   .build();
   * ```
   */
  displayFormat(
    format: {
      /** How to display boolean values (default: 'checkbox') */
      type: 'checkbox' | 'switch' | 'badge' | 'icon' | 'text';
      /** Text to show for true values (default: 'Yes') */
      trueText?: string;
      /** Text to show for false values (default: 'No') */
      falseText?: string;
      /** Text to show for null/undefined values (default: 'N/A') */
      nullText?: string;
      /** Color for true values (default: 'green') */
      trueColor?: string;
      /** Color for false values (default: 'red') */
      falseColor?: string;
      /** Color for null values (default: 'gray') */
      nullColor?: string;
      /** Whether to show icons for boolean values (default: true) */
      showIcons?: boolean;
    } = { type: 'checkbox' }
  ): this {
    const {
      type = 'checkbox',
      trueText = 'Yes',
      falseText = 'No',
      nullText = 'N/A',
      trueColor = 'green',
      falseColor = 'red',
      nullColor = 'gray',
      showIcons = true,
    } = format;

    this.config.meta = {
      ...this.config.meta,
      display: {
        type,
        trueText,
        falseText,
        nullText,
        trueColor,
        falseColor,
        nullColor,
        showIcons,
      },
    };
    return this;
  }

  /**
   * Configure as yes/no column.
   *
   * Sets up the column to display boolean values as "Yes"/"No" text
   * with optional badge styling and custom colors.
   *
   * @param options - Yes/No configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const confirmedColumn = new BooleanColumnBuilder<Order>()
   *   .id('isConfirmed')
   *   .displayName('Confirmed')
   *   .accessor(order => order.isConfirmed)
   *   .yesNo({
   *     yesText: 'Yes',
   *     noText: 'No',
   *     showBadges: true,
   *     yesColor: 'green',
   *     noColor: 'red'
   *   })
   *   .build();
   * ```
   */
  yesNo(
    options: {
      /** Text for true values (default: 'Yes') */
      yesText?: string;
      /** Text for false values (default: 'No') */
      noText?: string;
      /** Whether to show as badges (default: false) */
      showBadges?: boolean;
      /** Color for yes values (default: 'green') */
      yesColor?: string;
      /** Color for no values (default: 'red') */
      noColor?: string;
    } = {}
  ): this {
    const {
      yesText = 'Yes',
      noText = 'No',
      showBadges = false,
      yesColor = 'green',
      noColor = 'red',
    } = options;

    this.displayFormat({
      type: showBadges ? 'badge' : 'text',
      trueText: yesText,
      falseText: noText,
      trueColor: yesColor,
      falseColor: noColor,
    });

    return this;
  }

  /**
   * Configure as active/inactive column.
   *
   * Sets up the column to display boolean values as "Active"/"Inactive" text
   * with badge styling and appropriate colors.
   *
   * @param options - Active/Inactive configuration options
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * const statusColumn = new BooleanColumnBuilder<User>()
   *   .id('isActive')
   *   .displayName('Status')
   *   .accessor(user => user.isActive)
   *   .activeInactive({
   *     activeText: 'Active',
   *     inactiveText: 'Inactive',
   *     showBadges: true,
   *     activeColor: 'green',
   *     inactiveColor: 'gray'
   *   })
   *   .build();
   * ```
   */
  activeInactive(
    options: {
      /** Text for active values (default: 'Active') */
      activeText?: string;
      /** Text for inactive values (default: 'Inactive') */
      inactiveText?: string;
      /** Whether to show as badges (default: true) */
      showBadges?: boolean;
      /** Color for active values (default: 'green') */
      activeColor?: string;
      /** Color for inactive values (default: 'gray') */
      inactiveColor?: string;
    } = {}
  ): this {
    const {
      activeText = 'Active',
      inactiveText = 'Inactive',
      showBadges = true,
      activeColor = 'green',
      inactiveColor = 'gray',
    } = options;

    this.displayFormat({
      type: showBadges ? 'badge' : 'text',
      trueText: activeText,
      falseText: inactiveText,
      trueColor: activeColor,
      falseColor: inactiveColor,
    });

    return this;
  }

  /**
   * Configure as enabled/disabled column
   */
  enabledDisabled(
    options: {
      /** Text for enabled values (default: 'Enabled') */
      enabledText?: string;
      /** Text for disabled values (default: 'Disabled') */
      disabledText?: string;
      /** Whether to show as badges (default: true) */
      showBadges?: boolean;
      /** Color for enabled values (default: 'green') */
      enabledColor?: string;
      /** Color for disabled values (default: 'red') */
      disabledColor?: string;
    } = {}
  ): this {
    const {
      enabledText = 'Enabled',
      disabledText = 'Disabled',
      showBadges = true,
      enabledColor = 'green',
      disabledColor = 'red',
    } = options;

    this.displayFormat({
      type: showBadges ? 'badge' : 'text',
      trueText: enabledText,
      falseText: disabledText,
      trueColor: enabledColor,
      falseColor: disabledColor,
    });

    return this;
  }

  /**
   * Configure as checkbox display
   */
  checkbox(
    options: {
      /** Whether checkbox is interactive (default: false) */
      interactive?: boolean;
      /** Callback when checkbox state changes */
      onChange?: (value: boolean, rowData: TData) => void;
      /** Whether to show label (default: false) */
      showLabel?: boolean;
      /** Custom label text */
      label?: string;
    } = {}
  ): this {
    const { interactive = false, onChange, showLabel = false, label } = options;

    this.displayFormat({ type: 'checkbox' });

    this.config.meta = {
      ...this.config.meta,
      checkbox: {
        interactive,
        onChange,
        showLabel,
        label,
      },
    };

    return this;
  }

  /**
   * Configure as switch display
   */
  switch(
    options: {
      /** Whether switch is interactive (default: false) */
      interactive?: boolean;
      /** Callback when switch state changes */
      onChange?: (value: boolean, rowData: TData) => void;
      /** Whether to show label (default: false) */
      showLabel?: boolean;
      /** Custom label text */
      label?: string;
      /** Size of the switch (default: 'medium') */
      size?: 'small' | 'medium' | 'large';
    } = {}
  ): this {
    const { interactive = false, onChange, showLabel = false, label, size = 'medium' } = options;

    this.displayFormat({ type: 'switch' });

    this.config.meta = {
      ...this.config.meta,
      switch: {
        interactive,
        onChange,
        showLabel,
        label,
        size,
      },
    };

    return this;
  }

  /**
   * Configure as icon display
   */
  iconDisplay(
    options: {
      /** Icon to show for true values */
      trueIcon?: string;
      /** Icon to show for false values */
      falseIcon?: string;
      /** Icon to show for null values */
      nullIcon?: string;
      /** Color for true icon (default: 'green') */
      trueColor?: string;
      /** Color for false icon (default: 'red') */
      falseColor?: string;
      /** Color for null icon (default: 'gray') */
      nullColor?: string;
      /** Size of the icons (default: 'medium') */
      size?: 'small' | 'medium' | 'large';
    } = {}
  ): this {
    const {
      trueIcon = 'check',
      falseIcon = 'x',
      nullIcon = 'minus',
      trueColor = 'green',
      falseColor = 'red',
      nullColor = 'gray',
      size = 'medium',
    } = options;

    this.displayFormat({
      type: 'icon',
      trueColor,
      falseColor,
      nullColor,
      showIcons: true,
    });

    this.config.meta = {
      ...this.config.meta,
      iconDisplay: {
        trueIcon,
        falseIcon,
        nullIcon,
        size,
      },
    };

    return this;
  }
}
