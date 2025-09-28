/**
 * Minimal Drizzle schema for migrated endpoints
 * Only includes tables needed for auth, billing, and simple operations
 */

import { pgTable, uuid, varchar, timestamp, jsonb, text } from 'drizzle-orm/pg-core';

// Organizations table (for billing operations)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  billing_email: varchar('billing_email', { length: 255 }),
  polar_customer_id: varchar('polar_customer_id', { length: 255 }),
  subscription_tier: varchar('subscription_tier', { length: 50 }),
  subscription_status: varchar('subscription_status', { length: 50 }),
  subscription_seats: varchar('subscription_seats', { length: 10 }),
  subscription_expires_at: timestamp('subscription_expires_at'),
  trial_ends_at: timestamp('trial_ends_at'),
  billing_cycle: varchar('billing_cycle', { length: 20 }),
  next_billing_date: timestamp('next_billing_date'),
  billing_settings: jsonb('billing_settings'),
  updated_at: timestamp('updated_at').defaultNow(),
  created_at: timestamp('created_at').defaultNow(),
});

// Organization members table (for permissions)
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey(),
  organization_id: uuid('organization_id').notNull(),
  user_id: uuid('user_id').notNull(),
  role: varchar('role', { length: 50 }).notNull(),
});

// Users table (for auth operations)
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type User = typeof users.$inferSelect;