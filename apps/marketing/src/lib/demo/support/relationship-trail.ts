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
    .map((filter) => {
      const meta = columnLabels[filter.columnId];
      const value = formatFilterValue(filter.values);
      const entity = meta?.entity ?? filter.columnId.split('.')[0] ?? 'related record';
      const field = meta?.field ?? filter.columnId.split('.')[1] ?? filter.columnId;

      return {
        id: filter.id,
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

export const supportScenarioPresets: SupportScenarioPreset[] = [
  {
    id: 'enterprise-escalations',
    label: 'Enterprise escalations',
    description: 'Enterprise customers with escalated tickets.',
    filters: {
      type: 'group',
      operator: 'and',
      children: [
        {
          type: 'filter',
          columnId: 'customer.plan',
          operator: 'equals',
          values: ['enterprise'],
        },
        {
          type: 'filter',
          columnId: 'status',
          operator: 'equals',
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
      type: 'group',
      operator: 'and',
      children: [
        {
          type: 'filter',
          columnId: 'assignee.name',
          operator: 'equals',
          values: ['Maya Chen'],
        },
        {
          type: 'filter',
          columnId: 'status',
          operator: 'equals',
          values: ['open'],
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
        id: 'sla-breach',
        columnId: 'slaBreached',
        type: 'boolean',
        operator: 'isTrue',
        values: [],
      },
    ],
    sorting: [{ columnId: 'assignee.team', direction: 'asc' }],
  },
];
