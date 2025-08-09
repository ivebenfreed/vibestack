-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."client_migration_status_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."projects_status_enum" AS ENUM('active', 'in_progress', 'completed', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."tasks_legacy_status_enum" AS ENUM('open', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."tasks_priority_enum" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'member', 'viewer', 'super_admin');--> statement-breakpoint
CREATE TABLE "migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" bigint NOT NULL,
	"name" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" uuid,
	"content" text NOT NULL,
	"author_id" uuid,
	"parent_id" uuid,
	"task_id" uuid,
	"project_id" uuid
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"status" "projects_status_enum" DEFAULT 'active' NOT NULL,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" uuid,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" varchar(255),
	"role" "users_role_enum" DEFAULT 'member' NOT NULL,
	CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_e9f62f5dcb8a54b84234c9e7a06" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "local_changes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"table" text NOT NULL,
	"operation" text NOT NULL,
	"data" jsonb NOT NULL,
	"lsn" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"processed_sync" integer DEFAULT 0 NOT NULL,
	"clientSequence" text,
	"send_attempts" integer DEFAULT 0 NOT NULL,
	"last_send_attempt" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_migration" (
	"migration_name" text NOT NULL,
	"schema_version" text NOT NULL,
	"up_queries" text[] NOT NULL,
	"down_queries" text[] NOT NULL,
	"description" text,
	"timestamp" bigint NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_history" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lsn" text NOT NULL,
	"table_name" text NOT NULL,
	"operation" text NOT NULL,
	"data" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_metadata" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" text NOT NULL,
	"current_lsn" text DEFAULT '0/0' NOT NULL,
	"sync_state" text DEFAULT 'disconnected' NOT NULL,
	"last_sync_time" timestamp with time zone,
	"pending_changes_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"publicKey" text NOT NULL,
	"privateKey" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_migration_status" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"migration_name" text NOT NULL,
	"schema_version" text NOT NULL,
	"status" "client_migration_status_status_enum" NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" uuid,
	"title" varchar(100) NOT NULL,
	"description" text,
	"priority" "tasks_priority_enum" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"time_range" "tsrange",
	"estimated_duration" interval,
	"project_id" uuid,
	"assignee_id" uuid,
	"start_date" timestamp with time zone,
	"legacy_status" "tasks_legacy_status_enum" DEFAULT 'open',
	"status_id" uuid,
	"legacy_tags" text[] DEFAULT '{""}',
	"isArchived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "chk_task_start_date_before_due_date" CHECK ((start_date IS NULL) OR (due_date IS NULL) OR (start_date < due_date))
);
--> statement-breakpoint
CREATE TABLE "status_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(100) NOT NULL,
	"entityType" varchar(50) NOT NULL,
	"description" text,
	"isSystem" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"default_color" varchar(7),
	"display_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_definitions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_set_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"icon" varchar(50),
	"variant" varchar(20),
	"sort_order" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"allowed_transitions" uuid[],
	"auto_transition_days" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50),
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"default_color" varchar(7) DEFAULT '#94a3b8' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_exclusive" boolean DEFAULT false NOT NULL,
	"max_tags" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tag_set_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"color" varchar(7) NOT NULL,
	"icon" varchar(50),
	"variant" varchar(20) DEFAULT 'solid' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "UQ_b3aa10c29ea4e61a830362bd25a" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "PK_b3f491d3a3f986106d281d8eb4b" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"dependent_task_id" uuid NOT NULL,
	"dependency_task_id" uuid NOT NULL,
	CONSTRAINT "PK_71b0636f4fd9b1536100fc28e16" PRIMARY KEY("dependent_task_id","dependency_task_id")
);
--> statement-breakpoint
CREATE TABLE "project_status_sets" (
	"project_id" uuid NOT NULL,
	"status_set_id" uuid NOT NULL,
	CONSTRAINT "PK_df26f812b71c869d8a39cc39980" PRIMARY KEY("project_id","status_set_id")
);
--> statement-breakpoint
CREATE TABLE "project_tag_sets" (
	"project_id" uuid NOT NULL,
	"tag_set_id" uuid NOT NULL,
	CONSTRAINT "PK_e63ae6baa6ca7e4acee6f88a26f" PRIMARY KEY("project_id","tag_set_id")
);
--> statement-breakpoint
CREATE TABLE "task_tags" (
	"task_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "PK_a7354e3c3f630636f6e4a29694a" PRIMARY KEY("task_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "FK_e6d38899c31997c45d128a8973b" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "FK_d6f93329801a93536da4241e386" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "FK_18c2493067c11f44efb35ca0e03" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "FK_03dbde2ff570596e874bb3bb311" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "FK_b1bd2fbf5d0ef67319c91acb5cf" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "FK_3000dad1da61b29953f07476324" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "FK_9eecdb5b1ed8c7c2a1b392c28d4" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "FK_855d484825b715c545349212c7f" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "FK_e28288969fa7827bd12680cfe10" FOREIGN KEY ("status_id") REFERENCES "public"."status_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_definitions" ADD CONSTRAINT "FK_7bb8172ef1f90ff91d0c86d23ba" FOREIGN KEY ("status_set_id") REFERENCES "public"."status_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "FK_1b9d2591f78033221d6b7c726b6" FOREIGN KEY ("tag_set_id") REFERENCES "public"."tag_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "FK_bd19ddcde86ca1882599dbace11" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "FK_b5729113570c20c7e214cf3f58d" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_edffc2045be39cc292fe4abedde" FOREIGN KEY ("dependent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_ba14d140f4b3a79b3b1f475de57" FOREIGN KEY ("dependency_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_sets" ADD CONSTRAINT "FK_f3ca6851fd53ff904e9ce214681" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_status_sets" ADD CONSTRAINT "FK_968a062c0e1a4d13e351c522ba4" FOREIGN KEY ("status_set_id") REFERENCES "public"."status_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag_sets" ADD CONSTRAINT "FK_cb354bb259bbd85f63d7e120eb8" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_tag_sets" ADD CONSTRAINT "FK_c558e4e6f9e753f369582865c4b" FOREIGN KEY ("tag_set_id") REFERENCES "public"."tag_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "FK_70515bc464901781ac60b82a1ea" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "FK_f883135d033e1541f6a81972e7d" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_e9a1987ae0b1a690d834926fe8" ON "local_changes" USING btree ("processed_sync" int4_ops);--> statement-breakpoint
CREATE INDEX "IDX_bfd1577edbebf606d654aca741" ON "client_migration" USING btree ("schema_version" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_97c51ed35fb20c52eb27af19c7" ON "change_history" USING btree ("lsn" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_f6a012ebab7ea3ff10fa8f3c58" ON "client_migration_status" USING btree ("schema_version" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_b5729113570c20c7e214cf3f58" ON "project_members" USING btree ("project_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_e89aae80e010c2faa72e6a49ce" ON "project_members" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_ba14d140f4b3a79b3b1f475de5" ON "task_dependencies" USING btree ("dependency_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_edffc2045be39cc292fe4abedd" ON "task_dependencies" USING btree ("dependent_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_968a062c0e1a4d13e351c522ba" ON "project_status_sets" USING btree ("status_set_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_f3ca6851fd53ff904e9ce21468" ON "project_status_sets" USING btree ("project_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_c558e4e6f9e753f369582865c4" ON "project_tag_sets" USING btree ("tag_set_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_cb354bb259bbd85f63d7e120eb" ON "project_tag_sets" USING btree ("project_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_70515bc464901781ac60b82a1e" ON "task_tags" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_f883135d033e1541f6a81972e7" ON "task_tags" USING btree ("tag_id" uuid_ops);
*/