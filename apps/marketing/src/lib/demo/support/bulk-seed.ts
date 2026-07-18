import type { BulkTicket } from './schema';

const STATUSES = ['open', 'pending', 'resolved', 'escalated'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const CUSTOMER_NAMES = [
  'Northwind Labs',
  'Brightline Health',
  'Atlas Freight',
  'Studio Kite',
  'Harbor Metrics',
  'Signal Ridge',
  'Vantage Cargo',
  'Delta Point Systems',
  'Cascade Robotics',
  'Meridian Analytics',
  'Foundry Works',
  'Blue Anchor Media',
];
const ASSIGNEE_NAMES = [
  'Maya Chen',
  'Jordan Blake',
  'Priya Nair',
  'Alex Mercer',
  'Sam Ortiz',
  'Devon Kwan',
  'Riley Osei',
];
const SUBJECT_TEMPLATES = [
  'Login fails after password reset',
  'Dashboard widget shows stale numbers',
  'Export stuck in processing',
  'Webhook delivery delayed by several minutes',
  'Billing invoice missing line items',
  'Mobile app crashes on launch',
  'API rate limit hit unexpectedly',
  'Search results missing recent records',
  'Notification email never arrived',
  'Bulk import silently drops rows',
  'Report totals do not match source data',
  'SSO redirect loop for enterprise tenant',
  'Data sync gap between regions',
  'Custom field values reset after save',
  'Scheduled job did not run overnight',
];

/**
 * Deterministic PRNG (mulberry32) -- keeps the 10k-row seed reproducible
 * across server restarts, matching the curated dataset's "deterministic
 * in-memory SQLite dataset" framing rather than seeding from `Math.random()`.
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error('pick() called with an empty array');
  }
  return item;
}

/** Deterministic synthetic big-board rows with variable-length descriptions. */
export function generateBulkTickets(count: number): BulkTicket[] {
  const rng = mulberry32(20260713);
  const baseTime = new Date('2026-01-01T00:00:00Z').getTime();
  const rows: BulkTicket[] = [];

  for (let i = 0; i < count; i++) {
    const sentenceCount = 1 + Math.floor(rng() * 4);
    const description = Array.from({ length: sentenceCount }, () => pick(rng, SUBJECT_TEMPLATES))
      .map((s) => `${s}.`)
      .join(' ');

    rows.push({
      id: i + 1,
      subject: `${pick(rng, SUBJECT_TEMPLATES)} (#${i + 1})`,
      status: pick(rng, STATUSES),
      priority: pick(rng, PRIORITIES),
      customerName: pick(rng, CUSTOMER_NAMES),
      assigneeName: pick(rng, ASSIGNEE_NAMES),
      description,
      createdAt: new Date(baseTime + Math.floor(rng() * 1000 * 60 * 60 * 24 * 200)),
    });
  }

  return rows;
}
