-- Script to merge unique local data to remote database
-- This script exports unique records from local and inserts them into remote

-- First, check and insert unique projects
INSERT INTO projects (id, client_id, created_at, updated_at, name, description, status, owner_id)
SELECT id, client_id, created_at, updated_at, name, description, status, owner_id 
FROM projects_local
WHERE id NOT IN (SELECT id FROM projects)
ON CONFLICT (id) DO NOTHING;

-- Insert unique tasks
INSERT INTO tasks (id, client_id, created_at, updated_at, title, description, legacy_status, priority, due_date, start_date, completed_at, time_range, estimated_duration, legacy_tags, project_id, assignee_id)
SELECT id, client_id, created_at, updated_at, title, description, legacy_status, priority, due_date, start_date, completed_at, time_range, estimated_duration, legacy_tags, project_id, assignee_id
FROM tasks_local  
WHERE id NOT IN (SELECT id FROM tasks)
ON CONFLICT (id) DO NOTHING;

-- Insert unique comments
INSERT INTO comments (id, client_id, created_at, updated_at, content, tasks_id, authors_id)
SELECT id, client_id, created_at, updated_at, content, task_id, author_id
FROM comments_local
WHERE id NOT IN (SELECT id FROM comments)
ON CONFLICT (id) DO NOTHING;

-- Insert unique tags
INSERT INTO tags (id, client_id, created_at, updated_at, name, slug, color, icon, variant, sort_order, is_active, usage_count, last_used_at, metadata, tag_set_id, parent_id)
SELECT id, client_id, created_at, updated_at, name, slug, color, icon, variant, sort_order, is_active, usage_count, last_used_at, metadata, tag_set_id, parent_id
FROM tags_local
WHERE id NOT IN (SELECT id FROM tags)
ON CONFLICT (id) DO NOTHING;

-- Insert unique tag_sets
INSERT INTO tag_sets (id, client_id, created_at, updated_at, name, description, category, is_system, is_active, default_color, display_order, is_exclusive, max_tags, metadata)
SELECT id, client_id, created_at, updated_at, name, description, category, is_system, is_active, default_color, display_order, is_exclusive, max_tags, metadata
FROM tag_sets_local
WHERE id NOT IN (SELECT id FROM tag_sets)
ON CONFLICT (id) DO NOTHING;

-- Insert unique users (be careful with auth-related fields)
INSERT INTO users (id, created_at, updated_at, name, email, email_verified, image, is_super_admin, accounts_id)
SELECT id, created_at, updated_at, name, email, email_verified, image, is_super_admin, NULL
FROM users_local
WHERE id NOT IN (SELECT id FROM users)
ON CONFLICT (id) DO NOTHING;