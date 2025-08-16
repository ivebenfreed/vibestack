# Enhanced Archetype Examples Plan
*Comprehensive Data Design to Showcase All Universal Archetype System Features*

## 🎯 Current State Analysis

### Existing Data Structure
Our current example data focuses primarily on **2 archetypes**:
- ✅ **Project Archetype**: TechFlow Agency & StartupBoost Inc projects
- ✅ **Task Archetype**: Associated tasks with realistic workflows

### Missing Archetype Coverage
- ❌ **Record Archetype**: Meeting notes, specifications, documentation
- ❌ **Document Archetype**: Contracts, proposals, manuals with versioning
- ❌ **File Archetype**: Source code, media, assets with metadata
- ❌ **Activity Archetype**: Deployments, reviews, testing activities
- ❌ **Discussion Archetype**: Forums, announcements, threaded conversations
- ❌ **Collection Archetype**: Dashboards, portfolios, knowledge bases

### Missing System Features
- ❌ **Universal Label System**: Hierarchical categorization with colors/icons
- ❌ **Universal Option System**: Status workflows, priorities, categories
- ❌ **Custom Field Examples**: Extended archetype fields with validation
- ❌ **Cross-Archetype Relationships**: Entity dependencies and references
- ❌ **Container-Based Access Control**: Project/department/workspace permissions

## 🏗️ Enhanced Data Architecture Plan

### Phase 1: All 8 Archetype Pattern Examples
Create realistic examples for every universal archetype to demonstrate system completeness.

### Phase 2: Universal Systems Integration
Implement label and option systems across all archetypes with realistic business scenarios.

### Phase 3: Cross-Archetype Relationships
Show how different archetype types interconnect in real business workflows.

### Phase 4: Advanced Features Showcase
Demonstrate custom fields, access control, and complex business logic.

## 📋 Detailed Implementation Plan

## Phase 1: Complete Archetype Coverage

### 1.1 Record Archetype Examples

**TechFlow Agency Records**:
```sql
-- Meeting Notes Record
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_meeting_notes (
  id, title, meeting_date, attendees, agenda_items, action_items, 
  meeting_type, duration_minutes, location, recording_url
) VALUES (
  'tf-record-001',
  'RetailCorp Project Kickoff',
  '2025-02-01 10:00:00',
  '["Marcus Johnson", "Alex Kim", "Client Team"]',
  '["Project scope review", "Timeline discussion", "Technical requirements"]',
  '["Create project charter", "Set up dev environment", "Schedule design review"]',
  'client_kickoff',
  90,
  'TechFlow Conference Room A',
  'https://zoom.us/rec/play/abc123'
);

-- Technical Specification Record
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_tech_spec (
  id, title, project_id, specification_type, version, status,
  requirements, architecture_notes, tech_stack, reviewed_by
) VALUES (
  'tf-record-002',
  'RetailCorp E-commerce API Specification',
  'tf-proj-001',
  'api_specification',
  '2.1',
  'approved',
  '{"endpoints": 45, "authentication": "JWT", "rate_limiting": "1000/hour"}',
  'Microservices architecture with Redis caching and PostgreSQL',
  '["Node.js", "Express", "PostgreSQL", "Redis", "JWT"]',
  '0198ab70-1003-7000-8000-000000000001'
);

-- Process Documentation Record  
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_process_doc (
  id, title, process_category, steps, approval_required, last_updated_by,
  compliance_level, review_frequency, stakeholders
) VALUES (
  'tf-record-003',
  'Client Onboarding Process',
  'business_process',
  '["Initial consultation", "Project proposal", "Contract signing", "Project kickoff"]',
  true,
  '0198ab70-1002-7000-8000-000000000001',
  'high',
  'quarterly',
  '["Sales Team", "Project Managers", "Legal Team"]'
);
```

**StartupBoost Inc Records**:
```sql
-- Product Requirements Record
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_product_requirements (
  id, title, product_area, priority_score, user_stories_count,
  acceptance_criteria, technical_notes, stakeholder_feedback
) VALUES (
  'sb-record-001',
  'AI-Powered Analytics Feature Requirements',
  'platform_core',
  95,
  12,
  '["Real-time data processing", "ML model integration", "Dashboard visualization"]',
  'Requires TensorFlow.js integration and WebGL for 3D visualizations',
  '{"engineering": "feasible", "product": "high_value", "design": "complex"}'
);

-- Research Notes Record
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_research_notes (
  id, title, research_area, hypothesis, methodology, findings,
  confidence_level, next_steps, related_experiments
) VALUES (
  'sb-record-002',
  'User Engagement Patterns Analysis',
  'user_behavior',
  'Users engage 40% more with personalized content',
  'A/B testing with 10,000 users over 4 weeks',
  '{"engagement_increase": "38%", "retention_improvement": "15%"}',
  'high',
  '["Implement personalization engine", "Expand testing to mobile app"]',
  '["sb-record-003", "sb-record-004"]'
);
```

