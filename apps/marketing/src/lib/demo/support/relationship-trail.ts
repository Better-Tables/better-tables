import type { FilterGroupNode, FilterState, SortingState } from '@better-tables/core';
import { relationshipColumnIds } from './columns';

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
        // DX-FINDING-2: FilterState has no `id` field (identity is
        // `columnId`, which isn't unique within a group) -- derive a
        // display-only key from columnId + position instead. See
        // plans/findings/029-dx-findings.md #2.
        id: `${filter.columnId}-${index}`,
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

// DX-FINDING-1: the intuitive `{ type: 'group', operator: 'and', children: [{ type:
// 'filter', columnId, operator, values }] }` shape does not exist. The real
// shape is `{ kind: 'group', logic: 'and' | 'or', children: FilterNode[] }`
// with BARE FilterState leaves (no `type: 'filter'` wrapper) that must each
// restate the column's data type (`type: 'option' | 'text' | ...`). See
// plans/findings/029-dx-findings.md #1.
//
// DX-FINDING-8: option-typed leaves use `is`/`isAnyOf`, not `equals` --
// `equals` type-checks (FilterOperator is one flat union across every column
// type) but fails FilterManager's runtime validation for an option column
// (`OptionColumnBuilder.options()` restricts allowed operators to
// `is`/`isNot`/`isAnyOf`/`isNoneOf`). See plans/findings/029-dx-findings.md #8.
export const supportScenarioPresets: SupportScenarioPreset[] = [
  {
    id: 'enterprise-escalations',
    label: 'Enterprise escalations',
    description: 'Enterprise customers with escalated tickets.',
    filters: {
      kind: 'group',
      logic: 'and',
      children: [
        {
          columnId: 'customer.plan',
          type: 'option',
          operator: 'is',
          values: ['enterprise'],
        },
        {
          columnId: 'status',
          type: 'option',
          operator: 'is',
          values: ['escalated'],
        },
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
        {
          columnId: 'assignee.name',
          type: 'text',
          operator: 'equals',
          values: ['Maya Chen'],
        },
        {
          columnId: 'status',
          type: 'option',
          operator: 'is',
          values: ['open'],
        },
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
        {
          columnId: 'priority',
          type: 'option',
          operator: 'is',
          values: ['urgent'],
        },
        {
          columnId: 'slaBreached',
          type: 'boolean',
          operator: 'isTrue',
          values: [],
        },
      ],
    },
  },
  {
    id: 'sla-breaches',
    label: 'SLA breaches',
    description: 'Tickets that breached SLA, sorted by assignee team.',
    filters: [
      {
        columnId: 'slaBreached',
        type: 'boolean',
        operator: 'isTrue',
        values: [],
      },
    ],
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
  filters: [
    {
      columnId: 'assignee.name',
      type: 'text',
      operator: 'equals',
      values: [],
      includeNull: true,
    },
  ],
};

/** Every preset the `query-groups` example showcases: AND groups, an OR
 * group, a flat (implicit-AND) list, and the null-only filter (027). */
export const queryGroupPresets: SupportScenarioPreset[] = [
  ...supportScenarioPresets,
  noAssigneeFilterPreset,
];
