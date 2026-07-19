import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const customers = sqliteTable('support_customers', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  company: text('company').notNull(),
  plan: text('plan', { enum: ['starter', 'pro', 'enterprise'] }).notNull(),
  region: text('region', { enum: ['na', 'emea', 'apac'] }).notNull(),
});

export const assignees = sqliteTable('support_assignees', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  team: text('team', { enum: ['tier1', 'tier2', 'escalation'] }).notNull(),
  shift: text('shift', { enum: ['day', 'night'] }).notNull(),
});

export const tickets = sqliteTable('support_tickets', {
  id: integer('id').primaryKey(),
  subject: text('subject').notNull(),
  status: text('status', { enum: ['open', 'pending', 'resolved', 'escalated'] }).notNull(),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).notNull(),
  channel: text('channel', { enum: ['email', 'chat', 'phone'] }).notNull(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  // Nullable so "no assignee" filters can match unassigned tickets.
  assigneeId: integer('assignee_id').references(() => assignees.id),
  slaBreached: integer('sla_breached', { mode: 'boolean' }).notNull().default(false),
  // Numeric column for the facets min/max range demo.
  reopenCount: integer('reopen_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  tickets: many(tickets),
}));

export const assigneesRelations = relations(assignees, ({ many }) => ({
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  customer: one(customers, {
    fields: [tickets.customerId],
    references: [customers.id],
  }),
  assignee: one(assignees, {
    fields: [tickets.assigneeId],
    references: [assignees.id],
  }),
}));

/**
 * Standalone, denormalized bulk dataset for the `big-board` virtualization
 * example (10k+ rows). Deliberately NOT joined to `customers`/`assignees` --
 * the point of this table is row COUNT and dynamic row height (an
 * expandable `description`), not relationship filtering (that's what
 * `tickets` is for); keeping it separate also means seeding 10k+ synthetic
 * rows here never changes the curated 20-ticket dataset the other three
 * examples describe and count on screen.
 */
export const bulkTickets = sqliteTable('support_tickets_bulk', {
  id: integer('id').primaryKey(),
  subject: text('subject').notNull(),
  status: text('status', { enum: ['open', 'pending', 'resolved', 'escalated'] }).notNull(),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).notNull(),
  customerName: text('customer_name').notNull(),
  assigneeName: text('assignee_name').notNull(),
  description: text('description').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const supportSchema = {
  customers,
  assignees,
  tickets,
  bulkTickets,
};

export const supportRelationsSchema = {
  customers: customersRelations,
  assignees: assigneesRelations,
  tickets: ticketsRelations,
};

export type SupportCustomer = typeof customers.$inferSelect;
export type SupportAssignee = typeof assignees.$inferSelect;
export type SupportTicket = typeof tickets.$inferSelect;
export type BulkTicket = typeof bulkTickets.$inferSelect;