### 1.2 Document Archetype Examples

**Versioned Business Documents**:
```sql
-- Contract Document
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_contract (
  id, title, client_name, contract_type, version, status, effective_date,
  expiration_date, value_amount, terms_summary, legal_review_status,
  signed_by_client, signed_by_company, document_url
) VALUES (
  'tf-doc-001',
  'RetailCorp E-commerce Development Agreement',
  'RetailCorp Inc',
  'service_agreement',
  '1.2',
  'executed',
  '2025-02-01',
  '2025-05-01',
  125000.00,
  'Full-stack e-commerce platform development with 3-month warranty',
  'approved',
  'John Smith (CTO)',
  'Marcus Johnson (CEO)',
  'https://docs.techflow.com/contracts/retailcorp-001-v1.2.pdf'
);

-- Proposal Document
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_proposal (
  id, title, client_name, proposal_type, version, status, submitted_date,
  estimated_value, scope_summary, timeline_weeks, win_probability,
  next_action, competitor_analysis
) VALUES (
  'tf-doc-002',
  'FinancePlus Analytics Dashboard Proposal',
  'FinancePlus Bank',
  'new_project',
  '2.0',
  'pending_review',
  '2025-08-01',
  85000.00,
  'Real-time financial analytics dashboard with predictive modeling',
  16,
  75,
  'Technical presentation scheduled for Aug 15th',
  '{"main_competitor": "TechCorp", "our_advantage": "banking_domain_expertise"}'
);

-- User Manual Document
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_user_manual (
  id, title, product_feature, version, audience, last_updated,
  page_count, format, accessibility_compliant, translation_status,
  usage_analytics, feedback_score
) VALUES (
  'sb-doc-001',
  'StartupBoost Platform User Guide',
  'core_platform',
  '3.1',
  'end_users',
  '2025-07-15',
  45,
  'interactive_web',
  true,
  '{"spanish": "complete", "french": "in_progress"}',
  '{"monthly_views": 12500, "completion_rate": "68%"}',
  4.3
);
```

### 1.3 File Archetype Examples

**Source Code & Media Files**:
```sql
-- Source Code File
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_source_code (
  id, filename, file_path, repository, language, file_size_bytes,
  last_modified, author, commit_hash, code_quality_score,
  test_coverage, dependencies, security_scan_status
) VALUES (
  'tf-file-001',
  'ProductCatalog.tsx',
  '/src/components/catalog/ProductCatalog.tsx',
  'retailcorp-ecommerce',
  'typescript',
  8742,
  '2025-03-28 14:30:00',
  '0198ab70-1004-7000-8000-000000000001',
  'a1b2c3d4e5f6789',
  92,
  '87%',
  '["react", "styled-components", "react-query"]',
  'passed'
);

-- Media File
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_media (
  id, filename, file_type, file_size_bytes, resolution, duration_seconds,
  created_by, usage_context, optimization_status, cdn_url,
  alt_text, metadata_tags, download_count
) VALUES (
  'tf-file-002',
  'retailcorp-hero-banner.webp',
  'image',
  245678,
  '1920x1080',
  NULL,
  '0198ab70-1002-7000-8000-000000000001',
  'homepage_hero',
  'optimized',
  'https://cdn.techflow.com/images/retailcorp-hero-banner.webp',
  'Modern e-commerce storefront with shopping cart and products',
  '["hero", "ecommerce", "banner", "responsive"]',
  1250
);

-- Documentation File
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_documentation (
  id, filename, doc_type, file_size_bytes, last_updated, maintained_by,
  relevance_score, access_count, outdated_sections, review_due
) VALUES (
  'sb-file-001',
  'API-Integration-Guide.md',
  'technical_guide',
  15678,
  '2025-07-20',
  '0198ab70-2005-7000-8000-000000000002',
  98,
  3456,
  '[]',
  '2025-10-20'
);
```

### 1.4 Activity Archetype Examples

