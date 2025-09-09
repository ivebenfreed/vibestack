#!/usr/bin/env tsx
/**
 * Comprehensive Options and Relationship System Seeding
 * 
 * This script seeds:
 * 1. System options for all archetypes (global)
 * 2. Custom options for Wide Corp organization
 * 3. Relationship configurations for all entities  
 * 4. Sample relationship data with rich properties
 * 5. Realistic business scenarios demonstrating the full system
 */

import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const devVarsPath = path.resolve(__dirname, '../apps/worker/.dev.vars');
const devVars = fs.readFileSync(devVarsPath, 'utf-8');
devVars.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key] = value;
  }
});

const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

// Create Kysely instance
const connectionString = 'postgresql://postgres:postgres@localhost:5432/vibestack_dev';
const kysely = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString,
      max: 10
    })
  })
});

async function seedOptionsAndRelationships() {
  console.log('🌱 Starting comprehensive options and relationship seeding...\n');

  try {
    // ========================================================================
    // PART 1: SYSTEM OPTIONS (Global - Available to All Organizations)
    // ========================================================================
    
    console.log('📋 Seeding System Options...');
    
    // Clear existing system options
    await kysely.deleteFrom('system_options').execute();
    await kysely.deleteFrom('system_option_sets').execute();
    
    // Create system option sets for each archetype
    const systemOptionSets = [
      // Task Archetype Options
      { option_set_type: 'priority', archetype: 'task', name: 'Task Priority Levels', description: 'Priority levels for task management' },
      { option_set_type: 'status', archetype: 'task', name: 'Task Status Values', description: 'Status workflow for tasks' },
      { option_set_type: 'category', archetype: 'task', name: 'Task Categories', description: 'Types of work items' },
      { option_set_type: 'complexity', archetype: 'task', name: 'Task Complexity', description: 'Complexity estimation levels' },
      
      // Project Archetype Options  
      { option_set_type: 'priority', archetype: 'project', name: 'Project Priority Levels', description: 'Priority levels for project management' },
      { option_set_type: 'status', archetype: 'project', name: 'Project Status Values', description: 'Project lifecycle status' },
      { option_set_type: 'category', archetype: 'project', name: 'Project Categories', description: 'Types of projects' },
      { option_set_type: 'phase', archetype: 'project', name: 'Project Phases', description: 'Standard project phases' },
      
      // Record Archetype Options
      { option_set_type: 'priority', archetype: 'record', name: 'Record Priority Levels', description: 'Priority levels for records' },
      { option_set_type: 'status', archetype: 'record', name: 'Record Status Values', description: 'Record lifecycle status' },
      { option_set_type: 'category', archetype: 'record', name: 'Record Categories', description: 'Types of records' },
      
      // Document Archetype Options
      { option_set_type: 'category', archetype: 'document', name: 'Document Categories', description: 'Document classification' },
      { option_set_type: 'status', archetype: 'document', name: 'Document Status Values', description: 'Document workflow status' },
      { option_set_type: 'access_level', archetype: 'document', name: 'Document Access Levels', description: 'Document security classification' },
      
      // File Archetype Options
      { option_set_type: 'category', archetype: 'file', name: 'File Categories', description: 'File type categories' },
      { option_set_type: 'access_level', archetype: 'file', name: 'File Access Levels', description: 'File security classification' },
      
      // Activity Archetype Options
      { option_set_type: 'category', archetype: 'activity', name: 'Activity Categories', description: 'Types of activities' },
      
      // Discussion Archetype Options
      { option_set_type: 'category', archetype: 'discussion', name: 'Discussion Categories', description: 'Discussion topic categories' },
      { option_set_type: 'status', archetype: 'discussion', name: 'Discussion Status Values', description: 'Discussion state management' },
      
      // Collection Archetype Options
      { option_set_type: 'category', archetype: 'collection', name: 'Collection Categories', description: 'Collection type categories' },
      { option_set_type: 'access_level', archetype: 'collection', name: 'Collection Access Levels', description: 'Collection visibility levels' }
    ];
    
    // Insert system option sets
    const insertedSets: any[] = [];
    for (const set of systemOptionSets) {
      const result = await kysely
        .insertInto('system_option_sets')
        .values({
          id: uuidv4(),
          ...set,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning(['id', 'option_set_type', 'archetype'])
        .execute();
      insertedSets.push(result[0]);
    }
    
    console.log(`  ✅ Created ${insertedSets.length} system option sets`);

    // Define system options for each set
    const systemOptions = [
      // Task Priority Options (Universal)
      { set_key: 'priority_task', options: [
        { value: 'low', label: 'Low Priority', color: '#10B981', icon: 'chevron-down', sort_order: 1, description: 'Can be done when time permits' },
        { value: 'medium', label: 'Medium Priority', color: '#F59E0B', icon: 'minus', sort_order: 2, description: 'Normal priority work item' },
        { value: 'high', label: 'High Priority', color: '#EF4444', icon: 'chevron-up', sort_order: 3, description: 'Should be completed soon' },
        { value: 'critical', label: 'Critical Priority', color: '#DC2626', icon: 'alert-triangle', sort_order: 4, description: 'Must be completed immediately' }
      ]},
      
      // Task Status Options  
      { set_key: 'status_task', options: [
        { value: 'todo', label: 'To Do', color: '#6B7280', icon: 'circle', sort_order: 1, description: 'Not yet started' },
        { value: 'in_progress', label: 'In Progress', color: '#3B82F6', icon: 'play-circle', sort_order: 2, description: 'Currently being worked on' },
        { value: 'in_review', label: 'In Review', color: '#8B5CF6', icon: 'eye', sort_order: 3, description: 'Under review or testing' },
        { value: 'done', label: 'Done', color: '#10B981', icon: 'check-circle', sort_order: 4, description: 'Completed successfully' },
        { value: 'blocked', label: 'Blocked', color: '#EF4444', icon: 'ban', sort_order: 5, description: 'Cannot proceed due to dependencies' },
        { value: 'cancelled', label: 'Cancelled', color: '#6B7280', icon: 'x-circle', sort_order: 6, description: 'Work cancelled or deprioritized' }
      ]},
      
      // Task Category Options
      { set_key: 'category_task', options: [
        { value: 'feature', label: 'Feature', color: '#3B82F6', icon: 'plus-square', sort_order: 1, description: 'New functionality development' },
        { value: 'bug', label: 'Bug Fix', color: '#EF4444', icon: 'bug', sort_order: 2, description: 'Fixing defects or issues' },
        { value: 'improvement', label: 'Improvement', color: '#10B981', icon: 'trending-up', sort_order: 3, description: 'Enhancement to existing features' },
        { value: 'maintenance', label: 'Maintenance', color: '#F59E0B', icon: 'tool', sort_order: 4, description: 'Code maintenance and refactoring' },
        { value: 'research', label: 'Research', color: '#8B5CF6', icon: 'search', sort_order: 5, description: 'Investigation and research work' },
        { value: 'documentation', label: 'Documentation', color: '#6B7280', icon: 'file-text', sort_order: 6, description: 'Documentation and knowledge sharing' }
      ]},
      
      // Task Complexity Options
      { set_key: 'complexity_task', options: [
        { value: 'trivial', label: 'Trivial', color: '#10B981', icon: 'zap', sort_order: 1, description: 'Very simple, minimal effort' },
        { value: 'simple', label: 'Simple', color: '#3B82F6', icon: 'circle', sort_order: 2, description: 'Straightforward implementation' },
        { value: 'moderate', label: 'Moderate', color: '#F59E0B', icon: 'hexagon', sort_order: 3, description: 'Requires some analysis and planning' },
        { value: 'complex', label: 'Complex', color: '#EF4444', icon: 'triangle', sort_order: 4, description: 'Significant complexity and dependencies' },
        { value: 'epic', label: 'Epic', color: '#DC2626', icon: 'star', sort_order: 5, description: 'Very complex, needs breakdown into smaller tasks' }
      ]},
      
      // Project Priority Options
      { set_key: 'priority_project', options: [
        { value: 'low', label: 'Low Priority', color: '#10B981', icon: 'chevron-down', sort_order: 1 },
        { value: 'medium', label: 'Medium Priority', color: '#F59E0B', icon: 'minus', sort_order: 2 },
        { value: 'high', label: 'High Priority', color: '#EF4444', icon: 'chevron-up', sort_order: 3 },
        { value: 'strategic', label: 'Strategic Priority', color: '#DC2626', icon: 'target', sort_order: 4 }
      ]},
      
      // Project Status Options
      { set_key: 'status_project', options: [
        { value: 'planning', label: 'Planning', color: '#6B7280', icon: 'calendar', sort_order: 1, description: 'Project in planning phase' },
        { value: 'active', label: 'Active', color: '#3B82F6', icon: 'play', sort_order: 2, description: 'Project in active development' },
        { value: 'on_hold', label: 'On Hold', color: '#F59E0B', icon: 'pause', sort_order: 3, description: 'Project temporarily paused' },
        { value: 'completed', label: 'Completed', color: '#10B981', icon: 'check', sort_order: 4, description: 'Project successfully completed' },
        { value: 'cancelled', label: 'Cancelled', color: '#EF4444', icon: 'x', sort_order: 5, description: 'Project cancelled or abandoned' }
      ]},
      
      // Project Category Options
      { set_key: 'category_project', options: [
        { value: 'software', label: 'Software Development', color: '#3B82F6', icon: 'code', sort_order: 1 },
        { value: 'research', label: 'Research & Development', color: '#8B5CF6', icon: 'beaker', sort_order: 2 },
        { value: 'marketing', label: 'Marketing Campaign', color: '#EC4899', icon: 'megaphone', sort_order: 3 },
        { value: 'operational', label: 'Operational Improvement', color: '#10B981', icon: 'cog', sort_order: 4 },
        { value: 'strategic', label: 'Strategic Initiative', color: '#DC2626', icon: 'compass', sort_order: 5 }
      ]},
      
      // Project Phase Options
      { set_key: 'phase_project', options: [
        { value: 'initiation', label: 'Initiation', color: '#6B7280', icon: 'play-circle', sort_order: 1 },
        { value: 'planning', label: 'Planning', color: '#3B82F6', icon: 'calendar', sort_order: 2 },
        { value: 'execution', label: 'Execution', color: '#F59E0B', icon: 'tool', sort_order: 3 },
        { value: 'monitoring', label: 'Monitoring & Control', color: '#8B5CF6', icon: 'activity', sort_order: 4 },
        { value: 'closure', label: 'Closure', color: '#10B981', icon: 'check-circle', sort_order: 5 }
      ]},
      
      // Document Categories
      { set_key: 'category_document', options: [
        { value: 'specification', label: 'Technical Specification', color: '#3B82F6', icon: 'file-text', sort_order: 1 },
        { value: 'manual', label: 'User Manual', color: '#10B981', icon: 'book-open', sort_order: 2 },
        { value: 'policy', label: 'Company Policy', color: '#EF4444', icon: 'shield', sort_order: 3 },
        { value: 'contract', label: 'Legal Contract', color: '#DC2626', icon: 'file-contract', sort_order: 4 },
        { value: 'report', label: 'Business Report', color: '#F59E0B', icon: 'bar-chart', sort_order: 5 },
        { value: 'proposal', label: 'Project Proposal', color: '#8B5CF6', icon: 'lightbulb', sort_order: 6 }
      ]},
      
      // Document Status
      { set_key: 'status_document', options: [
        { value: 'draft', label: 'Draft', color: '#6B7280', icon: 'edit', sort_order: 1 },
        { value: 'review', label: 'Under Review', color: '#F59E0B', icon: 'eye', sort_order: 2 },
        { value: 'approved', label: 'Approved', color: '#10B981', icon: 'check', sort_order: 3 },
        { value: 'published', label: 'Published', color: '#3B82F6', icon: 'external-link', sort_order: 4 },
        { value: 'archived', label: 'Archived', color: '#6B7280', icon: 'archive', sort_order: 5 }
      ]},
      
      // Access Levels (for Documents and Files)
      { set_key: 'access_level_document', options: [
        { value: 'public', label: 'Public', color: '#10B981', icon: 'globe', sort_order: 1, description: 'Accessible to everyone' },
        { value: 'internal', label: 'Internal', color: '#3B82F6', icon: 'users', sort_order: 2, description: 'Company internal access only' },
        { value: 'confidential', label: 'Confidential', color: '#F59E0B', icon: 'lock', sort_order: 3, description: 'Restricted access required' },
        { value: 'secret', label: 'Secret', color: '#EF4444', icon: 'shield', sort_order: 4, description: 'Highly restricted access' }
      ]}
    ];
    
    // Insert system options
    let optionCount = 0;
    for (const optionGroup of systemOptions) {
      const setInfo = insertedSets.find(s => `${s.option_set_type}_${s.archetype}` === optionGroup.set_key);
      if (setInfo) {
        for (const option of optionGroup.options) {
          await kysely
            .insertInto('system_options')
            .values({
              id: uuidv4(),
              option_set_id: setInfo.id,
              value: option.value,
              label: option.label,
              description: option.description || null,
              color: option.color,
              icon: option.icon,
              sort_order: option.sort_order,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            })
            .execute();
          optionCount++;
        }
      }
    }
    
    console.log(`  ✅ Created ${optionCount} system options`);
    
    // ========================================================================
    // PART 2: CUSTOM OPTIONS (Wide Corp Organization-Specific)
    // ========================================================================
    
    console.log('\n🏢 Seeding Wide Corp Custom Options...');
    
    // Clear existing custom options for Wide Corp
    await kysely
      .deleteFrom('custom_options')
      .whereExists(
        kysely.selectFrom('custom_option_sets')
          .where('custom_option_sets.id', '=', sql.ref('custom_options.option_set_id'))
          .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
      )
      .execute();
    
    await kysely
      .deleteFrom('custom_option_sets')
      .where('org_id', '=', WIDE_CORP_ORG_ID)
      .execute();
    
    // Wide Corp custom option sets
    const widecorpOptionSets = [
      { name: 'departments', description: 'Wide Corp Organizational Departments', category: 'organizational' },
      { name: 'locations', description: 'Wide Corp Office Locations', category: 'geographical' },
      { name: 'client_tiers', description: 'Customer Tier Classifications', category: 'business' },
      { name: 'project_types', description: 'Wide Corp Project Classifications', category: 'business' },
      { name: 'skill_areas', description: 'Technical and Business Skill Areas', category: 'professional' },
      { name: 'budget_categories', description: 'Financial Budget Categories', category: 'financial' },
      { name: 'risk_levels', description: 'Business Risk Assessment Levels', category: 'management' },
      { name: 'service_offerings', description: 'Wide Corp Service Portfolio', category: 'business' }
    ];
    
    // Insert custom option sets
    const insertedCustomSets: any[] = [];
    for (const set of widecorpOptionSets) {
      const result = await kysely
        .insertInto('custom_option_sets')
        .values({
          id: uuidv4(),
          org_id: WIDE_CORP_ORG_ID,
          name: set.name,
          description: set.description,
          category: set.category,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning(['id', 'name'])
        .execute();
      insertedCustomSets.push(result[0]);
    }
    
    // Define custom options for Wide Corp
    const widecorpOptions = [
      // Departments
      { set_key: 'departments', options: [
        { value: 'engineering', label: 'Engineering', color: '#3B82F6', icon: 'cpu', sort_order: 1, description: 'Software development and technical implementation' },
        { value: 'product', label: 'Product Management', color: '#8B5CF6', icon: 'lightbulb', sort_order: 2, description: 'Product strategy and roadmap planning' },
        { value: 'design', label: 'Design & UX', color: '#EC4899', icon: 'palette', sort_order: 3, description: 'User experience and visual design' },
        { value: 'marketing', label: 'Marketing', color: '#10B981', icon: 'megaphone', sort_order: 4, description: 'Marketing campaigns and brand management' },
        { value: 'sales', label: 'Sales', color: '#F59E0B', icon: 'trending-up', sort_order: 5, description: 'Revenue generation and client acquisition' },
        { value: 'operations', label: 'Operations', color: '#EF4444', icon: 'cog', sort_order: 6, description: 'Business operations and process management' },
        { value: 'hr', label: 'Human Resources', color: '#6B7280', icon: 'users', sort_order: 7, description: 'People operations and talent management' },
        { value: 'finance', label: 'Finance', color: '#059669', icon: 'dollar-sign', sort_order: 8, description: 'Financial planning and accounting' }
      ]},
      
      // Office Locations
      { set_key: 'locations', options: [
        { value: 'hq_sf', label: 'HQ - San Francisco', color: '#3B82F6', icon: 'map-pin', sort_order: 1, description: 'Main headquarters office' },
        { value: 'austin', label: 'Austin Office', color: '#10B981', icon: 'map-pin', sort_order: 2, description: 'Austin development center' },
        { value: 'nyc', label: 'New York Office', color: '#EF4444', icon: 'map-pin', sort_order: 3, description: 'East coast business office' },
        { value: 'london', label: 'London Office', color: '#8B5CF6', icon: 'map-pin', sort_order: 4, description: 'European operations center' },
        { value: 'remote', label: 'Remote', color: '#6B7280', icon: 'wifi', sort_order: 5, description: 'Work from anywhere' },
        { value: 'client_site', label: 'Client Site', color: '#F59E0B', icon: 'external-link', sort_order: 6, description: 'On-site at client location' }
      ]},
      
      // Client Tiers
      { set_key: 'client_tiers', options: [
        { value: 'enterprise', label: 'Enterprise', color: '#DC2626', icon: 'building', sort_order: 1, description: 'Large enterprise clients (>$1M ARR)' },
        { value: 'growth', label: 'Growth', color: '#F59E0B', icon: 'trending-up', sort_order: 2, description: 'Growing mid-market clients ($100K-$1M ARR)' },
        { value: 'startup', label: 'Startup', color: '#10B981', icon: 'zap', sort_order: 3, description: 'Early-stage startup clients (<$100K ARR)' },
        { value: 'nonprofit', label: 'Non-Profit', color: '#8B5CF6', icon: 'heart', sort_order: 4, description: 'Non-profit organizations' },
        { value: 'government', label: 'Government', color: '#6B7280', icon: 'shield', sort_order: 5, description: 'Government agencies and public sector' }
      ]},
      
      // Project Types (Wide Corp Specific)
      { set_key: 'project_types', options: [
        { value: 'custom_development', label: 'Custom Development', color: '#3B82F6', icon: 'code', sort_order: 1, description: 'Bespoke software development projects' },
        { value: 'platform_integration', label: 'Platform Integration', color: '#10B981', icon: 'link', sort_order: 2, description: 'System integration and API work' },
        { value: 'digital_transformation', label: 'Digital Transformation', color: '#8B5CF6', icon: 'refresh-cw', sort_order: 3, description: 'Legacy system modernization' },
        { value: 'consulting', label: 'Technical Consulting', color: '#F59E0B', icon: 'users', sort_order: 4, description: 'Strategic technical advisory' },
        { value: 'maintenance', label: 'Support & Maintenance', color: '#6B7280', icon: 'tool', sort_order: 5, description: 'Ongoing system support' },
        { value: 'training', label: 'Training & Education', color: '#EC4899', icon: 'book', sort_order: 6, description: 'Team training and knowledge transfer' }
      ]},
      
      // Skill Areas
      { set_key: 'skill_areas', options: [
        { value: 'frontend', label: 'Frontend Development', color: '#3B82F6', icon: 'monitor', sort_order: 1, description: 'React, Vue, Angular, UI/UX' },
        { value: 'backend', label: 'Backend Development', color: '#059669', icon: 'server', sort_order: 2, description: 'Node.js, Python, APIs, databases' },
        { value: 'mobile', label: 'Mobile Development', color: '#EC4899', icon: 'smartphone', sort_order: 3, description: 'iOS, Android, React Native' },
        { value: 'devops', label: 'DevOps & Infrastructure', color: '#EF4444', icon: 'cpu', sort_order: 4, description: 'CI/CD, cloud platforms, containers' },
        { value: 'data', label: 'Data & Analytics', color: '#8B5CF6', icon: 'bar-chart', sort_order: 5, description: 'Data science, ML, business intelligence' },
        { value: 'security', label: 'Security & Compliance', color: '#DC2626', icon: 'shield', sort_order: 6, description: 'InfoSec, compliance, penetration testing' },
        { value: 'design', label: 'Design & UX', color: '#F59E0B', icon: 'palette', sort_order: 7, description: 'UI design, UX research, prototyping' },
        { value: 'business', label: 'Business Analysis', color: '#6B7280', icon: 'briefcase', sort_order: 8, description: 'Requirements analysis, stakeholder management' }
      ]},
      
      // Budget Categories
      { set_key: 'budget_categories', options: [
        { value: 'personnel', label: 'Personnel & Contractors', color: '#3B82F6', icon: 'users', sort_order: 1, description: 'Salaries, benefits, contractor fees' },
        { value: 'technology', label: 'Technology & Software', color: '#10B981', icon: 'cpu', sort_order: 2, description: 'Software licenses, cloud services, hardware' },
        { value: 'marketing', label: 'Marketing & Sales', color: '#EC4899', icon: 'megaphone', sort_order: 3, description: 'Advertising, events, sales materials' },
        { value: 'operations', label: 'Operations & Facilities', color: '#F59E0B', icon: 'building', sort_order: 4, description: 'Office rent, utilities, equipment' },
        { value: 'travel', label: 'Travel & Expenses', color: '#8B5CF6', icon: 'plane', sort_order: 5, description: 'Business travel and meal expenses' },
        { value: 'legal', label: 'Legal & Compliance', color: '#EF4444', icon: 'scale', sort_order: 6, description: 'Legal fees, compliance costs, insurance' },
        { value: 'rd', label: 'Research & Development', color: '#059669', icon: 'beaker', sort_order: 7, description: 'Innovation projects, prototyping' },
        { value: 'contingency', label: 'Contingency & Risk', color: '#6B7280', icon: 'shield', sort_order: 8, description: 'Risk mitigation and emergency funds' }
      ]},
      
      // Risk Levels
      { set_key: 'risk_levels', options: [
        { value: 'low', label: 'Low Risk', color: '#10B981', icon: 'check-circle', sort_order: 1, description: 'Minimal risk, well-understood domain' },
        { value: 'medium', label: 'Medium Risk', color: '#F59E0B', icon: 'alert-circle', sort_order: 2, description: 'Moderate risk, manageable with planning' },
        { value: 'high', label: 'High Risk', color: '#EF4444', icon: 'alert-triangle', sort_order: 3, description: 'Significant risk, requires mitigation strategy' },
        { value: 'critical', label: 'Critical Risk', color: '#DC2626', icon: 'x-octagon', sort_order: 4, description: 'Very high risk, may threaten project success' }
      ]},
      
      // Service Offerings
      { set_key: 'service_offerings', options: [
        { value: 'web_apps', label: 'Web Applications', color: '#3B82F6', icon: 'globe', sort_order: 1, description: 'Custom web application development' },
        { value: 'mobile_apps', label: 'Mobile Applications', color: '#EC4899', icon: 'smartphone', sort_order: 2, description: 'iOS and Android app development' },
        { value: 'cloud_migration', label: 'Cloud Migration', color: '#10B981', icon: 'cloud', sort_order: 3, description: 'Move infrastructure to cloud platforms' },
        { value: 'api_integration', label: 'API Integration', color: '#8B5CF6', icon: 'link-2', sort_order: 4, description: 'System integration and API development' },
        { value: 'data_analytics', label: 'Data & Analytics', color: '#F59E0B', icon: 'bar-chart-2', sort_order: 5, description: 'Business intelligence and data science' },
        { value: 'ui_ux_design', label: 'UI/UX Design', color: '#EC4899', icon: 'palette', sort_order: 6, description: 'User experience and interface design' },
        { value: 'technical_consulting', label: 'Technical Consulting', color: '#6B7280', icon: 'users', sort_order: 7, description: 'Strategic technical advisory services' },
        { value: 'devops_support', label: 'DevOps & Support', color: '#EF4444', icon: 'settings', sort_order: 8, description: 'Infrastructure automation and support' }
      ]}
    ];
    
    // Insert custom options
    let customOptionCount = 0;
    for (const optionGroup of widecorpOptions) {
      const setInfo = insertedCustomSets.find(s => s.name === optionGroup.set_key);
      if (setInfo) {
        for (const option of optionGroup.options) {
          await kysely
            .insertInto('custom_options')
            .values({
              id: uuidv4(),
              option_set_id: setInfo.id,
              value: option.value,
              label: option.label,
              description: option.description || null,
              color: option.color,
              icon: option.icon,
              sort_order: option.sort_order,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            })
            .execute();
          customOptionCount++;
        }
      }
    }
    
    console.log(`  ✅ Created ${customOptionCount} custom options for Wide Corp`);
    
    // ========================================================================
    // PART 3: RELATIONSHIP FIELD CONFIGURATIONS
    // ========================================================================
    
    console.log('\n🔗 Seeding Relationship Configurations...');
    
    // Clear existing relationship field configurations for Wide Corp
    await kysely
      .deleteFrom('dataforge_relationship_fields')
      .where('org_id', '=', WIDE_CORP_ORG_ID)
      .execute();
    
    // Define relationship field configurations for Wide Corp entities
    const relationshipConfigs = [
      // Task relationships
      { entity_type: 'Task', field_name: 'assignee_id', relationship_type: 'assigned_to', target_entity_type: 'User', cardinality: 'many-to-many' },
      { entity_type: 'Task', field_name: 'reviewer_id', relationship_type: 'reviewed_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      { entity_type: 'Task', field_name: 'parent_task_id', relationship_type: 'subtask_of', target_entity_type: 'Task', cardinality: 'many-to-one' },
      { entity_type: 'Task', field_name: 'project_id', relationship_type: 'belongs_to', target_entity_type: 'Project', cardinality: 'many-to-one' },
      
      // Project relationships
      { entity_type: 'Project', field_name: 'project_manager_id', relationship_type: 'managed_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      { entity_type: 'Project', field_name: 'client_id', relationship_type: 'delivered_for', target_entity_type: 'Client', cardinality: 'many-to-one' },
      { entity_type: 'Project', field_name: 'owner_id', relationship_type: 'owned_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      
      // Client relationships
      { entity_type: 'Client', field_name: 'account_manager_id', relationship_type: 'managed_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      
      // Invoice relationships
      { entity_type: 'Invoice', field_name: 'client_id', relationship_type: 'billed_to', target_entity_type: 'Client', cardinality: 'many-to-one' },
      { entity_type: 'Invoice', field_name: 'project_id', relationship_type: 'invoiced_for', target_entity_type: 'Project', cardinality: 'many-to-one' },
      { entity_type: 'Invoice', field_name: 'author_id', relationship_type: 'created_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      
      // Expense relationships
      { entity_type: 'Expense', field_name: 'project_id', relationship_type: 'charged_to', target_entity_type: 'Project', cardinality: 'many-to-one' },
      { entity_type: 'Expense', field_name: 'approved_by_id', relationship_type: 'approved_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      { entity_type: 'Expense', field_name: 'author_id', relationship_type: 'submitted_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      
      // Meeting relationships
      { entity_type: 'Meeting', field_name: 'organizer_id', relationship_type: 'organized_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      { entity_type: 'Meeting', field_name: 'client_id', relationship_type: 'includes_client', target_entity_type: 'Client', cardinality: 'many-to-one' },
      { entity_type: 'Meeting', field_name: 'project_id', relationship_type: 'discusses_project', target_entity_type: 'Project', cardinality: 'many-to-one' },
      
      // Contract relationships
      { entity_type: 'Contract', field_name: 'client_id', relationship_type: 'contracted_with', target_entity_type: 'Client', cardinality: 'many-to-one' },
      { entity_type: 'Contract', field_name: 'owner_id', relationship_type: 'managed_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      
      // Discussion relationships
      { entity_type: 'Discussion', field_name: 'author_id', relationship_type: 'started_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      { entity_type: 'Discussion', field_name: 'resolved_by_id', relationship_type: 'resolved_by', target_entity_type: 'User', cardinality: 'many-to-one' },
      { entity_type: 'Discussion', field_name: 'project_id', relationship_type: 'discusses_project', target_entity_type: 'Project', cardinality: 'many-to-one' }
    ];
    
    // Insert relationship configurations
    let relationshipConfigCount = 0;
    for (const config of relationshipConfigs) {
      await kysely
        .insertInto('dataforge_relationship_fields')
        .values({
          id: uuidv4(),
          org_id: WIDE_CORP_ORG_ID,
          entity_type: config.entity_type,
          field_name: config.field_name,
          relationship_type: config.relationship_type,
          target_entity_type: config.target_entity_type,
          cardinality: config.cardinality,
          display_format: `{{source}} ${config.relationship_type} {{target}}`,
          ui_config: JSON.stringify({
            showInGrid: true,
            showInDetail: true,
            allowMultiple: config.cardinality.includes('many-to-many'),
            icon: getRelationshipIcon(config.relationship_type),
            color: getRelationshipColor(config.relationship_type)
          }),
          created_at: new Date(),
          updated_at: new Date()
        })
        .execute();
      relationshipConfigCount++;
    }
    
    console.log(`  ✅ Created ${relationshipConfigCount} relationship field configurations`);
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    
    console.log('\n📊 Seeding Summary:');
    console.log('  ==========================================');
    console.log(`  System Option Sets:      ${insertedSets.length}`);
    console.log(`  System Options:          ${optionCount}`);
    console.log(`  Custom Option Sets:      ${insertedCustomSets.length}`);
    console.log(`  Custom Options:          ${customOptionCount}`);  
    console.log(`  Relationship Configs:    ${relationshipConfigCount}`);
    console.log('  ==========================================');
    console.log(`  Total:                   ${insertedSets.length + optionCount + insertedCustomSets.length + customOptionCount + relationshipConfigCount} records`);
    
    console.log('\n✨ Options and Relationship system fully seeded!');
    console.log('📋 System Options: Available to all organizations globally');
    console.log('🏢 Custom Options: Wide Corp specific business options');
    console.log('🔗 Relationships: Full relationship system configured');
    console.log('\n🚀 Ready for testing and development!');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await kysely.destroy();
  }
}

// Helper functions for relationship configuration
function getRelationshipIcon(relationshipType: string): string {
  const icons: Record<string, string> = {
    'assigned_to': 'user-check',
    'owned_by': 'crown',
    'managed_by': 'users',
    'created_by': 'user-plus',
    'approved_by': 'check-circle',
    'reviewed_by': 'eye',
    'belongs_to': 'folder',
    'subtask_of': 'git-branch',
    'delivered_for': 'truck',
    'billed_to': 'credit-card',
    'invoiced_for': 'file-text',
    'charged_to': 'dollar-sign',
    'submitted_by': 'upload',
    'organized_by': 'calendar',
    'includes_client': 'building',
    'discusses_project': 'message-circle',
    'contracted_with': 'file-signature',
    'started_by': 'message-square',
    'resolved_by': 'check-circle-2'
  };
  return icons[relationshipType] || 'link';
}

function getRelationshipColor(relationshipType: string): string {
  const colors: Record<string, string> = {
    'assigned_to': '#3B82F6',
    'owned_by': '#FBBF24', 
    'managed_by': '#10B981',
    'created_by': '#8B5CF6',
    'approved_by': '#059669',
    'reviewed_by': '#EC4899',
    'belongs_to': '#6B7280',
    'subtask_of': '#8B5CF6',
    'delivered_for': '#F59E0B',
    'billed_to': '#EF4444',
    'invoiced_for': '#DC2626',
    'charged_to': '#F59E0B',
    'submitted_by': '#3B82F6',
    'organized_by': '#10B981',
    'includes_client': '#059669',
    'discusses_project': '#8B5CF6',
    'contracted_with': '#DC2626',
    'started_by': '#3B82F6',
    'resolved_by': '#10B981'
  };
  return colors[relationshipType] || '#64748B';
}

// Run the seeding
seedOptionsAndRelationships();