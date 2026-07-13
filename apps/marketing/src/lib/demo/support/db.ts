import { sql } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { assignees, customers, supportRelationsSchema, supportSchema, tickets } from './schema';
import { supportSeed } from './seed-data';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database.Database | null = null;

export async function getSupportDatabase() {
  if (dbInstance && sqliteInstance) {
    return { db: dbInstance, sqlite: sqliteInstance };
  }

  const sqlite = new Database(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const db = drizzle(sqlite, { schema: { ...supportSchema, ...supportRelationsSchema } });

  await db.run(sql`CREATE TABLE support_customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    plan TEXT NOT NULL,
    region TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE support_assignees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT NOT NULL,
    shift TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE support_tickets (
    id INTEGER PRIMARY KEY,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    channel TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    assignee_id INTEGER NOT NULL,
    sla_breached INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES support_customers(id),
    FOREIGN KEY (assignee_id) REFERENCES support_assignees(id)
  )`);

  await db.insert(customers).values(supportSeed.customers);
  await db.insert(assignees).values(supportSeed.assignees);
  await db.insert(tickets).values(supportSeed.tickets);

  dbInstance = db;
  sqliteInstance = sqlite;

  return { db, sqlite };
}