**Development Activities & Events**:
```sql
-- Deployment Activity
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_deployment (
  id, project_id, environment, version, deployment_type, status,
  started_at, completed_at, deployed_by, rollback_available,
  performance_impact, user_impact_assessment, monitoring_alerts
) VALUES (
  'tf-activity-001',
  'tf-proj-001',
  'production',
  '2.1.0',
  'blue_green',
  'successful',
  '2025-04-30 02:00:00',
  '2025-04-30 02:15:00',
  '0198ab70-1003-7000-8000-000000000001',
  true,
  '{"response_time": "improved_5%", "memory_usage": "stable"}',
  'zero_downtime',
  0
);

-- Code Review Activity
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_review (
  id, pull_request_id, reviewer, review_type, status, started_at,
  completed_at, lines_reviewed, issues_found, approval_given,
  feedback_summary, security_concerns, performance_notes
) VALUES (
  'tf-activity-002',
  'pr-456',
  '0198ab70-1003-7000-8000-000000000001',
  'security_review',
  'approved',
  '2025-03-25 09:00:00',
  '2025-03-25 10:30:00',
  342,
  2,
  true,
  'Minor SQL injection prevention improvements needed',
  '["input_validation", "sql_parameterization"]',
  'No performance concerns identified'
);

-- Testing Activity
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_testing (
  id, test_suite, test_type, environment, status, started_at,
  completed_at, tests_total, tests_passed, tests_failed,
  coverage_percentage, performance_benchmarks, bug_reports_created
) VALUES (
  'sb-activity-001',
  'platform-integration-tests',
  'integration',
  'staging',
  'completed',
  '2025-07-18 14:00:00',
  '2025-07-18 16:45:00',
  1247,
  1238,
  9,
  92.5,
  '{"api_response": "avg_120ms", "db_queries": "avg_45ms"}',
  3
);
```

### 1.5 Discussion Archetype Examples

**Forums & Threaded Conversations**:
```sql
-- Announcement Discussion
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_announcement (
  id, title, announcement_type, priority, content, posted_by,
  posted_at, expires_at, target_audience, acknowledgment_required,
  acknowledgment_count, discussion_enabled, pin_status
) VALUES (
  'tf-discussion-001',
  'New Client Project: RetailCorp Partnership',
  'project_announcement',
  'high',
  'Excited to announce our new partnership with RetailCorp for a complete e-commerce platform redesign. This is our largest contract to date and will showcase our full-stack capabilities.',
  '0198ab70-1002-7000-8000-000000000001',
  '2025-02-01 09:00:00',
  '2025-02-15 23:59:59',
  'all_team',
  false,
  12,
  true,
  'pinned'
);

-- Forum Discussion Thread
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_forum_thread (
  id, category, title, original_post, created_by, created_at,
  last_activity, reply_count, participant_count, is_resolved,
  solution_post_id, tags, view_count
) VALUES (
  'tf-discussion-002',
  'technical',
  'Best Practices for React State Management in Large Apps',
  'Looking for team input on whether we should standardize on Redux Toolkit or stick with React Query + useState for the RetailCorp project. What has worked well for others?',
  '0198ab70-1004-7000-8000-000000000001',
  '2025-03-10 11:30:00',
  '2025-03-12 16:20:00',
  8,
  5,
  true,
  'reply-456',
  '["react", "state-management", "redux", "react-query"]',
  34
);

-- Support Thread
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_support_thread (
  id, ticket_id, priority, issue_category, title, description,
  reported_by, assigned_to, status, created_at, resolved_at,
  escalation_level, customer_satisfaction, resolution_summary
) VALUES (
  'sb-discussion-001',
  'TICKET-789',
  'urgent',
  'platform_bug',
  'Analytics Dashboard Not Loading for Enterprise Users',
  'Multiple enterprise customers reporting blank dashboard pages when accessing analytics module. Issue started approximately 2 hours ago.',
  '0198ab70-2008-7000-8000-000000000002',
  '0198ab70-2005-7000-8000-000000000002',
  'resolved',
  '2025-07-15 14:30:00',
  '2025-07-15 16:15:00',
  2,
  4.8,
  'Database connection pool exhaustion resolved by increasing max connections from 50 to 100'
);
```

### 1.6 Collection Archetype Examples

**Dashboards & Knowledge Bases**:
```sql
-- Project Dashboard Collection
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_dashboard (
  id, title, dashboard_type, visibility, owner, created_at,
  last_updated, widget_count, data_sources, refresh_interval,
  shared_with, usage_analytics, performance_score
) VALUES (
  'tf-collection-001',
  'RetailCorp Project Command Center',
  'project_dashboard',
  'team',
  '0198ab70-1002-7000-8000-000000000001',
  '2025-02-01 10:00:00',
  '2025-04-25 09:30:00',
  12,
  '["jira", "github", "google_analytics", "time_tracking"]',
  300,
  '["project_team", "client_stakeholders"]',
  '{"daily_views": 45, "avg_session": "8_minutes"}',
  94
);

-- Knowledge Base Collection
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_knowledge_base (
  id, title, category, visibility, maintainer, article_count,
  last_updated, search_enabled, version_control, access_analytics,
  content_freshness_score, user_rating, collaboration_enabled
) VALUES (
  'tf-collection-002',
  'TechFlow Development Standards',
  'technical_standards',
  'internal',
  '0198ab70-1003-7000-8000-000000000001',
  47,
  '2025-07-20',
  true,
  true,
  '{"monthly_searches": 234, "popular_articles": ["coding_standards", "git_workflow"]}',
  91,
  4.6,
  true
);

-- Portfolio Collection
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_portfolio (
  id, title, portfolio_type, description, curated_by, item_count,
  creation_date, last_modified, visibility, tags,
  featured_items, analytics_enabled, collaboration_level
) VALUES (
  'sb-collection-001',
  'StartupBoost Product Feature Showcase',
  'product_portfolio',
  'Comprehensive showcase of our platform capabilities and customer success stories',
  '0198ab70-2003-7000-8000-000000000002',
  23,
  '2025-06-01',
  '2025-07-22',
  'public',
  '["product", "features", "showcase", "customer_success"]',
  '["ai_analytics", "real_time_collaboration", "mobile_app"]',
  true,
  'collaborative'
);
```

