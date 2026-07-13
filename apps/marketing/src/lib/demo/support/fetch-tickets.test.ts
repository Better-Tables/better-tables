import { describe, expect, it } from 'bun:test';
import { fetchTickets } from '../fetch-tickets';
import { buildRelationshipTrail } from '../relationship-trail';

describe('fetchTickets', () => {
  it('returns seeded tickets by default', async () => {
    const { result, error } = await fetchTickets({ page: 1, limit: 10 });
    expect(error).toBeNull();
    expect(result.total).toBeGreaterThan(0);
    expect(result.data?.length).toBeGreaterThan(0);
  });

  it('filters tickets by related customer plan', async () => {
    const { result, error } = await fetchTickets({
      page: 1,
      limit: 20,
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
        ],
      },
    });

    expect(error).toBeNull();
    expect(result.total).toBeGreaterThan(0);
    for (const ticket of result.data ?? []) {
      expect(ticket.customer?.plan).toBe('enterprise');
    }
  });

  it('sorts tickets by assignee team', async () => {
    const { result, error } = await fetchTickets({
      page: 1,
      limit: 20,
      sorting: [{ columnId: 'assignee.team', direction: 'asc' }],
    });

    expect(error).toBeNull();
    const teams = (result.data ?? []).map((ticket) => ticket.assignee?.team).filter(Boolean);
    const sorted = [...teams].sort();
    expect(teams).toEqual(sorted);
  });
});

describe('buildRelationshipTrail', () => {
  it('describes relationship filters in plain language', () => {
    const trail = buildRelationshipTrail([
      {
        id: 'plan-filter',
        columnId: 'customer.plan',
        type: 'option',
        operator: 'equals',
        values: ['enterprise'],
      },
      {
        id: 'assignee-filter',
        columnId: 'assignee.name',
        type: 'text',
        operator: 'equals',
        values: ['Maya Chen'],
      },
    ]);

    expect(trail).toHaveLength(2);
    expect(trail[0]?.sentence).toContain('customer.plan');
    expect(trail[1]?.sentence).toContain('assignee.name');
  });
});
