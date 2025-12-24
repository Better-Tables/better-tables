/**
 * @fileoverview Automatic filter grouping based on common database column patterns.
 *
 * This utility automatically groups filterable columns into logical categories
 * based on their type and naming conventions, eliminating the need for manual
 * group configuration in most cases.
 *
 * @module utils/auto-group-filters
 */

import type { ColumnDefinition, ColumnType } from '../types/column';
import type { IconComponent } from '../types/common';
import type { FilterGroup } from '../types/filter';

/**
 * Configuration for automatic filter grouping
 */
export interface AutoGroupConfig {
  /** Whether to enable auto-grouping (default: true) */
  enabled?: boolean;
  /** Whether to auto-group filters (if false, returns empty array unless customGroups provided) */
  autoGroup?: boolean;
  /** Custom group definitions to override auto-detection */
  customGroups?: FilterGroup[];
  /** Customize group labels */
  groupLabels?: {
    search?: string;
    links?: string;
    dates?: string;
    status?: string;
    metrics?: string;
    other?: string;
  };
  /** Custom icons for groups (optional - UI layer can provide these) */
  groupIcons?: {
    search?: IconComponent;
    links?: IconComponent;
    dates?: IconComponent;
    status?: IconComponent;
    metrics?: IconComponent;
    other?: IconComponent;
  };
}

/**
 * Default group labels
 */
const DEFAULT_GROUP_LABELS = {
  search: 'Search',
  links: 'Links',
  dates: 'Dates',
  status: 'Status & Type',
  metrics: 'Metrics',
  other: 'Other',
} as const;

/**
 * Common searchable text field names (case-insensitive)
 */
const SEARCH_FIELD_PATTERNS = [
  'name',
  'email',
  'title',
  'description',
  'content',
  'body',
  'text',
  'summary',
  'notes',
  'comment',
  'message',
  'subject',
  'address',
  'city',
  'country',
  'phone',
  'firstname',
  'lastname',
  'fullname',
  'username',
  'displayname',
  'bio',
  'biography',
  'about',
  'location',
  'company',
  'organization',
  'occupation',
  'jobtitle',
  'position',
  'department',
  'team',
] as const;

/**
 * Common date field patterns (case-insensitive)
 */
const DATE_FIELD_PATTERNS = [
  'createdat',
  'updatedat',
  'deletedat',
  'publishedat',
  'scheduledat',
  'expiresat',
  'startdate',
  'enddate',
  'date',
  'timestamp',
] as const;

/**
 * Date field suffixes
 */
const DATE_FIELD_SUFFIXES = ['at', 'date'] as const;

/**
 * Common status/enum field names (case-insensitive)
 */
const STATUS_FIELD_PATTERNS = [
  'status',
  'type',
  'category',
  'priority',
  'level',
  'role',
  'state',
  'stage',
  'phase',
  'visibility',
  'difficulty',
  'quality',
] as const;

/**
 * Common metrics/number field names (case-insensitive)
 */
const METRICS_FIELD_PATTERNS = [
  'price',
  'cost',
  'amount',
  'total',
  'sum',
  'count',
  'quantity',
  'score',
  'rating',
  'rank',
  'order',
  'index',
  'position',
  'weight',
  'height',
  'width',
  'length',
  'size',
  'capacity',
  'limit',
  'max',
  'min',
  'average',
  'avg',
  'age',
  'years',
  'months',
  'days',
  'hours',
  'minutes',
  'seconds',
  'duration',
  'distance',
  'speed',
  'volume',
  'percentage',
  'percent',
  'ratio',
  'rate',
] as const;

/**
 * Metrics field suffixes
 */
const METRICS_FIELD_SUFFIXES = ['count', 'price', 'score'] as const;

/**
 * Common link/social media field names (case-insensitive)
 */
const LINKS_FIELD_PATTERNS = [
  'website',
  'url',
  'github',
  'linkedin',
  'twitter',
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'snapchat',
  'pinterest',
  'reddit',
  'discord',
  'telegram',
  'whatsapp',
  'social',
  'link',
  'homepage',
  'portfolio',
] as const;

/**
 * Normalize column ID for pattern matching (lowercase, remove special chars)
 * For nested paths like "profile.github", extracts the last segment "github"
 */
function normalizeColumnId(id: string): string {
  // Extract the last segment for nested paths (e.g., "profile.github" -> "github")
  const lastSegment = id.split('.').pop() || id;
  // Normalize: lowercase and remove special chars
  return lastSegment.toLowerCase().replace(/[_-]/g, '');
}

/**
 * Check if a column ID matches a pattern (exact match, suffix match, or substring match)
 */
function matchesPattern(
  normalizedId: string,
  patterns: readonly string[],
  suffixes?: readonly string[],
  allowSubstring?: boolean
): boolean {
  // Check exact matches
  if (patterns.includes(normalizedId)) {
    return true;
  }

  // Check suffix matches
  if (suffixes) {
    return suffixes.some((suffix) => normalizedId.endsWith(suffix));
  }

  // Check substring matches (for cases like "profile.github" matching "github")
  if (allowSubstring) {
    return patterns.some((pattern) => normalizedId.includes(pattern));
  }

  return false;
}

/**
 * Determine which group a column belongs to based on its type and ID
 */