## Phase 2: Universal Systems Integration

### 2.1 Label System Implementation

**Hierarchical Labels with Business Context**:
```sql
-- Root Level Labels
INSERT INTO labels (id, name, description, color, icon, parent_id, organization_id, label_type, usage_count) VALUES
-- TechFlow Agency Labels
('tf-label-001', 'Client Work', 'All client-related projects and tasks', '#2563eb', 'briefcase', NULL, '0198ab70-1000-7000-8000-000000000001', 'category', 145),
('tf-label-002', 'Internal', 'Internal company projects and operations', '#7c3aed', 'building', NULL, '0198ab70-1000-7000-8000-000000000001', 'category', 67),
('tf-label-003', 'Skills', 'Technical and business skills taxonomy', '#059669', 'academic-cap', NULL, '0198ab70-1000-7000-8000-000000000001', 'skill', 89),

-- StartupBoost Inc Labels  
('sb-label-001', 'Product Development', 'Core platform development work', '#dc2626', 'cog', NULL, '0198ab70-2000-7000-8000-000000000002', 'category', 203),
('sb-label-002', 'Customer Success', 'Customer-facing initiatives', '#16a34a', 'heart', NULL, '0198ab70-2000-7000-8000-000000000002', 'category', 156),
('sb-label-003', 'Research', 'Product research and experimentation', '#ea580c', 'beaker', NULL, '0198ab70-2000-7000-8000-000000000002', 'category', 78);

-- Child Level Labels (Client Work Subcategories)
INSERT INTO labels (id, name, description, color, icon, parent_id, organization_id, label_type, usage_count) VALUES
('tf-label-101', 'E-commerce', 'Online retail and shopping platforms', '#3b82f6', 'shopping-cart', 'tf-label-001', '0198ab70-1000-7000-8000-000000000001', 'domain', 45),
('tf-label-102', 'FinTech', 'Financial technology and banking', '#10b981', 'currency-dollar', 'tf-label-001', '0198ab70-1000-7000-8000-000000000001', 'domain', 32),
('tf-label-103', 'Healthcare', 'Medical and health-related platforms', '#f59e0b', 'heart', 'tf-label-001', '0198ab70-1000-7000-8000-000000000001', 'domain', 18),

-- Technical Skills Labels
('tf-label-201', 'Frontend', 'Client-side development skills', '#8b5cf6', 'desktop-computer', 'tf-label-003', '0198ab70-1000-7000-8000-000000000001', 'technical_skill', 67),
('tf-label-202', 'Backend', 'Server-side development skills', '#06b6d4', 'server', 'tf-label-003', '0198ab70-1000-7000-8000-000000000001', 'technical_skill', 54),
('tf-label-203', 'DevOps', 'Infrastructure and deployment skills', '#84cc16', 'cloud', 'tf-label-003', '0198ab70-1000-7000-8000-000000000001', 'technical_skill', 41);

-- Entity Label Relationships
INSERT INTO entity_labels (entity_type, entity_id, label_id, applied_by, applied_at, confidence_score) VALUES
-- Project Labels
('project', 'tf-proj-001', 'tf-label-001', '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', 1.0),
('project', 'tf-proj-001', 'tf-label-101', '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', 1.0),
('project', 'tf-proj-002', 'tf-label-001', '0198ab70-1002-7000-8000-000000000001', '2025-01-15 09:00:00', 1.0),
('project', 'tf-proj-002', 'tf-label-102', '0198ab70-1002-7000-8000-000000000001', '2025-01-15 09:00:00', 1.0),

-- Task Labels
('task', 'tf-task-001', 'tf-label-201', '0198ab70-1004-7000-8000-000000000001', '2025-02-05 14:00:00', 0.9),
('task', 'tf-task-004', 'tf-label-201', '0198ab70-1004-7000-8000-000000000001', '2025-03-12 11:00:00', 1.0),
('task', 'tf-task-013', 'tf-label-202', '0198ab70-1005-7000-8000-000000000001', '2025-05-20 16:00:00', 1.0);
```

### 2.2 Option System Implementation

