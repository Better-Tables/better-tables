import {
  buildFilter,
  type FilterGroupNode,
  type FilterState,
  filterKey,
  type SortingState,
} from '@better-tables/core';
import { relationshipColumnIds, ticketsTable } from './columns';

const columnLabels: Record<string, { entity: string; field: string }> = {
  'customer.company': { entity: 'customer', field: 'company' },
  'customer.plan': { entity: 'customer', field: 'plan' },
  'customer.region': { entity: 'customer', field: 'region' },
  'assignee.name': { entity: 'assignee', field: 'name' },
  'assignee.team': { entity: 'assignee', field: 'team' },
  'assignee.shift': { entity: 'assignee', field: 'shift' },
};

function formatFilterValue(values: unknown[]): string {
  if (values.length === 0) return 'any value';
  if (values.length === 1) return String(values[0]);
  return values.map(String).join(', ');
}

export interface RelationshipTrailStep {
  id: string;
  entity: string;
  field: string;
  operator: string;
  value: string;
  sentence: string;
}

export function buildRelationshipTrail(filters: FilterState[]): RelationshipTrailStep[] {
  return filters
    .filter((filter) => relationshipColumnIds.has(filter.columnId))
    .map((filter, index) => {
      const meta = columnLabels[filter.columnId];
      const value = formatFilterValue(filter.values);
      const entity = meta?.entity ?? filter.columnId.split('.')[0] ?? 'related record';
      const field = meta?.field ?? filter.columnId.split('.')[1] ?? filter.columnId;

      return {
        id: filterKey(filter, index),
        entity,
        field,
        operator: filter.operator,
        value,
        sentence: `Include tickets where ${entity}.${field} ${filter.operator.replaceAll('_', ' ')} ${value}.`,
      };
    });
}

export interface SupportScenarioPreset {
  id: string;
  label: string;
  description: string;
  filters: FilterState[] | FilterGroupNode;
  sorting?: SortingState;
}

// `buildFilter(table, path, …)` is typed against the table definition —
// wrong paths/operators fail at compile time. Wrap leaves in `{ kind: 'group' }`
// for AND/OR trees; a bare array is implicit AND.
export const supportScenarioPresets: SupportScenarioPreset[] = [
  {
    id: 'enterprise-escalations',
    label: 'Enterprise escalations',
    description: 'Enterprise customers with escalated tickets.',
    filters: {
      kind: 'group',
      logic: 'and',
      children: [
        buildFilter(ticketsTable, 'customer.plan', 'option', 'is', ['enterprise']),
        buildFilter(ticketsTable, 'status', 'option', 'is', ['escalated']),
      ],
    },
  },
  {
    id: 'maya-open',
    label: 'Maya open queue',
    description: 'Open tickets assigned to Maya Chen.',
    filters: {
      kind: 'group',
      logic: 'and',
      children: [
        buildFilter(ticketsTable, 'assignee.name', 'equals', ['Maya Chen']),
        buildFilter(ticketsTable, 'status', 'option', 'is', ['open']),
      ],
    },
  },
  {
    id: 'urgent-or-breached',
    label: 'Urgent or already breached',
    description: 'Tickets that are urgent priority OR have already breached SLA (an OR group).',
    filters: {
      kind: 'group',
      logic: 'or',
      children: [
        buildFilter(ticketsTable, 'priority', 'option', 'is', ['urgent']),
        buildFilter(ticketsTable, 'slaBreached', 'isTrue', []),
      ],
    },
  },
  {
    id: 'sla-breaches',
    label: 'SLA breaches',
    description: 'Tickets that breached SLA, sorted by assignee team.',
    filters: [buildFilter(ticketsTable, 'slaBreached', 'isTrue', [])],
    sorting: [{ columnId: 'assignee.team', direction: 'asc' }],
  },
];

/** Null-only filter: `includeNull: true` with empty values means "is empty". */
export const noAssigneeFilterPreset: SupportScenarioPreset = {
  id: 'no-assignee',
  label: 'No assignee (null-only filter)',
  description: 'Tickets where assignee.name is null -- nobody has picked them up yet.',
  filters: [buildFilter(ticketsTable, 'assignee.name', 'equals', [], { includeNull: true })],
};

/** Query-groups presets: AND groups, an OR group, a flat list, and null-only. */
export const queryGroupPresets: SupportScenarioPreset[] = [
  ...supportScenarioPresets,
  noAssigneeFilterPreset,
];
