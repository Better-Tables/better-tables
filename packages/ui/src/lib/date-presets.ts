/**
 * Date range presets for filter inputs
 */

import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';

export interface DatePreset {
  /** Unique identifier for the preset */
  id: string;
  /** Display label */
  label: string;
  /** Description of the preset */
  description?: string;
  /** Icon name (optional) */
  icon?: string;
  /** Function to get the date range */
  getRange: () => { from: Date; to: Date };
  /** Whether this preset is relative (updates over time) */
  isRelative?: boolean;
  /** Category for grouping presets */
  category?: 'absolute' | 'relative' | 'custom';
}

/**
 * Get current date (useful for testing)
 */
function getCurrentDate(): Date {
  return new Date();
}

/**
 * Default date presets
 */
export const DEFAULT_DATE_PRESETS: DatePreset[] = [
  // Today and recent
  {
    id: 'today',
    label: 'Today',
    description: 'Today',
    getRange: () => {
      const today = getCurrentDate();
      return {
        from: startOfDay(today),
        to: endOfDay(today),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    description: 'Yesterday',
    getRange: () => {
      const yesterday = subDays(getCurrentDate(), 1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'last-7-days',
    label: 'Last 7 days',
    description: 'Last 7 days including today',
    getRange: () => {
      const today = getCurrentDate();
      const sevenDaysAgo = subDays(today, 6);
      return {
        from: startOfDay(sevenDaysAgo),
        to: endOfDay(today),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'last-30-days',
    label: 'Last 30 days',
    description: 'Last 30 days including today',
    getRange: () => {
      const today = getCurrentDate();
      const thirtyDaysAgo = subDays(today, 29);
      return {
        from: startOfDay(thirtyDaysAgo),
        to: endOfDay(today),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'last-90-days',
    label: 'Last 90 days',
    description: 'Last 90 days including today',
    getRange: () => {
      const today = getCurrentDate();
      const ninetyDaysAgo = subDays(today, 89);
      return {
        from: startOfDay(ninetyDaysAgo),
        to: endOfDay(today),
      };
    },
    isRelative: true,
    category: 'relative',
  },

  // This week/month/year
  {
    id: 'this-week',
    label: 'This week',
    description: 'This week (Monday to Sunday)',
    getRange: () => {
      const today = getCurrentDate();
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 }),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'this-month',
    label: 'This month',
    description: 'This month',
    getRange: () => {
      const today = getCurrentDate();
      return {
        from: startOfMonth(today),
        to: endOfMonth(today),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'this-year',
    label: 'This year',
    description: 'This year',
    getRange: () => {
      const today = getCurrentDate();
      return {
        from: startOfYear(today),
        to: endOfYear(today),
      };
    },
    isRelative: true,
    category: 'relative',
  },

  // Last week/month/year
  {
    id: 'last-week',
    label: 'Last week',
    description: 'Last week (Monday to Sunday)',
    getRange: () => {
      const today = getCurrentDate();
      const lastWeek = subWeeks(today, 1);
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'last-month',
    label: 'Last month',
    description: 'Last month',
    getRange: () => {
      const today = getCurrentDate();
      const lastMonth = subMonths(today, 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'last-year',
    label: 'Last year',
    description: 'Last year',
    getRange: () => {
      const today = getCurrentDate();
      const lastYear = subYears(today, 1);
      return {
        from: startOfYear(lastYear),
        to: endOfYear(lastYear),
      };
    },
    isRelative: true,
    category: 'relative',
  },

  // Next ranges (future)
  {
    id: 'next-7-days',
    label: 'Next 7 days',
    description: 'Next 7 days starting from today',
    getRange: () => {
      const today = getCurrentDate();
      const sevenDaysLater = addDays(today, 6);
      return {
        from: startOfDay(today),
        to: endOfDay(sevenDaysLater),
      };
    },
    isRelative: true,
    category: 'relative',
  },
  {
    id: 'next-30-days',
    label: 'Next 30 days',
    description: 'Next 30 days starting from today',
    getRange: () => {
      const today = getCurrentDate();
      const thirtyDaysLater = addDays(today, 29);
      return {
        from: startOfDay(today),
        to: endOfDay(thirtyDaysLater),
      };
    },
    isRelative: true,
    category: 'relative',
  },
];

/**
 * Get presets grouped by category
 */
export function getGroupedPresets(
  presets: DatePreset[] = DEFAULT_DATE_PRESETS
): Record<string, DatePreset[]> {
  const grouped: Record<string, DatePreset[]> = {};

  presets.forEach((preset) => {
    const category = preset.category || 'relative';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(preset);
  });

  return grouped;
}

/**
 * Get preset by ID
 */
export function getPresetById(
  id: string,
  presets: DatePreset[] = DEFAULT_DATE_PRESETS
): DatePreset | undefined {
  return presets.find((preset) => preset.id === id);
}

/**
 * Create a custom preset
 */
export function createCustomPreset(
  id: string,
  label: string,
  getRange: () => { from: Date; to: Date },
  options: Partial<DatePreset> = {}
): DatePreset {
  return {
    id,
    label,
    getRange,
    isRelative: false,
    category: 'custom',
    ...options,
  };
}

/**
 * Get common presets for different use cases
 */
export function getCommonPresets(): DatePreset[] {
  return [
    getPresetById('today')!,
    getPresetById('yesterday')!,
    getPresetById('last-7-days')!,
    getPresetById('last-30-days')!,
    getPresetById('this-week')!,
    getPresetById('this-month')!,
    getPresetById('last-week')!,
    getPresetById('last-month')!,
  ].filter(Boolean);
}

/**
 * Get business-focused presets
 */
export function getBusinessPresets(): DatePreset[] {
  return [
    getPresetById('today')!,
    getPresetById('this-week')!,
    getPresetById('this-month')!,
    getPresetById('last-7-days')!,
    getPresetById('last-30-days')!,
    getPresetById('last-90-days')!,
    getPresetById('last-week')!,
    getPresetById('last-month')!,
    getPresetById('this-year')!,
    getPresetById('last-year')!,
  ].filter(Boolean);
}

/**
 * Get analytics-focused presets
 */
export function getAnalyticsPresets(): DatePreset[] {
  return [
    getPresetById('today')!,
    getPresetById('yesterday')!,
    getPresetById('last-7-days')!,
    getPresetById('last-30-days')!,
    getPresetById('last-90-days')!,
    getPresetById('this-month')!,
    getPresetById('last-month')!,
  ].filter(Boolean);
}

/**
 * Check if a date range matches a preset
 */
export function findMatchingPreset(
  from: Date,
  to: Date,
  presets: DatePreset[] = DEFAULT_DATE_PRESETS
): DatePreset | undefined {
  return presets.find((preset) => {
    const range = preset.getRange();
    return range.from.getTime() === from.getTime() && range.to.getTime() === to.getTime();
  });
}

/**
 * Format preset label with date range
 */
export function formatPresetLabel(preset: DatePreset, showDates = false): string {
  if (!showDates) {
    return preset.label;
  }

  const range = preset.getRange();
  const fromStr = range.from.toLocaleDateString();
  const toStr = range.to.toLocaleDateString();

  if (fromStr === toStr) {
    return `${preset.label} (${fromStr})`;
  }

  return `${preset.label} (${fromStr} - ${toStr})`;
}

/**
 * Preset configuration for different column types
 */
export interface DatePresetConfig {
  /** Available presets */
  presets?: DatePreset[];
  /** Whether to show preset descriptions */
  showDescriptions?: boolean;
  /** Whether to show date ranges in labels */
  showDates?: boolean;
  /** Whether to group presets by category */
  groupByCategory?: boolean;
  /** Maximum number of presets to show */
  maxPresets?: number;
  /** Custom preset groups */
  groups?: Record<string, DatePreset[]>;
  /** Default preset to select */
  defaultPreset?: string;
}

/**
 * Get preset configuration based on column metadata
 */
export function getDatePresetConfig(columnMeta?: Record<string, any>): DatePresetConfig {
  const config: DatePresetConfig = {
    presets: DEFAULT_DATE_PRESETS,
    showDescriptions: true,
    showDates: false,
    groupByCategory: true,
    maxPresets: 12,
  };

  if (columnMeta?.datePresets) {
    return {
      ...config,
      ...columnMeta.datePresets,
    };
  }

  // Smart defaults based on column metadata
  if (columnMeta?.presetType) {
    switch (columnMeta.presetType) {
      case 'common':
        config.presets = getCommonPresets();
        break;
      case 'business':
        config.presets = getBusinessPresets();
        break;
      case 'analytics':
        config.presets = getAnalyticsPresets();
        break;
    }
  }

  return config;
}