**Status Workflows & Business Logic**:
```sql
-- Option Sets for Different Archetype Patterns
INSERT INTO option_sets (id, name, archetype, organization_id, version, is_active, created_by) VALUES
-- Project Status Options
('tf-opts-proj-status', 'Project Status Workflow', 'project', '0198ab70-1000-7000-8000-000000000001', '1.0', true, '0198ab70-1002-7000-8000-000000000001'),
-- Task Status Options  
('tf-opts-task-status', 'Task Status Workflow', 'task', '0198ab70-1000-7000-8000-000000000001', '1.0', true, '0198ab70-1002-7000-8000-000000000001'),
-- Priority Options (Universal)
('tf-opts-priority', 'Universal Priority Levels', 'universal', '0198ab70-1000-7000-8000-000000000001', '1.0', true, '0198ab70-1002-7000-8000-000000000001');

-- Project Status Options with Transitions
INSERT INTO options (id, option_set_id, name, value, description, color, icon, sort_order, is_default, metadata) VALUES
-- Project Statuses
('tf-opt-proj-planning', 'tf-opts-proj-status', 'Planning', 'planning', 'Project in planning phase', '#6b7280', 'clipboard-list', 1, true, '{"transitions": ["active", "cancelled"], "required_fields": ["scope", "timeline"]}'),
('tf-opt-proj-active', 'tf-opts-proj-status', 'Active', 'active', 'Project actively in development', '#10b981', 'play', 2, false, '{"transitions": ["on_hold", "completed", "cancelled"], "notifications": ["weekly_status"]}'),
('tf-opt-proj-hold', 'tf-opts-proj-status', 'On Hold', 'on_hold', 'Project temporarily paused', '#f59e0b', 'pause', 3, false, '{"transitions": ["active", "cancelled"], "escalation_days": 14}'),
('tf-opt-proj-completed', 'tf-opts-proj-status', 'Completed', 'completed', 'Project successfully delivered', '#059669', 'check-circle', 4, false, '{"transitions": [], "finalization_required": true}'),
('tf-opt-proj-cancelled', 'tf-opts-proj-status', 'Cancelled', 'cancelled', 'Project cancelled or terminated', '#dc2626', 'x-circle', 5, false, '{"transitions": [], "reason_required": true}'),

-- Task Statuses
('tf-opt-task-todo', 'tf-opts-task-status', 'To Do', 'todo', 'Task not yet started', '#6b7280', 'inbox', 1, true, '{"transitions": ["in_progress"], "assignment_required": false}'),
('tf-opt-task-progress', 'tf-opts-task-status', 'In Progress', 'in_progress', 'Task currently being worked on', '#3b82f6', 'play-circle', 2, false, '{"transitions": ["done", "blocked", "todo"], "time_tracking": true}'),
('tf-opt-task-blocked', 'tf-opts-task-status', 'Blocked', 'blocked', 'Task blocked by dependency or issue', '#f59e0b', 'exclamation-triangle', 3, false, '{"transitions": ["in_progress", "todo"], "blocker_required": true}'),
('tf-opt-task-review', 'tf-opts-task-status', 'In Review', 'review', 'Task completed, awaiting review', '#8b5cf6', 'eye', 4, false, '{"transitions": ["done", "in_progress"], "reviewer_required": true}'),
('tf-opt-task-done', 'tf-opts-task-status', 'Done', 'done', 'Task completed and accepted', '#10b981', 'check-circle', 5, false, '{"transitions": ["in_progress"], "completion_notes": true}'),

-- Universal Priority Options
('tf-opt-priority-low', 'tf-opts-priority', 'Low', 'low', 'Low priority work', '#6b7280', 'chevron-down', 1, false, '{"sla_days": 30, "escalation": false}'),
('tf-opt-priority-medium', 'tf-opts-priority', 'Medium', 'medium', 'Standard priority work', '#3b82f6', 'minus', 2, true, '{"sla_days": 14, "escalation": false}'),
('tf-opt-priority-high', 'tf-opts-priority', 'High', 'high', 'High priority work', '#f59e0b', 'chevron-up', 3, false, '{"sla_days": 7, "escalation": true}'),
('tf-opt-priority-urgent', 'tf-opts-priority', 'Urgent', 'urgent', 'Critical urgent work', '#dc2626', 'exclamation', 4, false, '{"sla_days": 2, "escalation": true, "notifications": ["immediate"]}}');

-- Option Metadata Tables (Type-Specific Business Logic)
INSERT INTO status_option_metadata (option_id, workflow_stage, completion_percentage, auto_transitions, required_actions) VALUES
('tf-opt-proj-planning', 'initiation', 5, '[]', '["define_scope", "create_timeline"]'),
('tf-opt-proj-active', 'execution', 50, '[]', '["weekly_updates", "track_progress"]'),
('tf-opt-proj-completed', 'closure', 100, '[]', '["final_review", "client_signoff", "archive_resources"]'),

('tf-opt-task-todo', 'backlog', 0, '[]', '[]'),
('tf-opt-task-progress', 'development', 25, '[]', '["log_time", "update_progress"]'),
('tf-opt-task-review', 'validation', 90, '["done_after_approval"]', '["peer_review", "testing"]'),
('tf-opt-task-done', 'complete', 100, '[]', '["close_ticket"]');

INSERT INTO priority_option_metadata (option_id, urgency_level, escalation_rules, sla_hours, notification_triggers) VALUES
('tf-opt-priority-low', 1, '{}', 720, '[]'),
('tf-opt-priority-medium', 2, '{}', 336, '["weekly_digest"]'),
('tf-opt-priority-high', 3, '{"auto_escalate_days": 7}', 168, '["daily_digest", "manager_notification"]'),
('tf-opt-priority-urgent', 4, '{"auto_escalate_days": 1, "escalate_to": "management"}', 48, '["immediate_sms", "email", "slack"]');
```

