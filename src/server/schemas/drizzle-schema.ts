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

  // Platform feature flags controlled by SaaS admin
  enabled_features: jsonb('enabled_features').default('{"universe_mode": true}'),
  feature_overrides: jsonb('feature_overrides'),

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

// Platform feature flags table for global feature management
export const platformFeatureFlags = pgTable('platform_feature_flags', {
  id: uuid('id').primaryKey(),
  feature_key: varchar('feature_key', { length: 100 }).notNull().unique(),
  description: text('description'),
  default_enabled: varchar('default_enabled', { length: 10 }).default('false'),
  rollout_percentage: varchar('rollout_percentage', { length: 10 }).default('0'),
  target_plans: jsonb('target_plans').default('["pro", "enterprise"]'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// Admin audit log for platform actions
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey(),
  admin_user_id: uuid('admin_user_id').notNull(),
  admin_email: varchar('admin_email', { length: 255 }).notNull(),
  admin_role: varchar('admin_role', { length: 50 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  resource_type: varchar('resource_type', { length: 50 }),
  resource_id: varchar('resource_id', { length: 255 }),
  details: jsonb('details'),
  ip_address: varchar('ip_address', { length: 45 }),
  user_agent: text('user_agent'),
  status: varchar('status', { length: 20 }).default('success'),
  created_at: timestamp('created_at').defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type User = typeof users.$inferSelect;
export type PlatformFeatureFlag = typeof platformFeatureFlags.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;