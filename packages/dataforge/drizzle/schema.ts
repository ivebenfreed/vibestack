import { pgTable, serial, bigint, varchar, foreignKey, uuid, timestamp, text, unique, boolean, index, jsonb, integer, check, interval, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const clientMigrationStatusStatusEnum = pgEnum("client_migration_status_status_enum", ['pending', 'in_progress', 'completed', 'failed', 'rolled_back'])
export const projectsStatusEnum = pgEnum("projects_status_enum", ['active', 'in_progress', 'completed', 'on_hold'])
export const tasksLegacyStatusEnum = pgEnum("tasks_legacy_status_enum", ['open', 'in_progress', 'completed'])
export const tasksPriorityEnum = pgEnum("tasks_priority_enum", ['low', 'medium', 'high'])
export const usersRoleEnum = pgEnum("users_role_enum", ['admin', 'member', 'viewer', 'super_admin'])


export const migrations = pgTable("migrations", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timestamp: bigint({ mode: "number" }).notNull(),
	name: varchar().notNull(),
});

export const comments = pgTable("comments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	clientId: uuid("client_id"),
	content: text().notNull(),
	authorId: uuid("author_id"),
	parentId: uuid("parent_id"),
	taskId: uuid("task_id"),
	projectId: uuid("project_id"),
}, (table) => [
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "FK_e6d38899c31997c45d128a8973b"
		}),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "FK_d6f93329801a93536da4241e386"
		}),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "FK_18c2493067c11f44efb35ca0e03"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "FK_03dbde2ff570596e874bb3bb311"
		}),
]);

export const projects = pgTable("projects", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	clientId: uuid("client_id"),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	status: projectsStatusEnum().default('active').notNull(),
	ownerId: uuid("owner_id"),
}, (table) => [
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "FK_b1bd2fbf5d0ef67319c91acb5cf"
		}),
]);

export const users = pgTable("users", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	clientId: uuid("client_id"),
	name: varchar({ length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: varchar({ length: 255 }),
	role: usersRoleEnum().default('member').notNull(),
}, (table) => [
	unique("UQ_97672ac88f789774dd47f7c8be3").on(table.email),
]);

export const sessions = pgTable("sessions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "FK_085d540d9f418cfbdc7bd55bb19"
		}),
	unique("UQ_e9f62f5dcb8a54b84234c9e7a06").on(table.token),
]);

export const localChanges = pgTable("local_changes", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	table: text().notNull(),
	operation: text().notNull(),
	data: jsonb().notNull(),
	lsn: text().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
	processedSync: integer("processed_sync").default(0).notNull(),
	clientSequence: text(),
	sendAttempts: integer("send_attempts").default(0).notNull(),
	lastSendAttempt: timestamp("last_send_attempt", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
}, (table) => [
	index("IDX_e9a1987ae0b1a690d834926fe8").using("btree", table.processedSync.asc().nullsLast().op("int4_ops")),
]);

export const accounts = pgTable("accounts", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: 'string' }),
	scope: text(),
	password: text(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "FK_3000dad1da61b29953f07476324"
		}),
]);

export const verifications = pgTable("verifications", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const clientMigration = pgTable("client_migration", {
	migrationName: text("migration_name").notNull(),
	schemaVersion: text("schema_version").notNull(),
	upQueries: text("up_queries").array().notNull(),
	downQueries: text("down_queries").array().notNull(),
	description: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timestamp: bigint({ mode: "number" }).notNull(),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("IDX_bfd1577edbebf606d654aca741").using("btree", table.schemaVersion.asc().nullsLast().op("text_ops")),
]);

export const changeHistory = pgTable("change_history", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	lsn: text().notNull(),
	tableName: text("table_name").notNull(),
	operation: text().notNull(),
	data: jsonb(),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("IDX_97c51ed35fb20c52eb27af19c7").using("btree", table.lsn.asc().nullsLast().op("text_ops")),
]);