## Phase 3: Cross-Archetype Relationships

### 3.1 Entity Relationships

**Complex Business Relationship Examples**:
```sql
-- Project Dependencies and Relationships
INSERT INTO entity_relationships (id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, relationship_type, strength, created_by, metadata) VALUES
-- Project to Project Relationships
('rel-001', 'project', 'tf-proj-001', 'project', 'tf-proj-003', 'leads_to', 0.9, '0198ab70-1002-7000-8000-000000000001', '{"dependency_type": "platform_reuse", "shared_components": ["authentication", "user_management"]}'),
('rel-002', 'project', 'tf-proj-002', 'project', 'tf-proj-005', 'enables', 0.8, '0198ab70-1002-7000-8000-000000000001', '{"shared_client": "FinancePlus Bank", "knowledge_transfer": true}'),

-- Task Dependencies
('rel-003', 'task', 'tf-task-001', 'task', 'tf-task-002', 'blocks', 1.0, '0198ab70-1002-7000-8000-000000000001', '{"dependency_reason": "UX research must complete before wireframes"}'),
('rel-004', 'task', 'tf-task-004', 'task', 'tf-task-005', 'enables', 0.9, '0198ab70-1004-7000-8000-000000000001', '{"setup_required": "framework_configuration"}'),

-- Document Dependencies
('rel-005', 'record', 'tf-record-002', 'task', 'tf-task-013', 'specifies', 1.0, '0198ab70-1003-7000-8000-000000000001', '{"specification_coverage": ["api_endpoints", "data_models"]}'),
('rel-006', 'document', 'tf-doc-001', 'project', 'tf-proj-001', 'governs', 1.0, '0198ab70-1002-7000-8000-000000000001', '{"contract_scope": "full_project", "payment_schedule": "milestone_based"}'),

-- Activity Tracking Relationships
('rel-007', 'activity', 'tf-activity-001', 'project', 'tf-proj-001', 'deploys', 1.0, '0198ab70-1003-7000-8000-000000000001', '{"deployment_stage": "production", "success_criteria_met": true}'),
('rel-008', 'activity', 'tf-activity-002', 'file', 'tf-file-001', 'reviews', 0.8, '0198ab70-1003-7000-8000-000000000001', '{"review_type": "security", "issues_found": 2}'),

-- Discussion References
('rel-009', 'discussion', 'tf-discussion-002', 'project', 'tf-proj-001', 'discusses', 0.7, '0198ab70-1004-7000-8000-000000000001', '{"discussion_topic": "technical_approach", "decision_made": true}'),

-- Collection Aggregations
('rel-010', 'collection', 'tf-collection-001', 'project', 'tf-proj-001', 'contains', 1.0, '0198ab70-1002-7000-8000-000000000001', '{"dashboard_widget": "project_overview"}'),
('rel-011', 'collection', 'tf-collection-001', 'task', 'tf-task-015', 'tracks', 0.9, '0198ab70-1002-7000-8000-000000000001', '{"metric_type": "progress_indicator"}'),
('rel-012', 'collection', 'tf-collection-002', 'record', 'tf-record-003', 'documents', 1.0, '0198ab70-1003-7000-8000-000000000001', '{"knowledge_category": "business_process"}');
```

## Phase 4: Advanced Features Showcase

### 4.1 Custom Field Examples

