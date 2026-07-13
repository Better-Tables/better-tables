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
  assigneeId: integer('assignee_id')
    .notNull()
    .references(() => assignees.id),
  slaBreached: integer('sla_breached', { mode: 'boolean' }).notNull().default(false),
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

export const supportSchema = {
  customers,
  assignees,
  tickets,
};

export const supportRelationsSchema = {
  customers: customersRelations,
  assignees: assigneesRelations,
  tickets: ticketsRelations,
};

export type SupportCustomer = typeof customers.$inferSelect;
export type SupportAssignee = typeof assignees.$inferSelect;
export type SupportTicket = typeof tickets.$inferSelect;

export type TicketWithRelations = SupportTicket & {
  customer?: SupportCustomer | null;
  assignee?: SupportAssignee | null;
};