export const syncMetadata = pgTable("sync_metadata", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	clientId: text("client_id").notNull(),
	currentLsn: text("current_lsn").default('0/0').notNull(),
	syncState: text("sync_state").default('disconnected').notNull(),
	lastSyncTime: timestamp("last_sync_time", { withTimezone: true, mode: 'string' }),
	pendingChangesCount: integer("pending_changes_count").default(0).notNull(),
});

export const jwks = pgTable("jwks", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	publicKey: text().notNull(),
	privateKey: text().notNull(),
});

export const clientMigrationStatus = pgTable("client_migration_status", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	migrationName: text("migration_name").notNull(),
	schemaVersion: text("schema_version").notNull(),
	status: clientMigrationStatusStatusEnum().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	errorMessage: text("error_message"),
	attempts: integer().default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timestamp: bigint({ mode: "number" }).notNull(),
}, (table) => [
	index("IDX_f6a012ebab7ea3ff10fa8f3c58").using("btree", table.schemaVersion.asc().nullsLast().op("text_ops")),
]);

export const tasks = pgTable("tasks", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	clientId: uuid("client_id"),
	title: varchar({ length: 100 }).notNull(),
	description: text(),
	priority: tasksPriorityEnum().default('medium').notNull(),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	// TODO: failed to parse database type 'tsrange'
	// timeRange: unknown("time_range"),
	estimatedDuration: interval("estimated_duration"),
	projectId: uuid("project_id"),
	assigneeId: uuid("assignee_id"),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
	legacyStatus: tasksLegacyStatusEnum("legacy_status").default('open'),
	statusId: uuid("status_id"),
	legacyTags: text("legacy_tags").array().default([""]),
	isArchived: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "FK_9eecdb5b1ed8c7c2a1b392c28d4"
		}),
	foreignKey({
			columns: [table.assigneeId],
			foreignColumns: [users.id],
			name: "FK_855d484825b715c545349212c7f"
		}),
	foreignKey({
			columns: [table.statusId],
			foreignColumns: [statusDefinitions.id],
			name: "FK_e28288969fa7827bd12680cfe10"
		}),
	check("chk_task_start_date_before_due_date", sql`(start_date IS NULL) OR (due_date IS NULL) OR (start_date < due_date)`),
]);

export const statusSets = pgTable("status_sets", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	clientId: uuid("client_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: varchar({ length: 100 }).notNull(),
	entityType: varchar({ length: 50 }).notNull(),
	description: text(),
	isSystem: boolean().default(false).notNull(),
	isActive: boolean().default(true).notNull(),
	defaultColor: varchar("default_color", { length: 7 }),
	displayOrder: integer("display_order").default(0).notNull(),
	metadata: jsonb().default({}).notNull(),
});

export const statusDefinitions = pgTable("status_definitions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	clientId: uuid("client_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	statusSetId: uuid("status_set_id").notNull(),
	name: varchar({ length: 50 }).notNull(),
	label: varchar({ length: 100 }).notNull(),
	color: varchar({ length: 7 }).notNull(),
	icon: varchar({ length: 50 }),
	variant: varchar({ length: 20 }),
	sortOrder: integer("sort_order").notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	isFinal: boolean("is_final").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	allowedTransitions: uuid("allowed_transitions").array(),
	autoTransitionDays: integer("auto_transition_days"),
	metadata: jsonb().default({}).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.statusSetId],
			foreignColumns: [statusSets.id],
			name: "FK_7bb8172ef1f90ff91d0c86d23ba"
		}),
]);

export const tagSets = pgTable("tag_sets", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	clientId: uuid("client_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	category: varchar({ length: 50 }),
	isSystem: boolean("is_system").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	defaultColor: varchar("default_color", { length: 7 }).default('#94a3b8').notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	isExclusive: boolean("is_exclusive").default(false).notNull(),
	maxTags: integer("max_tags"),
	metadata: jsonb().default({}).notNull(),
});

