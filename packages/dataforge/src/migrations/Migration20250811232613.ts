import { Migration } from '@mikro-orm/migrations';

export class Migration20250811232613 extends Migration {

  override async up(): Promise<void> {
    // Create enum types
    this.addSql(`create type "projects_status_enum" as enum ('active', 'archived', 'deleted');`);
    this.addSql(`create type "tasks_priority_enum" as enum ('low', 'medium', 'high', 'urgent');`);
    this.addSql(`create type "tasks_legacy_status_enum" as enum ('todo', 'in_progress', 'done', 'cancelled');`);
    
    this.addSql(`create table "accounts" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "provider_id" varchar(255) not null, "provider_account_id" varchar(255) not null, "refresh_token" varchar(255) null, "access_token" varchar(255) null, "expires_at" bigint null, "token_type" varchar(255) null, "scope" varchar(255) null, "id_token" varchar(255) null, "session_state" varchar(255) null, constraint "accounts_pkey" primary key ("id"));`);
    this.addSql(`comment on table "accounts" is 'context:server-only | category:auth';`);

    this.addSql(`create table "change_history" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "lsn" text not null, "table_name" text not null, "operation" text not null, "data" jsonb null, "timestamp" date not null, constraint "change_history_pkey" primary key ("id"));`);
    this.addSql(`comment on table "change_history" is 'context:server-only | category:system';`);
    this.addSql(`create index "change_history_table_name_timestamp_index" on "change_history" ("table_name", "timestamp");`);
    this.addSql(`create index "change_history_lsn_index" on "change_history" ("lsn");`);

    this.addSql(`create table "entity_dependencies" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "from_table" varchar(255) not null, "from_id" varchar(255) not null, "to_table" varchar(255) not null, "to_id" varchar(255) not null, "dependency_type" varchar(255) not null, "metadata" jsonb null, constraint "entity_dependencies_pkey" primary key ("id"));`);
    this.addSql(`create index "entity_dependencies_to_table_to_id_index" on "entity_dependencies" ("to_table", "to_id");`);
    this.addSql(`create index "entity_dependencies_from_table_from_id_index" on "entity_dependencies" ("from_table", "from_id");`);
    this.addSql(`alter table "entity_dependencies" add constraint "entity_dependencies_from_table_from_id_to_table_t_8b0cf_unique" unique ("from_table", "from_id", "to_table", "to_id", "dependency_type");`);

    this.addSql(`create table "local_changes" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "table" varchar(255) not null, "record_id" varchar(255) not null, "operation" varchar(255) not null, "data" jsonb not null, "lsn" varchar(255) null, "client_sequence" varchar(255) null, "processed_sync" int not null default 0, "send_attempts" int not null default 0, "last_send_attempt" date null, "last_error" varchar(255) null, constraint "local_changes_pkey" primary key ("id"));`);
    this.addSql(`comment on table "local_changes" is 'context:client-only | category:system';`);
    this.addSql(`create index "local_changes_table_index" on "local_changes" ("table");`);
    this.addSql(`create index "local_changes_processed_sync_index" on "local_changes" ("processed_sync");`);
    this.addSql(`create index "local_changes_table_record_id_index" on "local_changes" ("table", "record_id");`);

    this.addSql(`create table "sessions" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "session_token" varchar(255) not null, "expires_at" timestamptz not null, "account_id" uuid not null, constraint "sessions_pkey" primary key ("id"));`);
    this.addSql(`comment on table "sessions" is 'context:server-only | category:auth';`);

    this.addSql(`create table "status_set" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "client_id" uuid null, "name" varchar(100) not null, "description" text null, "entity_type" varchar(50) not null, "is_default" boolean not null default false, "is_active" boolean not null default true, "is_system" boolean not null default false, "workflow" jsonb not null default '{}', "metadata" jsonb not null default '{}', constraint "status_set_pkey" primary key ("id"));`);
    this.addSql(`create index "status_set_entity_type_index" on "status_set" ("entity_type");`);

    this.addSql(`create table "status_definition" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "client_id" uuid null, "name" varchar(50) not null, "label" varchar(100) not null, "color" varchar(7) not null, "icon" varchar(50) null, "variant" varchar(20) null, "sort_order" int not null, "is_default" boolean not null default false, "is_final" boolean not null default false, "is_active" boolean not null default true, "allowed_transitions" text[] null, "auto_transition_days" int null, "metadata" jsonb not null default '{}', "status_set_id" uuid not null, constraint "status_definition_pkey" primary key ("id"));`);
    this.addSql(`create index "status_definition_name_index" on "status_definition" ("name");`);
    this.addSql(`create index "status_definition_status_set_id_sort_order_index" on "status_definition" ("status_set_id", "sort_order");`);

    this.addSql(`create table "tag_set" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "client_id" uuid null, "name" varchar(100) not null, "description" text null, "category" varchar(50) null, "is_system" boolean not null default false, "is_active" boolean not null default true, "default_color" varchar(7) not null default '#94a3b8', "display_order" int not null default 0, "is_exclusive" boolean not null default false, "max_tags" int null, "metadata" jsonb not null default '{}', constraint "tag_set_pkey" primary key ("id"));`);
    this.addSql(`create index "tag_set_display_order_index" on "tag_set" ("display_order");`);

    this.addSql(`create table "tag" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "client_id" uuid null, "name" varchar(50) not null, "slug" varchar(50) not null, "color" varchar(7) not null, "icon" varchar(50) null, "variant" varchar(20) not null default 'solid', "sort_order" int not null default 0, "is_active" boolean not null default true, "usage_count" int not null default 0, "last_used_at" date null, "metadata" jsonb not null default '{}', "tag_set_id" uuid not null, "parent_id" uuid null, constraint "tag_pkey" primary key ("id"));`);
    this.addSql(`alter table "tag" add constraint "tag_slug_unique" unique ("slug");`);
    this.addSql(`create index "tag_tag_set_id_sort_order_index" on "tag" ("tag_set_id", "sort_order");`);
    this.addSql(`create index "tag_slug_index" on "tag" ("slug");`);

    this.addSql(`create table "users" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "name" varchar(255) not null, "email" varchar(255) null, "email_verified" boolean not null default false, "image" varchar(255) null, "is_super_admin" boolean not null default false, "account_id" uuid null, constraint "users_pkey" primary key ("id"));`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(`create table "projects" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "client_id" uuid null, "name" varchar(255) not null, "description" text null, "status" projects_status_enum not null default 'active', "owner_id" uuid null, constraint "projects_pkey" primary key ("id"));`);

    this.addSql(`create table "tasks" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "client_id" uuid null, "title" varchar(255) not null, "description" text null, "legacy_status" tasks_legacy_status_enum null, "priority" tasks_priority_enum not null default 'medium', "due_date" date null, "start_date" date null, "completed_at" date null, "time_range" tsrange null, "estimated_duration" interval null, "legacy_tags" text[] null, "project_id" uuid null, "assignee_id" uuid null, constraint "tasks_pkey" primary key ("id"), constraint tasks_check check (start_date IS NULL OR due_date IS NULL OR start_date <= due_date));`);

    this.addSql(`create table "task_tags" ("task_id" uuid not null, "tag_id" uuid not null, constraint "task_tags_pkey" primary key ("task_id", "tag_id"));`);

    this.addSql(`create table "project_tag_sets" ("project_id" uuid not null, "tag_set_id" uuid not null, constraint "project_tag_sets_pkey" primary key ("project_id", "tag_set_id"));`);

    this.addSql(`create table "project_status_sets" ("project_id" uuid not null, "status_set_id" uuid not null, constraint "project_status_sets_pkey" primary key ("project_id", "status_set_id"));`);

    this.addSql(`create table "comments" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "client_id" uuid null, "content" text not null, "task_id" uuid not null, "author_id" uuid null, constraint "comments_pkey" primary key ("id"));`);

    this.addSql(`create table "verifications" ("id" uuid not null default gen_random_uuid(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "identifier" text not null, "value" text not null, "expires_at" date not null, constraint "verifications_pkey" primary key ("id"));`);
    this.addSql(`comment on table "verifications" is 'context:server-only | category:auth';`);

    this.addSql(`alter table "sessions" add constraint "sessions_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade;`);

    this.addSql(`alter table "status_definition" add constraint "status_definition_status_set_id_foreign" foreign key ("status_set_id") references "status_set" ("id") on update cascade;`);

    this.addSql(`alter table "tag" add constraint "tag_tag_set_id_foreign" foreign key ("tag_set_id") references "tag_set" ("id") on update cascade;`);
    this.addSql(`alter table "tag" add constraint "tag_parent_id_foreign" foreign key ("parent_id") references "tag" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "users" add constraint "users_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "projects" add constraint "projects_owner_id_foreign" foreign key ("owner_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "tasks" add constraint "tasks_project_id_foreign" foreign key ("project_id") references "projects" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "tasks" add constraint "tasks_assignee_id_foreign" foreign key ("assignee_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "task_tags" add constraint "task_tags_task_id_foreign" foreign key ("task_id") references "tasks" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "task_tags" add constraint "task_tags_tag_id_foreign" foreign key ("tag_id") references "tag" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "project_tag_sets" add constraint "project_tag_sets_project_id_foreign" foreign key ("project_id") references "projects" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "project_tag_sets" add constraint "project_tag_sets_tag_set_id_foreign" foreign key ("tag_set_id") references "tag_set" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "project_status_sets" add constraint "project_status_sets_project_id_foreign" foreign key ("project_id") references "projects" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "project_status_sets" add constraint "project_status_sets_status_set_id_foreign" foreign key ("status_set_id") references "status_set" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "comments" add constraint "comments_task_id_foreign" foreign key ("task_id") references "tasks" ("id") on update cascade;`);
    this.addSql(`alter table "comments" add constraint "comments_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade on delete set null;`);
  }

}