function getColumnGroup<TData = unknown>(
  column: ColumnDefinition<TData>,
  labels: {
    search: string;
    links: string;
    dates: string;
    status: string;
    metrics: string;
    other: string;
  }
): string | null {
  const normalizedId = normalizeColumnId(column.id);
  const columnType: ColumnType = column.type;

  // Only group filterable columns
  if (!column.filterable) {
    return null;
  }

  // Links Group: text, url columns that match link/social media patterns
  // Check this BEFORE Search group to prioritize links
  // Use substring matching for URL columns to catch nested paths like "profile.github"
  if (
    (columnType === 'text' || columnType === 'url') &&
    matchesPattern(normalizedId, LINKS_FIELD_PATTERNS, undefined, columnType === 'url')
  ) {
    return labels.links;
  }

  // Search Group: text, email columns with searchable field names
  if (
    (columnType === 'text' || columnType === 'email') &&
    matchesPattern(normalizedId, SEARCH_FIELD_PATTERNS)
  ) {
    return labels.search;
  }

  // Dates Group: date columns
  if (
    columnType === 'date' &&
    (matchesPattern(normalizedId, DATE_FIELD_PATTERNS, DATE_FIELD_SUFFIXES) ||
      normalizedId.includes('date') ||
      normalizedId.includes('time'))
  ) {
    return labels.dates;
  }

  // Status Group: option/multiOption columns with status/enum field names
  if (
    (columnType === 'option' || columnType === 'multiOption') &&
    matchesPattern(normalizedId, STATUS_FIELD_PATTERNS)
  ) {
    return labels.status;
  }

  // Metrics Group: number, currency, percentage columns
  if (
    (columnType === 'number' || columnType === 'currency' || columnType === 'percentage') &&
    (matchesPattern(normalizedId, METRICS_FIELD_PATTERNS, METRICS_FIELD_SUFFIXES) ||
      normalizedId.includes('count') ||
      normalizedId.includes('price') ||
      normalizedId.includes('score'))
  ) {
    return labels.metrics;
  }

  // Other: everything else that's filterable
  return labels.other;
}

/**
 * Automatically group filterable columns based on common database patterns
 *
 * @param columns - Array of column definitions
 * @param config - Optional configuration for auto-grouping
 * @returns Array of filter groups
 *
 * @example
 * ```typescript
 * const columns = [
 *   cb.text().id('name').filterable().build(),
 *   cb.text().id('email').filterable().build(),
 *   cb.date().id('createdAt').filterable().build(),
 *   cb.option().id('status').filterable().build(),
 *   cb.number().id('price').filterable().build(),
 * ];
 *
 * const groups = autoGroupFilters(columns);
 * // Returns groups for: Search (name, email), Dates (createdAt), Status (status), Metrics (price)
 * ```
 */
export function autoGroupFilters<TData = unknown>(
  columns: ColumnDefinition<TData>[],
  config?: AutoGroupConfig
): FilterGroup[] {
  // If disabled, return empty array
  if (config?.enabled === false) {
    return [];
  }

  // If autoGroup is explicitly false, return empty array (unless customGroups provided)
  if (config?.autoGroup === false) {
    return config?.customGroups || [];
  }

  // If custom groups provided, use those instead
  if (config?.customGroups && config.customGroups.length > 0) {
    return config.customGroups;
  }

  const labels = {
    search: config?.groupLabels?.search ?? DEFAULT_GROUP_LABELS.search,
    links: config?.groupLabels?.links ?? DEFAULT_GROUP_LABELS.links,
    dates: config?.groupLabels?.dates ?? DEFAULT_GROUP_LABELS.dates,
    status: config?.groupLabels?.status ?? DEFAULT_GROUP_LABELS.status,
    metrics: config?.groupLabels?.metrics ?? DEFAULT_GROUP_LABELS.metrics,
    other: config?.groupLabels?.other ?? DEFAULT_GROUP_LABELS.other,
  };

  const icons = config?.groupIcons;

  // Group columns by their category
  const groupedColumns = new Map<string, string[]>();

  for (const column of columns) {
    const groupLabel = getColumnGroup(column, labels);
    if (groupLabel) {
      if (!groupedColumns.has(groupLabel)) {
        groupedColumns.set(groupLabel, []);
      }
      const columnIds = groupedColumns.get(groupLabel);
      if (columnIds) {
        columnIds.push(column.id);
      }
    }
  }

  // Convert to FilterGroup array
  const groups: FilterGroup[] = [];

  // Add groups in a specific order for better UX
  const groupOrder = [
    labels.search,
    labels.links,
    labels.dates,
    labels.status,
    labels.metrics,
    labels.other,
  ];

  for (const groupLabel of groupOrder) {
    const columnIds = groupedColumns.get(groupLabel);
    if (columnIds && columnIds.length > 0) {
      // Determine which icon to use based on group label
      let icon: IconComponent | undefined;
      if (icons) {
        if (groupLabel === labels.search) icon = icons.search;
        else if (groupLabel === labels.links) icon = icons.links;
        else if (groupLabel === labels.dates) icon = icons.dates;
        else if (groupLabel === labels.status) icon = icons.status;
        else if (groupLabel === labels.metrics) icon = icons.metrics;
        else if (groupLabel === labels.other) icon = icons.other;
      }

      groups.push({
        id: groupLabel.toLowerCase().replace(/\s+/g, '-'),
        label: groupLabel,
        icon,
        columns: columnIds,
      });
    }
  }

  return groups;
}