export const tags = pgTable("tags", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	clientId: uuid("client_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tagSetId: uuid("tag_set_id").notNull(),
	name: varchar({ length: 50 }).notNull(),
	slug: varchar({ length: 50 }).notNull(),
	color: varchar({ length: 7 }).notNull(),
	icon: varchar({ length: 50 }),
	variant: varchar({ length: 20 }).default('solid').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	parentId: uuid("parent_id"),
	isActive: boolean("is_active").default(true).notNull(),
	usageCount: integer("usage_count").default(0).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tagSetId],
			foreignColumns: [tagSets.id],
			name: "FK_1b9d2591f78033221d6b7c726b6"
		}),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "FK_bd19ddcde86ca1882599dbace11"
		}),
	unique("UQ_b3aa10c29ea4e61a830362bd25a").on(table.slug),
]);

export const projectMembers = pgTable("project_members", {
	projectId: uuid("project_id").notNull(),
	userId: uuid("user_id").notNull(),
}, (table) => [
	index("IDX_b5729113570c20c7e214cf3f58").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("IDX_e89aae80e010c2faa72e6a49ce").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "FK_b5729113570c20c7e214cf3f58d"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "FK_e89aae80e010c2faa72e6a49ce8"
		}),
	primaryKey({ columns: [table.projectId, table.userId], name: "PK_b3f491d3a3f986106d281d8eb4b"}),
]);

export const taskDependencies = pgTable("task_dependencies", {
	dependentTaskId: uuid("dependent_task_id").notNull(),
	dependencyTaskId: uuid("dependency_task_id").notNull(),
}, (table) => [
	index("IDX_ba14d140f4b3a79b3b1f475de5").using("btree", table.dependencyTaskId.asc().nullsLast().op("uuid_ops")),
	index("IDX_edffc2045be39cc292fe4abedd").using("btree", table.dependentTaskId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.dependentTaskId],
			foreignColumns: [tasks.id],
			name: "FK_edffc2045be39cc292fe4abedde"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.dependencyTaskId],
			foreignColumns: [tasks.id],
			name: "FK_ba14d140f4b3a79b3b1f475de57"
		}),
	primaryKey({ columns: [table.dependentTaskId, table.dependencyTaskId], name: "PK_71b0636f4fd9b1536100fc28e16"}),
]);

export const projectStatusSets = pgTable("project_status_sets", {
	projectId: uuid("project_id").notNull(),
	statusSetId: uuid("status_set_id").notNull(),
}, (table) => [
	index("IDX_968a062c0e1a4d13e351c522ba").using("btree", table.statusSetId.asc().nullsLast().op("uuid_ops")),
	index("IDX_f3ca6851fd53ff904e9ce21468").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "FK_f3ca6851fd53ff904e9ce214681"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.statusSetId],
			foreignColumns: [statusSets.id],
			name: "FK_968a062c0e1a4d13e351c522ba4"
		}),
	primaryKey({ columns: [table.projectId, table.statusSetId], name: "PK_df26f812b71c869d8a39cc39980"}),
]);

export const projectTagSets = pgTable("project_tag_sets", {
	projectId: uuid("project_id").notNull(),
	tagSetId: uuid("tag_set_id").notNull(),
}, (table) => [
	index("IDX_c558e4e6f9e753f369582865c4").using("btree", table.tagSetId.asc().nullsLast().op("uuid_ops")),
	index("IDX_cb354bb259bbd85f63d7e120eb").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "FK_cb354bb259bbd85f63d7e120eb8"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.tagSetId],
			foreignColumns: [tagSets.id],
			name: "FK_c558e4e6f9e753f369582865c4b"
		}),
	primaryKey({ columns: [table.projectId, table.tagSetId], name: "PK_e63ae6baa6ca7e4acee6f88a26f"}),
]);

export const taskTags = pgTable("task_tags", {
	taskId: uuid("task_id").notNull(),
	tagId: uuid("tag_id").notNull(),
}, (table) => [
	index("IDX_70515bc464901781ac60b82a1e").using("btree", table.taskId.asc().nullsLast().op("uuid_ops")),
	index("IDX_f883135d033e1541f6a81972e7").using("btree", table.tagId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "FK_70515bc464901781ac60b82a1ea"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "FK_f883135d033e1541f6a81972e7d"
		}),
	primaryKey({ columns: [table.taskId, table.tagId], name: "PK_a7354e3c3f630636f6e4a29694a"}),
]);
