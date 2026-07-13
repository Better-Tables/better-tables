import { createColumnBuilder, defineColumns } from '@better-tables/core';
import { Badge } from '@better-tables/ui';
import type { TicketWithRelations } from './schema';

const cb = createColumnBuilder<TicketWithRelations>();

const statusColors: Record<string, string> = {
  open: 'border-[#60A5FA]/40 text-[#60A5FA]',
  pending: 'border-[#FBBF24]/40 text-[#FBBF24]',
  resolved: 'border-[#5EEAD4]/40 text-[#5EEAD4]',
  escalated: 'border-destructive/40 text-destructive',
};

const priorityColors: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-foreground',
  high: 'text-[#FBBF24]',
  urgent: 'text-destructive',
};

export const ticketColumns = defineColumns<TicketWithRelations>()([
  cb
    .text()
    .id('subject')
    .displayName('Subject')
    .accessor((ticket) => ticket.subject)
    .searchable()
    .filterable()
    .sortable()
    .build(),

  cb
    .option()
    .id('status')
    .displayName('Status')
    .accessor((ticket) => ticket.status)
    .options([
      { value: 'open', label: 'Open' },
      { value: 'pending', label: 'Pending' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'escalated', label: 'Escalated' },
    ])
    .filterable()
    .sortable()
    .cellRenderer(({ value }) => (
      <Badge variant="outline" className={statusColors[value] ?? ''}>
        {value}
      </Badge>
    ))
    .build(),

  cb
    .option()
    .id('priority')
    .displayName('Priority')
    .accessor((ticket) => ticket.priority)
    .options([
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ])
    .filterable()
    .sortable()
    .cellRenderer(({ value }) => (
      <span className={`font-mono text-xs uppercase ${priorityColors[value] ?? ''}`}>{value}</span>
    ))
    .build(),

  cb
    .option()
    .id('channel')
    .displayName('Channel')
    .accessor((ticket) => ticket.channel)
    .options([
      { value: 'email', label: 'Email' },
      { value: 'chat', label: 'Chat' },
      { value: 'phone', label: 'Phone' },
    ])
    .filterable()
    .sortable()
    .build(),

  cb
    .boolean()
    .id('slaBreached')
    .displayName('SLA breached')
    .accessor((ticket) => ticket.slaBreached)
    .activeInactive({ activeText: 'Breached', inactiveText: 'On track', showBadges: true })
    .filterable()
    .build(),

  cb
    .text()
    .id('customer.company')
    .displayName('Customer')
    .accessorWithDefault((ticket) => ticket.customer?.company)
    .searchable({ includeNull: true })
    .filterable()
    .sortable()
    .build(),

  cb
    .option()
    .id('customer.plan')
    .displayName('Customer plan')
    .accessorWithDefault((ticket) => ticket.customer?.plan)
    .options([
      { value: 'starter', label: 'Starter' },
      { value: 'pro', label: 'Pro' },
      { value: 'enterprise', label: 'Enterprise' },
    ])
    .filterable()
    .sortable()
    .build(),

  cb
    .option()
    .id('customer.region')
    .displayName('Customer region')
    .accessorWithDefault((ticket) => ticket.customer?.region)
    .options([
      { value: 'na', label: 'North America' },
      { value: 'emea', label: 'EMEA' },
      { value: 'apac', label: 'APAC' },
    ])
    .filterable()
    .sortable()
    .build(),

  cb
    .text()
    .id('assignee.name')
    .displayName('Assignee')
    .accessorWithDefault((ticket) => ticket.assignee?.name)
    .searchable({ includeNull: true })
    .filterable()
    .sortable()
    .build(),

  cb
    .option()
    .id('assignee.team')
    .displayName('Assignee team')
    .accessorWithDefault((ticket) => ticket.assignee?.team)
    .options([
      { value: 'tier1', label: 'Tier 1' },
      { value: 'tier2', label: 'Tier 2' },
      { value: 'escalation', label: 'Escalation' },
    ])
    .filterable()
    .sortable()
    .build(),

  cb
    .option()
    .id('assignee.shift')
    .displayName('Assignee shift')
    .accessorWithDefault((ticket) => ticket.assignee?.shift)
    .options([
      { value: 'day', label: 'Day' },
      { value: 'night', label: 'Night' },
    ])
    .filterable()
    .build(),

  cb
    .date()
    .id('createdAt')
    .displayName('Opened')
    .accessor((ticket) => ticket.createdAt)
    .filterable()
    .sortable()
    .build(),
]);

export const defaultVisibleTicketColumns = [
  'subject',
  'status',
  'priority',
  'customer.company',
  'customer.plan',
  'assignee.name',
  'assignee.team',
  'slaBreached',
  'createdAt',
];

export const relationshipColumnIds = new Set([
  'customer.company',
  'customer.plan',
  'customer.region',
  'assignee.name',
  'assignee.team',
  'assignee.shift',
]);
