-- Enhanced Archetype Examples - Phase 3: Universal Systems Integration
-- Labels, Options, Custom Fields, and Cross-Archetype Relationships

-- =============================================================================
-- UNIVERSAL LABEL SYSTEM - HIERARCHICAL CATEGORIZATION
-- =============================================================================

-- Root Level Labels for TechFlow Agency
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_label (
  id, name, description, color, icon, parent_id, label_type, usage_count,
  is_system_label, metadata, "createdAt", "updatedAt"
) VALUES 
-- Primary Categories
('tf-label-001', 'Client Work', 'All client-related projects, tasks, and deliverables', '#2563eb', 'briefcase', 
 NULL, 'category', 189, false, '{"default_priority": "high", "billing_required": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-002', 'Internal Operations', 'Company internal projects, processes, and initiatives', '#7c3aed', 'building',
 NULL, 'category', 78, false, '{"billing_required": false, "time_tracking": "optional"}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-003', 'Technical Skills', 'Technology and development skill taxonomy', '#059669', 'academic-cap',
 NULL, 'skill_taxonomy', 156, false, '{"skill_assessment": true, "certification_tracking": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-004', 'Business Domain', 'Industry verticals and business domain expertise', '#dc2626', 'chart-bar',
 NULL, 'domain', 92, false, '{"market_research": true, "competitive_analysis": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

-- Client Work Subcategories
('tf-label-101', 'E-commerce & Retail', 'Online retail platforms and shopping experiences', '#3b82f6', 'shopping-cart',
 'tf-label-001', 'client_domain', 67, false, '{"payment_processing": true, "inventory_management": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-102', 'Financial Technology', 'Banking, payments, and financial services', '#10b981', 'currency-dollar',
 'tf-label-001', 'client_domain', 45, false, '{"compliance_required": ["PCI_DSS", "SOX"], "security_level": "high"}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-103', 'Healthcare & MedTech', 'Medical platforms and health technology', '#f59e0b', 'heart',
 'tf-label-001', 'client_domain', 23, false, '{"compliance_required": ["HIPAA"], "data_sensitivity": "high"}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

-- Technical Skills Hierarchy
('tf-label-201', 'Frontend Development', 'Client-side development technologies and frameworks', '#8b5cf6', 'desktop-computer',
 'tf-label-003', 'technical_skill', 89, false, '{"skill_level_tracking": true, "certification_programs": ["React", "Vue", "Angular"]}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-202', 'Backend Development', 'Server-side development and API technologies', '#06b6d4', 'server',
 'tf-label-003', 'technical_skill', 76, false, '{"skill_level_tracking": true, "certification_programs": ["Node.js", "Python", "Java"]}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-203', 'DevOps & Infrastructure', 'Deployment, monitoring, and infrastructure management', '#84cc16', 'cloud',
 'tf-label-003', 'technical_skill', 54, false, '{"skill_level_tracking": true, "certification_programs": ["AWS", "Docker", "Kubernetes"]}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

-- Granular Technical Skills
('tf-label-301', 'React Ecosystem', 'React, Next.js, and related technologies', '#61dafb', 'code',
 'tf-label-201', 'technology', 45, false, '{"current_version": "18.x", "learning_resources": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-302', 'TypeScript', 'Type-safe JavaScript development', '#3178c6', 'check-circle',
 'tf-label-201', 'technology', 67, false, '{"current_version": "5.x", "mandatory": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('tf-label-303', 'Node.js & Express', 'Server-side JavaScript development', '#339933', 'server',
 'tf-label-202', 'technology', 54, false, '{"current_version": "18.x", "framework": "Express"}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00');

-- StartupBoost Inc Labels
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_label (
  id, name, description, color, icon, parent_id, label_type, usage_count,
  is_system_label, metadata, "createdAt", "updatedAt"
) VALUES 
-- Primary Categories
('sb-label-001', 'Product Development', 'Core platform and feature development work', '#dc2626', 'cog',
 NULL, 'category', 234, false, '{"sprint_planning": true, "feature_flagging": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('sb-label-002', 'Customer Success', 'Customer-facing initiatives and support', '#16a34a', 'heart',
 NULL, 'category', 167, false, '{"customer_impact": true, "satisfaction_tracking": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('sb-label-003', 'Research & Innovation', 'Product research, experimentation, and R&D', '#ea580c', 'beaker',
 NULL, 'category', 89, false, '{"experiment_tracking": true, "hypothesis_testing": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

-- Product Development Subcategories
('sb-label-101', 'Platform Core', 'Core platform infrastructure and fundamental features', '#7c2d12', 'chip',
 'sb-label-001', 'product_area', 78, false, '{"architecture_impact": "high", "testing_required": "comprehensive"}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('sb-label-102', 'Analytics & Insights', 'Data analytics, reporting, and business intelligence', '#1e40af', 'chart-bar',
 'sb-label-001', 'product_area', 89, false, '{"data_processing": true, "real_time": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00'),

('sb-label-103', 'Mobile Experience', 'Mobile app development and optimization', '#0f766e', 'device-mobile',
 'sb-label-001', 'product_area', 56, false, '{"platform": ["iOS", "Android"], "performance_critical": true}',
 '2025-01-01 08:00:00', '2025-07-22 14:30:00');

-- Entity Label Relationships
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_entity_label (
  entity_type, entity_id, label_id, applied_by, applied_at, confidence_score, context
) VALUES 
-- Project Labels
('project', 'tf-proj-001', 'tf-label-001', '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', 1.0, 'primary_category'),
('project', 'tf-proj-001', 'tf-label-101', '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', 1.0, 'domain_specialization'),
('project', 'tf-proj-002', 'tf-label-001', '0198ab70-1002-7000-8000-000000000001', '2025-01-15 09:00:00', 1.0, 'primary_category'),
('project', 'tf-proj-002', 'tf-label-102', '0198ab70-1002-7000-8000-000000000001', '2025-01-15 09:00:00', 1.0, 'domain_specialization'),

-- Task Labels (Technical Skills)
('task', 'tf-task-001', 'tf-label-201', '0198ab70-1004-7000-8000-000000000001', '2025-02-05 14:00:00', 0.9, 'skill_requirement'),
('task', 'tf-task-004', 'tf-label-201', '0198ab70-1004-7000-8000-000000000001', '2025-03-12 11:00:00', 1.0, 'skill_requirement'),
('task', 'tf-task-004', 'tf-label-301', '0198ab70-1004-7000-8000-000000000001', '2025-03-12 11:00:00', 1.0, 'technology_stack'),
('task', 'tf-task-013', 'tf-label-202', '0198ab70-1005-7000-8000-000000000001', '2025-05-20 16:00:00', 1.0, 'skill_requirement'),
('task', 'tf-task-013', 'tf-label-303', '0198ab70-1005-7000-8000-000000000001', '2025-05-20 16:00:00', 1.0, 'technology_stack'),

-- Document Labels
('document', 'tf-doc-001', 'tf-label-001', '0198ab70-1002-7000-8000-000000000001', '2025-01-15 10:00:00', 1.0, 'business_context'),
('document', 'tf-doc-001', 'tf-label-101', '0198ab70-1002-7000-8000-000000000001', '2025-01-15 10:00:00', 1.0, 'domain_context'),

-- Record Labels
('record', 'tf-record-002', 'tf-label-001', '0198ab70-1003-7000-8000-000000000001', '2025-02-10 14:00:00', 1.0, 'project_context'),
('record', 'tf-record-002', 'tf-label-101', '0198ab70-1003-7000-8000-000000000001', '2025-02-10 14:00:00', 1.0, 'domain_context');

-- StartupBoost Entity Labels
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_entity_label (
  entity_type, entity_id, label_id, applied_by, applied_at, confidence_score, context
) VALUES 
-- Project Labels
('project', 'sb-proj-001', 'sb-label-001', '0198ab70-2003-7000-8000-000000000002', '2025-06-01 09:00:00', 1.0, 'primary_category'),
('project', 'sb-proj-001', 'sb-label-102', '0198ab70-2003-7000-8000-000000000002', '2025-06-01 09:00:00', 1.0, 'product_area'),

-- Record Labels
('record', 'sb-record-001', 'sb-label-001', '0198ab70-2008-7000-8000-000000000002', '2025-06-01 10:00:00', 1.0, 'product_context'),
('record', 'sb-record-001', 'sb-label-102', '0198ab70-2008-7000-8000-000000000002', '2025-06-01 10:00:00', 1.0, 'feature_area');

-- =============================================================================
-- UNIVERSAL OPTION SYSTEM - STATUS WORKFLOWS & BUSINESS LOGIC
-- =============================================================================

-- Option Sets for Different Archetype Patterns
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_option_set (
  id, name, archetype, version, is_active, created_by, description, metadata,
  "createdAt", "updatedAt"
) VALUES 
-- Project Status Workflow
('tf-opts-proj-status', 'Project Status Workflow', 'project', '2.1', true, 
 '0198ab70-1002-7000-8000-000000000001', 'Complete project lifecycle status management with client communication triggers',
 '{"workflow_type": "linear", "client_visibility": true, "auto_transitions": true}',
 '2025-01-01 08:00:00', '2025-07-15 10:30:00'),

-- Task Status Workflow  
('tf-opts-task-status', 'Agile Task Status Workflow', 'task', '1.8', true,
 '0198ab70-1002-7000-8000-000000000001', 'Agile development task workflow with time tracking and review gates',
 '{"workflow_type": "kanban", "time_tracking": true, "review_required": true}',
 '2025-01-01 08:00:00', '2025-07-10 14:15:00'),

-- Universal Priority System
('tf-opts-priority', 'Universal Priority Levels', 'universal', '1.0', true,
 '0198ab70-1002-7000-8000-000000000001', 'Standardized priority levels with SLA and escalation rules',
 '{"sla_enabled": true, "escalation_rules": true, "client_visibility": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

-- Document Status Workflow
('tf-opts-doc-status', 'Document Lifecycle Management', 'document', '1.3', true,
 '0198ab70-1002-7000-8000-000000000001', 'Document creation, review, approval, and maintenance workflow',
 '{"version_control": true, "approval_required": true, "expiration_tracking": true}',
 '2025-01-01 08:00:00', '2025-06-20 11:45:00');

-- Project Status Options with Business Logic
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_option (
  id, option_set_id, name, value, description, color, icon, sort_order,
  is_default, metadata, "createdAt", "updatedAt"
) VALUES 
-- Project Statuses
('tf-opt-proj-planning', 'tf-opts-proj-status', 'Planning & Discovery', 'planning', 
 'Project in initial planning and requirements gathering phase', '#6b7280', 'clipboard-list', 1, true,
 '{"transitions": ["active", "cancelled"], "required_fields": ["scope", "timeline", "budget"], "client_communication": "weekly"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-proj-active', 'tf-opts-proj-status', 'Active Development', 'active',
 'Project in active development with regular deliverables', '#10b981', 'play', 2, false,
 '{"transitions": ["on_hold", "completed", "cancelled"], "notifications": ["weekly_status", "milestone_alerts"], "time_tracking": "mandatory"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-proj-hold', 'tf-opts-proj-status', 'On Hold', 'on_hold',
 'Project temporarily paused pending client decision or external dependency', '#f59e0b', 'pause', 3, false,
 '{"transitions": ["active", "cancelled"], "escalation_days": 14, "client_communication": "immediate", "reason_required": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-proj-completed', 'tf-opts-proj-status', 'Completed & Delivered', 'completed',
 'Project successfully completed and delivered to client', '#059669', 'check-circle', 4, false,
 '{"transitions": ["maintenance"], "finalization_required": true, "client_signoff": true, "warranty_period": "90_days"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-proj-cancelled', 'tf-opts-proj-status', 'Cancelled', 'cancelled',
 'Project cancelled or terminated before completion', '#dc2626', 'x-circle', 5, false,
 '{"transitions": [], "reason_required": true, "asset_disposition": "required", "final_billing": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

-- Task Statuses with Agile Workflow
('tf-opt-task-backlog', 'tf-opts-task-status', 'Product Backlog', 'backlog',
 'Task identified but not yet prioritized for active sprint', '#94a3b8', 'inbox', 1, true,
 '{"transitions": ["todo"], "assignment_required": false, "sprint_planning": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-task-todo', 'tf-opts-task-status', 'Sprint Backlog', 'todo',
 'Task prioritized and ready for development in current sprint', '#6b7280', 'list', 2, false,
 '{"transitions": ["in_progress"], "assignment_required": true, "estimation_required": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-task-progress', 'tf-opts-task-status', 'In Progress', 'in_progress',
 'Task actively being worked on by assigned developer', '#3b82f6', 'play-circle', 3, false,
 '{"transitions": ["done", "blocked", "review"], "time_tracking": "mandatory", "daily_updates": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-task-blocked', 'tf-opts-task-status', 'Blocked', 'blocked',
 'Task blocked by external dependency or technical issue', '#f59e0b', 'exclamation-triangle', 4, false,
 '{"transitions": ["in_progress", "todo"], "blocker_description": "required", "escalation": "auto_24h"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-task-review', 'tf-opts-task-status', 'Code Review', 'review',
 'Task development completed, undergoing peer review', '#8b5cf6', 'eye', 5, false,
 '{"transitions": ["done", "in_progress"], "reviewer_required": true, "review_checklist": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-task-done', 'tf-opts-task-status', 'Done', 'done',
 'Task completed, tested, and accepted', '#10b981', 'check-circle', 6, false,
 '{"transitions": ["in_progress"], "completion_notes": true, "quality_validation": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

-- Universal Priority Options
('tf-opt-priority-low', 'tf-opts-priority', 'Low Priority', 'low',
 'Non-urgent work that can be scheduled flexibly', '#6b7280', 'chevron-down', 1, false,
 '{"sla_days": 30, "escalation": false, "weekend_work": false}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-priority-medium', 'tf-opts-priority', 'Standard Priority', 'medium',
 'Normal business priority with standard SLA', '#3b82f6', 'minus', 2, true,
 '{"sla_days": 14, "escalation": false, "business_hours": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-priority-high', 'tf-opts-priority', 'High Priority', 'high',
 'Important work requiring expedited handling', '#f59e0b', 'chevron-up', 3, false,
 '{"sla_days": 7, "escalation": true, "overtime_approved": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-opt-priority-urgent', 'tf-opts-priority', 'Urgent/Critical', 'urgent',
 'Critical urgent work requiring immediate attention', '#dc2626', 'exclamation', 4, false,
 '{"sla_hours": 48, "escalation": "immediate", "weekend_work": true, "notifications": ["sms", "email", "slack"]}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00');

-- =============================================================================
-- CUSTOM FIELD EXAMPLES - EXTENDED ARCHETYPE FIELDS
-- =============================================================================

-- Custom Fields for Software Projects (extending Project archetype)
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_custom_field_metadata (
  entity_type, entity_id, field_name, field_type, field_value, validation_rules,
  created_by, description, "createdAt", "updatedAt"
) VALUES 
-- RetailCorp E-commerce Project Custom Fields
('project', 'tf-proj-001', 'tech_stack', 'json_array', 
 '["React 18", "Node.js 18", "PostgreSQL 15", "Redis 7", "AWS ECS", "TypeScript 5"]',
 '{"min_items": 1, "allowed_values": ["React 18", "Vue 3", "Angular 16", "Node.js 18", "Python 3.11", "Java 17", "PostgreSQL 15", "MySQL 8", "Redis 7", "AWS ECS", "GCP Cloud Run", "Azure Container Apps"]}',
 '0198ab70-1003-7000-8000-000000000001', 'Technology stack used in project implementation',
 '2025-02-01 10:00:00', '2025-02-15 14:30:00'),

('project', 'tf-proj-001', 'repository_url', 'url',
 'https://github.com/techflow/retailcorp-ecommerce',
 '{"protocol": ["https"], "domain_whitelist": ["github.com", "gitlab.com", "bitbucket.org"]}',
 '0198ab70-1003-7000-8000-000000000001', 'Primary code repository for project',
 '2025-02-01 10:00:00', '2025-02-01 10:00:00'),

('project', 'tf-proj-001', 'deployment_environments', 'json_object',
 '{"development": "https://dev.retailcorp-ecom.techflow.dev", "staging": "https://staging.retailcorp-ecom.techflow.dev", "production": "https://shop.retailcorp.com"}',
 '{"required_keys": ["development", "staging", "production"]}',
 '0198ab70-1003-7000-8000-000000000001', 'Deployment environment URLs',
 '2025-02-01 10:00:00', '2025-04-25 16:20:00'),

('project', 'tf-proj-001', 'code_quality_score', 'number', '94',
 '{"min": 0, "max": 100, "required": true, "target": 85}',
 '0198ab70-1004-7000-8000-000000000001', 'SonarQube code quality score',
 '2025-02-01 10:00:00', '2025-04-28 11:15:00'),

('project', 'tf-proj-001', 'test_coverage_percentage', 'percentage', '87',
 '{"min": 0, "max": 100, "target": 80, "critical_threshold": 70}',
 '0198ab70-1004-7000-8000-000000000001', 'Automated test coverage percentage',
 '2025-02-01 10:00:00', '2025-04-28 11:15:00'),

-- FinancePlus Project Custom Fields
('project', 'tf-proj-002', 'compliance_certifications', 'json_array',
 '["PCI DSS Level 1", "SOX Compliant", "GDPR Compliant"]',
 '{"allowed_values": ["PCI DSS Level 1", "PCI DSS Level 2", "SOX Compliant", "GDPR Compliant", "HIPAA Compliant", "ISO 27001"]}',
 '0198ab70-1003-7000-8000-000000000001', 'Required compliance certifications',
 '2025-01-15 09:00:00', '2025-07-15 16:45:00'),

('project', 'tf-proj-002', 'security_audit_schedule', 'json_object',
 '{"quarterly_internal": "Q1, Q2, Q3, Q4", "annual_external": "Q4", "penetration_testing": "Bi-annual"}',
 '{"required_keys": ["quarterly_internal", "annual_external"]}',
 '0198ab70-1006-7000-8000-000000000001', 'Security audit and testing schedule',
 '2025-01-15 09:00:00', '2025-01-15 09:00:00'),

('project', 'tf-proj-002', 'encryption_standards', 'json_array',
 '["AES-256", "RSA-4096", "TLS 1.3", "PBKDF2"]',
 '{"min_items": 2, "allowed_values": ["AES-256", "AES-128", "RSA-4096", "RSA-2048", "TLS 1.3", "TLS 1.2", "PBKDF2", "bcrypt"]}',
 '0198ab70-1006-7000-8000-000000000001', 'Encryption standards implemented',
 '2025-01-15 09:00:00', '2025-06-10 12:30:00'),

-- Task-Level Custom Fields
('task', 'tf-task-015', 'complexity_fibonacci', 'select',
 '8', '{"options": ["1", "2", "3", "5", "8", "13", "21"], "description": "Fibonacci complexity scoring"}',
 '0198ab70-1005-7000-8000-000000000001', 'Task complexity using Fibonacci sequence',
 '2025-05-15 10:00:00', '2025-07-20 14:30:00'),

('task', 'tf-task-015', 'technical_debt_impact', 'boolean', 'false',
 '{"description": "Does this task introduce or address technical debt?"}',
 '0198ab70-1005-7000-8000-000000000001', 'Technical debt impact assessment',
 '2025-05-15 10:00:00', '2025-05-15 10:00:00'),

('task', 'tf-task-015', 'performance_impact_level', 'select', 'medium',
 '{"options": ["none", "low", "medium", "high", "critical"], "default": "none"}',
 '0198ab70-1005-7000-8000-000000000001', 'Expected performance impact of changes',
 '2025-05-15 10:00:00', '2025-07-20 14:30:00'),

('task', 'tf-task-015', 'browser_compatibility', 'json_array',
 '["Chrome 90+", "Firefox 88+", "Safari 14+", "Edge 90+"]',
 '{"min_items": 2, "allowed_values": ["Chrome 90+", "Firefox 88+", "Safari 14+", "Edge 90+", "IE 11", "Mobile Safari", "Chrome Mobile"]}',
 '0198ab70-1004-7000-8000-000000000001', 'Required browser compatibility support',
 '2025-05-15 10:00:00', '2025-05-15 10:00:00');

-- StartupBoost Custom Fields
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_custom_field_metadata (
  entity_type, entity_id, field_name, field_type, field_value, validation_rules,
  created_by, description, "createdAt", "updatedAt"
) VALUES 
-- StartupBoost Project Custom Fields
('project', 'sb-proj-001', 'feature_flags_config', 'json_object',
 '{"ai_recommendations": {"enabled": true, "rollout_percentage": 25}, "advanced_analytics": {"enabled": false}, "mobile_push_notifications": {"enabled": true, "rollout_percentage": 100}}',
 '{"required_structure": {"enabled": "boolean"}}',
 '0198ab70-2005-7000-8000-000000000002', 'Feature flag configuration and rollout status',
 '2025-06-01 09:00:00', '2025-07-22 11:30:00'),

('project', 'sb-proj-001', 'target_user_segments', 'json_array',
 '["enterprise_customers", "startup_teams", "freelancers", "agencies"]',
 '{"min_items": 1, "allowed_values": ["enterprise_customers", "startup_teams", "freelancers", "agencies", "consultants", "non_profits"]}',
 '0198ab70-2003-7000-8000-000000000002', 'Target user segments for feature rollout',
 '2025-06-01 09:00:00', '2025-06-01 09:00:00'),

('project', 'sb-proj-001', 'ab_test_configuration', 'json_object',
 '{"test_name": "ai_dashboard_v2", "control_group": 50, "test_group": 50, "success_metrics": ["engagement_time", "feature_adoption"], "duration_days": 14}',
 '{"required_keys": ["test_name", "control_group", "test_group", "success_metrics"]}',
 '0198ab70-2008-7000-8000-000000000002', 'A/B testing configuration and parameters',
 '2025-06-01 09:00:00', '2025-07-15 14:20:00'),

-- Record Custom Fields
('record', 'sb-record-001', 'statistical_confidence', 'percentage', '95',
 '{"min": 80, "max": 99, "target": 95}',
 '0198ab70-2008-7000-8000-000000000002', 'Statistical confidence level of research findings',
 '2025-06-01 10:00:00', '2025-07-15 14:20:00'),

('record', 'sb-record-001', 'sample_demographics', 'json_object',
 '{"company_size": {"startup": 40, "small_business": 35, "enterprise": 25}, "industry": {"tech": 45, "finance": 20, "retail": 15, "other": 20}, "geography": {"north_america": 60, "europe": 25, "asia_pacific": 15}}',
 '{"required_keys": ["company_size", "industry", "geography"]}',
 '0198ab70-2008-7000-8000-000000000002', 'Demographic breakdown of research sample',
 '2025-06-01 10:00:00', '2025-06-01 10:00:00');

-- This completes Phase 3 Universal Systems Integration:
-- ✅ Hierarchical Label System with business context and skill taxonomies
-- ✅ Option System with status workflows, transitions, and business logic
-- ✅ Custom Field Examples with validation rules and business requirements
-- ✅ Cross-entity labeling and categorization

-- Next: Cross-archetype relationships and business logic validation