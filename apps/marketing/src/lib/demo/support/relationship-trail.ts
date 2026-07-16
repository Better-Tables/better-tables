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
        // Stable per-filter key: prefers a real `filter.id` when present,
        // else falls back to `columnId#index` (plan 031, finding 2).
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

// `buildFilter(ticketsTable, path, [type,] operator, values)` authors each
// leaf against the table's REAL row paths and per-type operators (plan 031):
// a wrong path, a wrong operator for the column family (e.g. `equals` on an
// option column -- finding 8), or a wrong value type is a COMPILE error here.
// Option columns need the explicit `'option'` type (a string-shaped path
// can't be inferred as option); text/boolean leaves infer from the path.
// The `{ kind: 'group', logic }` wrapper is the real group shape (finding 1).
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

/**
 * The dedicated null-only-filter preset for the query-groups example
 * (027 showcase): "tickets with no assignee" via `includeNull: true,
 * values: []` (Option A semantics) rather than an `isNull`/`isEmpty`
 * operator (redundant per `FilterManager.validateFilter`, which rejects
 * `includeNull` combined with an operator that already means null).
 */
export const noAssigneeFilterPreset: SupportScenarioPreset = {
  id: 'no-assignee',
  label: 'No assignee (null-only filter)',
  description: 'Tickets where assignee.name is null -- nobody has picked them up yet.',
  filters: [buildFilter(ticketsTable, 'assignee.name', 'equals', [], { includeNull: true })],
};

/** Every preset the `query-groups` example showcases: AND groups, an OR
 * group, a flat (implicit-AND) list, and the null-only filter (027). */
export const queryGroupPresets: SupportScenarioPreset[] = [
  ...supportScenarioPresets,
  noAssigneeFilterPreset,
];
