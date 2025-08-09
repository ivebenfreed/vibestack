import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Dexie Schema Generation', () => {
  const schemaPath = path.join(__dirname, '../generated/dexie-schema.ts');
  let schemaContent: string;

  beforeAll(() => {
    // Read the generated schema (it should already exist)
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  });

  it('should generate a valid Dexie schema file', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(schemaContent).toBeTruthy();
  });

  it('should include the correct version number', () => {
    const versionMatch = schemaContent.match(/Current Version:\s*(\d+)/);
    expect(versionMatch).toBeTruthy();
    const version = parseInt(versionMatch![1] || '0');
    expect(version).toBeGreaterThan(0);
  });

  it('should include all client entities', () => {
    const expectedTables = [
      'comments',
      'projects', 
      'status_definitions',
      'status_sets',
      'tags',
      'tag_sets',
      'tasks',
      'users',
      'client_migration_status',
      'local_changes',
      'sync_metadata'
    ];

    for (const table of expectedTables) {
      expect(schemaContent).toContain(`${table}:`);
    }
  });

  it('should include junction tables for many-to-many relationships', () => {
    const expectedJunctionTables = [
      'task_tags',
      'task_dependencies',
      'project_members',
      'project_status_sets',
      'project_tag_sets'
    ];

    for (const table of expectedJunctionTables) {
      expect(schemaContent).toContain(`${table}:`);
    }
  });

  it('should detect and include the processedSync index for local_changes', () => {
    // Check that local_changes has the processedSync index in version 7
    const version7Match = schemaContent.match(/this\.version\(7\)\.stores\(\{[^}]+\}\)/s);
    expect(version7Match).toBeTruthy();
    const version7Stores = version7Match![0];
    const localChangesMatch = version7Stores.match(/local_changes:\s*'([^']+)'/);
    expect(localChangesMatch).toBeTruthy();
    const localChangesIndexes = localChangesMatch![1];
    expect(localChangesIndexes).toContain('processedSync');
  });

  it('should include proper compound indexes for junction tables', () => {
    // Check task_tags has compound index
    const taskTagsMatch = schemaContent.match(/task_tags:\s*'([^']+)'/);
    expect(taskTagsMatch).toBeTruthy();
    const taskTagsIndexes = taskTagsMatch![1];
    expect(taskTagsIndexes).toContain('[taskId+tagId]');
    expect(taskTagsIndexes).toContain('taskId');
    expect(taskTagsIndexes).toContain('tagId');
  });

  it('should generate TypeScript types for all entities', () => {
    expect(schemaContent).toContain('Comment, LocalChanges, Project');
    expect(schemaContent).toContain('StatusDefinition, StatusSet');
    expect(schemaContent).toContain('Tag, TagSet, Task, User');
    expect(schemaContent).toContain('from \'../client-entities.js\'');
  });

  it('should export the VibeStackDB class', () => {
    expect(schemaContent).toContain('export class VibeStackDB extends Dexie');
    expect(schemaContent).toContain('comments!: Table<Comment>');
    expect(schemaContent).toContain('projects!: Table<Project>');
  });

  it('should handle schema versioning correctly', () => {
    // Check that version history is being tracked
    const versionHistoryPath = path.join(__dirname, '../../dexie-version-history.json');
    if (fs.existsSync(versionHistoryPath)) {
      const versionHistory = JSON.parse(fs.readFileSync(versionHistoryPath, 'utf-8'));
      expect(versionHistory).toHaveProperty('currentVersion');
      expect(versionHistory).toHaveProperty('versions');
      expect(Array.isArray(versionHistory.versions)).toBe(true);
    }
  });
});