**Extended Archetype Fields with Validation**:
```sql
-- Custom Fields for Software Projects (extending Project archetype)
INSERT INTO custom_field_metadata (entity_type, entity_id, field_name, field_type, field_value, validation_rules, created_by) VALUES
-- TechFlow Software Project Custom Fields
('project', 'tf-proj-001', 'tech_stack', 'json_array', '["React", "Node.js", "PostgreSQL", "Redis", "AWS"]', '{"min_items": 1, "allowed_values": ["React", "Vue", "Angular", "Node.js", "Python", "Java", "PostgreSQL", "MySQL", "Redis", "AWS", "GCP", "Azure"]}', '0198ab70-1003-7000-8000-000000000001'),
('project', 'tf-proj-001', 'repository_url', 'url', 'https://github.com/techflow/retailcorp-ecommerce', '{"protocol": ["https"], "domain_whitelist": ["github.com", "gitlab.com"]}', '0198ab70-1003-7000-8000-000000000001'),
('project', 'tf-proj-001', 'deployment_url', 'url', 'https://ecommerce.retailcorp.com', '{"protocol": ["https"], "ssl_required": true}', '0198ab70-1003-7000-8000-000000000001'),
('project', 'tf-proj-001', 'code_quality_score', 'number', '92', '{"min": 0, "max": 100, "required": true}', '0198ab70-1004-7000-8000-000000000001'),
('project', 'tf-proj-001', 'test_coverage', 'percentage', '87', '{"min": 0, "max": 100, "target": 80}', '0198ab70-1004-7000-8000-000000000001'),

-- FinTech Project Custom Fields
('project', 'tf-proj-002', 'compliance_level', 'select', 'pci_dss_level_1', '{"options": ["pci_dss_level_1", "sox_compliant", "gdpr_compliant", "hipaa_compliant"]}', '0198ab70-1003-7000-8000-000000000001'),
('project', 'tf-proj-002', 'security_audit_date', 'date', '2025-06-15', '{"required": true, "future_date": false}', '0198ab70-1006-7000-8000-000000000001'),
('project', 'tf-proj-002', 'encryption_standards', 'json_array', '["AES-256", "RSA-4096", "TLS-1.3"]', '{"min_items": 1}', '0198ab70-1006-7000-8000-000000000001'),

-- StartupBoost Custom Fields
('project', 'sb-proj-001', 'feature_flags', 'json_object', '{"ai_recommendations": true, "advanced_analytics": false, "mobile_push": true}', '{}', '0198ab70-2005-7000-8000-000000000002'),
('project', 'sb-proj-001', 'user_segments', 'json_array', '["enterprise", "startup", "freelancer"]', '{"min_items": 1}', '0198ab70-2003-7000-8000-000000000002'),

-- Task Custom Fields
('task', 'tf-task-015', 'complexity_score', 'number', '8', '{"min": 1, "max": 10, "description": "Fibonacci complexity scoring"}', '0198ab70-1005-7000-8000-000000000001'),
('task', 'tf-task-015', 'technical_debt', 'boolean', 'false', '{}', '0198ab70-1005-7000-8000-000000000001'),
('task', 'tf-task-015', 'performance_impact', 'select', 'medium', '{"options": ["low", "medium", "high", "critical"]}', '0198ab70-1005-7000-8000-000000000001');

-- Calculated Fields (Formula-Based)
INSERT INTO calculated_field_metadata (entity_type, entity_id, field_name, formula, dependencies, result_value, last_calculated) VALUES
('project', 'tf-proj-001', 'project_health_score', 'AVERAGE(code_quality_score, test_coverage) * (1 - (days_overdue / 30))', '["code_quality_score", "test_coverage", "due_date"]', '89.5', NOW()),
('project', 'tf-proj-003', 'completion_percentage', '(completed_tasks / total_tasks) * 100', '["task_counts"]', '67.8', NOW()),
('task', 'tf-task-015', 'effort_efficiency', '(estimated_hours / actual_hours) * 100', '["estimated_hours", "actual_hours"]', '160.0', NOW());

-- Lookup Fields (Cross-Archetype References)
INSERT INTO lookup_field_metadata (entity_type, entity_id, field_name, target_entity_type, target_field, filter_criteria, current_value) VALUES
('task', 'tf-task-015', 'related_documentation', 'record', 'title', '{"category": "technical_spec", "project_id": "tf-proj-003"}', 'RetailCorp Inventory API Specification'),
('project', 'tf-proj-001', 'primary_contract', 'document', 'title', '{"document_type": "contract", "status": "executed"}', 'RetailCorp E-commerce Development Agreement'),
('record', 'tf-record-002', 'implementing_tasks', 'task', 'title', '{"project_id": "tf-proj-001", "status": ["in_progress", "done"]}', '5 tasks found');
```

### 4.2 Container-Based Access Control

