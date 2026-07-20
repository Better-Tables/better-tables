export type UsersDialect = 'postgres' | 'sqlite';

/** True when DATABASE_URL is non-empty (preferred homepage backend). */
export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Preferred dialect from env alone — does not prove the connection works.
 * Runtime resolution may fall back to sqlite if Postgres fails to connect.
 */
export function getPreferredUsersDialect(): UsersDialect {
  return hasDatabaseUrl() ? 'postgres' : 'sqlite';
}

export function dialectMeta(dialect: UsersDialect) {
  if (dialect === 'postgres') {
    return {
      dialect,
      supportsReset: false,
      dialectLabel: 'Postgres · Neon',
      datasetLabel: '~1M users · Postgres',
      title: '~1M rows. Real Postgres.',
      description:
        'This table queries a Neon Postgres database (users + profiles) through the Drizzle adapter. Filter by joined profile fields, stack sorts, select rows — and watch the readout below show the exact SQL generated for every interaction.',
    } as const;
  }
  return {
    dialect,
    supportsReset: true,
    dialectLabel: 'SQLite · in-memory',
    datasetLabel: '5,000 rows · SQLite',
    title: '5,000 rows. Zero mocks.',
    description:
      "A seeded SQLite database runs inside this page's server. Filter by joined profile fields, stack sorts, select rows — and watch the readout below show the exact SQL the adapter generates for every interaction.",
  } as const;
}