**Fine-Grained Permission Examples**:
```sql
-- Container Permissions for Different Access Patterns
INSERT INTO container_permissions (id, container_type, container_id, user_id, permission_type, access_level, granted_by, granted_at, conditions) VALUES
-- Project-Level Permissions
('perm-001', 'project', 'tf-proj-001', '0198ab70-1004-7000-8000-000000000001', 'read_write', 'full', '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', '{"role": "lead_developer"}'),
('perm-002', 'project', 'tf-proj-001', '0198ab70-1005-7000-8000-000000000001', 'read_write', 'standard', '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', '{"role": "developer"}'),
('perm-003', 'project', 'tf-proj-001', '0198ab70-1006-7000-8000-000000000001', 'read_only', 'limited', '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', '{"role": "qa_tester"}'),

-- Department-Level Permissions
('perm-004', 'department', 'engineering', '0198ab70-1003-7000-8000-000000000001', 'admin', 'full', '0198ab70-1001-7000-8000-000000000001', '2025-01-01 00:00:00', '{"role": "engineering_manager"}'),
('perm-005', 'department', 'design', '0198ab70-1002-7000-8000-000000000001', 'admin', 'full', '0198ab70-1001-7000-8000-000000000001', '2025-01-01 00:00:00', '{"role": "design_director"}'),

-- Workspace-Level Permissions
('perm-006', 'workspace', 'client_projects', '0198ab70-1007-7000-8000-000000000001', 'read_only', 'observer', '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', '{"role": "client_stakeholder"}'),

-- User-Level Permissions (Personal Containers)
('perm-007', 'user', '0198ab70-1004-7000-8000-000000000001', '0198ab70-1004-7000-8000-000000000001', 'read_write', 'owner', 'system', '2025-01-01 00:00:00', '{"auto_granted": true}'),

-- System-Level Permissions
('perm-008', 'system', 'platform', '0198ab70-1001-7000-8000-000000000001', 'admin', 'full', 'system', '2025-01-01 00:00:00', '{"role": "organization_owner"}');
```

### 4.3 Business Logic Validation Examples

**Archetype-Specific Business Rules**:
```sql
-- Project Business Logic Validation
INSERT INTO archetype_business_rules (archetype, rule_name, rule_type, condition, action, priority, is_active) VALUES
-- Project Rules
('project', 'budget_exceeded_warning', 'validation', 'actual_cost > (budget * 0.9)', 'warn_stakeholders', 1, true),
('project', 'deadline_approaching', 'automation', 'end_date - CURRENT_DATE <= 7 days AND status = "active"', 'send_notification', 2, true),
('project', 'completion_validation', 'validation', 'status = "completed" AND completion_percentage < 100', 'require_explanation', 1, true),

-- Task Rules
('task', 'time_tracking_required', 'validation', 'status = "in_progress" AND actual_hours IS NULL', 'block_status_change', 1, true),
('task', 'dependency_check', 'validation', 'status = "in_progress" AND blocked_by_count > 0', 'prevent_start', 1, true),
('task', 'effort_variance_alert', 'automation', 'actual_hours > (estimated_hours * 1.5)', 'notify_manager', 2, true),

-- Document Rules
('document', 'version_control', 'automation', 'content_changed = true', 'increment_version', 1, true),
('document', 'approval_required', 'validation', 'document_type = "contract" AND status = "final"', 'require_legal_approval', 1, true),

-- Activity Rules
('activity', 'deployment_validation', 'validation', 'activity_type = "deployment" AND test_coverage < 80', 'block_deployment', 1, true),
('activity', 'review_timeout', 'automation', 'activity_type = "review" AND created_at < NOW() - INTERVAL "48 hours"', 'escalate_review', 2, true);
```

## Phase 5: Implementation Timeline

### Week 1: Core Archetype Examples
- ✅ Analyze current data structure 
- ⏳ Create Record, Document, File archetype examples
- ⏳ Add Activity, Discussion, Collection examples

### Week 2: Universal Systems
- ⏳ Implement hierarchical label system with business context
- ⏳ Create comprehensive option system with workflows
- ⏳ Add custom field examples with validation

### Week 3: Relationships & Business Logic
- ⏳ Build cross-archetype relationship examples
- ⏳ Implement container-based access control scenarios
- ⏳ Add business rule validation examples

### Week 4: Integration & Testing
- ⏳ Create end-to-end business scenario walkthroughs
- ⏳ Validate all archetype features work together
- ⏳ Performance test with realistic data volumes

## 🎯 Success Metrics

Upon completion, our enhanced examples will demonstrate:

### Coverage Metrics
- ✅ **8/8 Archetype Patterns**: Complete examples for all universal archetypes
- 🎯 **Universal Systems**: Labels, options, custom fields across all entities
- 🎯 **Relationship Types**: 10+ different cross-archetype relationships
- 🎯 **Business Scenarios**: 3+ complete end-to-end workflows

### Feature Demonstration
- 🎯 **Custom Fields**: 15+ examples of extended archetype fields
- 🎯 **Validation Rules**: Business logic for each archetype pattern
- 🎯 **Access Control**: Container-based permissions across all levels
- 🎯 **Workflows**: Status transitions and business rule enforcement

### Realism & Usability
- 🎯 **Business Context**: Realistic scenarios from actual industry use cases
- 🎯 **Data Volume**: Sufficient data to test performance and scalability
- 🎯 **Interconnections**: Complex but realistic entity relationships
- 🎯 **User Experience**: Examples that demonstrate actual user workflows

This enhanced data will serve as the foundation for showcasing VibeStack's universal archetype system capabilities to stakeholders, developers, and potential customers.