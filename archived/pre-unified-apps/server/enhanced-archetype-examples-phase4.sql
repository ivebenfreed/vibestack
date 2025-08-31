-- Enhanced Archetype Examples - Phase 4: Cross-Archetype Relationships & Business Logic
-- Entity relationships, validation rules, and complete business workflows

-- =============================================================================
-- CROSS-ARCHETYPE ENTITY RELATIONSHIPS
-- =============================================================================

-- Complex Business Relationship Examples
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_entity_relationship (
  id, source_entity_type, source_entity_id, target_entity_type, target_entity_id,
  relationship_type, strength, created_by, metadata, bidirectional, "createdAt", "updatedAt"
) VALUES 
-- Project Dependencies and Enablement
('tf-rel-001', 'project', 'tf-proj-001', 'project', 'tf-proj-003', 'leads_to', 0.9,
 '0198ab70-1002-7000-8000-000000000001',
 '{"dependency_type": "platform_reuse", "shared_components": ["authentication_system", "user_management", "payment_processing"], "knowledge_transfer": "architecture_patterns"}',
 false, '2025-05-01 10:00:00', '2025-05-01 10:00:00'),

('tf-rel-002', 'project', 'tf-proj-002', 'project', 'tf-proj-005', 'enables', 0.8,
 '0198ab70-1002-7000-8000-000000000001',
 '{"shared_client": "FinancePlus Bank", "existing_relationship": true, "domain_expertise": "financial_services", "trust_established": true}',
 false, '2025-08-01 09:00:00', '2025-08-01 09:00:00'),

-- Task Dependencies (Blocking Relationships)
('tf-rel-003', 'task', 'tf-task-001', 'task', 'tf-task-002', 'blocks', 1.0,
 '0198ab70-1002-7000-8000-000000000001',
 '{"dependency_reason": "UX research findings required before wireframe creation", "completion_required": 100, "deliverable": "user_personas_and_journey_maps"}',
 false, '2025-02-05 14:00:00', '2025-02-15 11:30:00'),

('tf-rel-004', 'task', 'tf-task-004', 'task', 'tf-task-005', 'enables', 0.9,
 '0198ab70-1004-7000-8000-000000000001',
 '{"setup_required": "framework_configuration_and_build_tools", "shared_dependencies": ["react", "typescript", "styled_components"]}',
 false, '2025-03-15 09:00:00', '2025-03-25 16:20:00'),

('tf-rel-005', 'task', 'tf-task-012', 'task', 'tf-task-013', 'enables', 1.0,
 '0198ab70-1003-7000-8000-000000000001',
 '{"database_schema_required": true, "api_endpoints_depend_on": "data_model_design", "migration_scripts": "included"}',
 false, '2025-05-15 10:00:00', '2025-06-01 14:30:00'),

-- Document to Project Governance
('tf-rel-006', 'document', 'tf-doc-001', 'project', 'tf-proj-001', 'governs', 1.0,
 '0198ab70-1002-7000-8000-000000000001',
 '{"contract_scope": "complete_project_lifecycle", "payment_schedule": "milestone_based", "scope_change_process": "formal_amendments", "warranty_period": "90_days"}',
 false, '2025-01-15 10:00:00', '2025-02-01 16:30:00'),

('tf-rel-007', 'document', 'tf-doc-002', 'project', 'tf-proj-002', 'governs', 1.0,
 '0198ab70-1002-7000-8000-000000000001',
 '{"contract_scope": "mobile_app_development", "compliance_requirements": ["PCI_DSS", "SOX"], "security_standards": "bank_grade"}',
 false, '2025-01-01 09:00:00', '2025-01-15 14:20:00'),

-- Record to Task Specification
('tf-rel-008', 'record', 'tf-record-004', 'task', 'tf-task-013', 'specifies', 1.0,
 '0198ab70-1003-7000-8000-000000000001',
 '{"specification_coverage": ["api_endpoints", "data_models", "authentication_flow"], "implementation_guidance": "detailed", "acceptance_criteria": "defined"}',
 false, '2025-02-10 14:00:00', '2025-05-20 16:00:00'),

('tf-rel-009', 'record', 'tf-record-005', 'task', 'tf-task-015', 'specifies', 0.9,
 '0198ab70-1003-7000-8000-000000000001',
 '{"websocket_requirements": "real_time_inventory_updates", "performance_targets": "sub_100ms_latency", "scalability": "200_concurrent_users"}',
 false, '2025-05-10 09:00:00', '2025-07-20 11:45:00'),

-- Activity Tracking Relationships
('tf-rel-010', 'activity', 'tf-activity-001', 'project', 'tf-proj-001', 'deploys', 1.0,
 '0198ab70-1003-7000-8000-000000000001',
 '{"deployment_stage": "production", "version": "2.1.0", "success_criteria_met": true, "performance_improvement": "8_percent"}',
 false, '2025-04-30 02:17:00', '2025-04-30 02:17:00'),

('tf-rel-011', 'activity', 'tf-activity-004', 'file', 'tf-file-001', 'reviews', 0.8,
 '0198ab70-1003-7000-8000-000000000001',
 '{"review_type": "security_focused", "issues_found": 3, "severity": "minor", "approval_status": "approved_with_conditions"}',
 false, '2025-03-25 11:15:00', '2025-03-25 11:15:00'),

('tf-rel-012', 'activity', 'tf-activity-005', 'file', 'tf-file-003', 'reviews', 0.6,
 '0198ab70-1004-7000-8000-000000000001',
 '{"review_type": "architecture_review", "issues_found": 8, "severity": "major", "changes_requested": true, "refactoring_required": "websocket_implementation"}',
 false, '2025-07-18 16:45:00', '2025-07-18 16:45:00'),

-- Discussion References and Knowledge Sharing
('tf-rel-013', 'discussion', 'tf-discussion-004', 'project', 'tf-proj-001', 'discusses', 0.7,
 '0198ab70-1004-7000-8000-000000000001',
 '{"discussion_topic": "state_management_architecture", "decision_made": true, "chosen_solution": "redux_toolkit", "rationale": "team_familiarity_and_ecosystem"}',
 false, '2025-03-10 11:30:00', '2025-03-15 16:20:00'),

('tf-rel-014', 'discussion', 'tf-discussion-005', 'task', 'tf-task-013', 'informs', 0.8,
 '0198ab70-1003-7000-8000-000000000001',
 '{"knowledge_shared": "database_optimization_techniques", "performance_improvement": "40_percent", "techniques_applied": ["indexing", "connection_pooling", "query_optimization"]}',
 false, '2025-04-20 14:00:00', '2025-04-25 11:45:00'),

-- Collection Aggregations and Dashboards
('tf-rel-015', 'collection', 'tf-collection-001', 'project', 'tf-proj-001', 'contains', 1.0,
 '0198ab70-1002-7000-8000-000000000001',
 '{"dashboard_widgets": ["project_progress", "milestone_timeline", "budget_tracking", "team_workload"], "refresh_frequency": "5_minutes"}',
 false, '2025-02-01 10:00:00', '2025-07-22 14:30:00'),

('tf-rel-016', 'collection', 'tf-collection-001', 'task', 'tf-task-015', 'tracks', 0.9,
 '0198ab70-1002-7000-8000-000000000001',
 '{"metrics": ["progress_percentage", "time_remaining", "blocker_status"], "alert_conditions": ["behind_schedule", "blocked_over_24h"]}',
 false, '2025-05-15 10:00:00', '2025-07-20 14:30:00'),

('tf-rel-017', 'collection', 'tf-collection-004', 'record', 'tf-record-003', 'documents', 1.0,
 '0198ab70-1003-7000-8000-000000000001',
 '{"knowledge_category": "business_processes", "searchable": true, "version_controlled": true, "access_level": "team_internal"}',
 false, '2025-02-01 11:30:00', '2025-02-01 11:30:00'),

('tf-rel-018', 'collection', 'tf-collection-004', 'file', 'tf-file-001', 'references', 0.8,
 '0198ab70-1003-7000-8000-000000000001',
 '{"reference_type": "code_example", "context": "react_component_standards", "educational_value": "high"}',
 false, '2025-02-15 09:00:00', '2025-03-28 14:30:00');

-- StartupBoost Cross-Archetype Relationships
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_entity_relationship (
  id, source_entity_type, source_entity_id, target_entity_type, target_entity_id,
  relationship_type, strength, created_by, metadata, bidirectional, "createdAt", "updatedAt"
) VALUES 
-- Research to Product Development
('sb-rel-001', 'record', 'sb-record-003', 'project', 'sb-proj-001', 'informs', 0.9,
 '0198ab70-2008-7000-8000-000000000002',
 '{"research_impact": "personalization_feature_prioritization", "confidence_level": "high", "implementation_priority": "Q3_2025"}',
 false, '2025-06-20 17:30:00', '2025-07-01 10:15:00'),

('sb-rel-002', 'record', 'sb-record-004', 'task', 'sb-task-008', 'validates', 0.8,
 '0198ab70-2009-7000-8000-000000000002',
 '{"validation_type": "user_experience_improvement", "onboarding_completion_rate": "72_percent_improvement", "implementation_validated": true}',
 false, '2025-07-05 14:45:00', '2025-07-18 11:20:00'),

-- Testing Activities to Features
('sb-rel-003', 'activity', 'sb-activity-001', 'project', 'sb-proj-001', 'validates', 0.9,
 '0198ab70-2005-7000-8000-000000000002',
 '{"test_coverage": "89.7_percent", "critical_paths_tested": true, "performance_benchmarks_met": true, "release_readiness": "approved"}',
 false, '2025-07-18 17:45:00', '2025-07-18 17:45:00'),

-- Portfolio Showcasing Products
('sb-rel-004', 'collection', 'sb-collection-001', 'project', 'sb-proj-001', 'showcases', 1.0,
 '0198ab70-2003-7000-8000-000000000002',
 '{"showcase_type": "product_feature_highlight", "customer_facing": true, "marketing_value": "high", "demo_integration": true}',
 false, '2025-06-01 10:00:00', '2025-07-22 14:15:00');

-- =============================================================================
-- BUSINESS LOGIC VALIDATION RULES
-- =============================================================================

-- Archetype-Specific Business Rules for Workflow Validation
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_business_rule (
  id, archetype, rule_name, rule_type, condition, action, priority, is_active,
  error_message, success_action, metadata, "createdAt", "updatedAt"
) VALUES 
-- Project Business Logic Rules
('tf-rule-001', 'project', 'Budget Threshold Warning', 'validation',
 'actual_cost > (budget_amount * 0.85)',
 'warn_stakeholders_and_require_approval',
 1, true, 'Project is approaching budget limit. Stakeholder approval required for additional expenses.',
 'send_budget_alert_notification',
 '{"alert_recipients": ["project_manager", "client_stakeholder", "finance_team"], "escalation_threshold": "90_percent"}',
 '2025-01-01 08:00:00', '2025-07-15 10:30:00'),

('tf-rule-002', 'project', 'Deadline Approaching Alert', 'automation',
 'end_date - CURRENT_DATE <= 7 AND status = "active"',
 'send_deadline_warning_notification',
 2, true, NULL,
 'create_deadline_action_items',
 '{"notification_schedule": ["7_days", "3_days", "1_day"], "escalation_to": "management", "action_items": ["risk_assessment", "timeline_review"]}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-rule-003', 'project', 'Project Completion Validation', 'validation',
 'status = "completed" AND (completion_percentage < 100 OR deliverables_signed_off = false)',
 'block_status_change_and_require_explanation',
 1, true, 'Cannot mark project as completed: deliverables not fully signed off or completion percentage below 100%.',
 'create_completion_checklist',
 '{"required_signoffs": ["client_acceptance", "quality_assurance", "project_manager"], "completion_criteria": ["all_tasks_done", "documentation_complete", "handover_complete"]}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

-- Task Business Logic Rules
('tf-rule-004', 'task', 'Time Tracking Enforcement', 'validation',
 'status = "in_progress" AND time_entries_today = 0',
 'require_time_entry_before_status_change',
 1, true, 'Time tracking is required for tasks in progress. Please log your time before changing task status.',
 'open_time_tracking_dialog',
 '{"minimum_time_entry": "15_minutes", "reminder_frequency": "daily", "enforcement_level": "strict"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-rule-005', 'task', 'Dependency Validation', 'validation',
 'status = "in_progress" AND blocked_dependencies_count > 0',
 'prevent_status_change_and_show_blockers',
 1, true, 'Cannot start task: dependent tasks are not yet completed. Review blocking dependencies.',
 'highlight_blocking_dependencies',
 '{"show_dependency_graph": true, "auto_check_frequency": "hourly", "notification_to_blockers": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-rule-006', 'task', 'Effort Variance Alert', 'automation',
 'actual_hours > (estimated_hours * 1.5) AND status != "done"',
 'notify_manager_and_request_timeline_review',
 2, true, NULL,
 'create_effort_variance_review',
 '{"escalation_threshold": "150_percent", "review_required": true, "timeline_impact_assessment": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

-- Document Business Logic Rules
('tf-rule-007', 'document', 'Version Control Automation', 'automation',
 'content_modified = true OR metadata_modified = true',
 'auto_increment_version_and_create_changelog',
 1, true, NULL,
 'update_version_history',
 '{"version_increment_type": "minor", "changelog_auto_generation": true, "backup_previous_version": true}',
 '2025-01-01 08:00:00', '2025-06-20 11:45:00'),

('tf-rule-008', 'document', 'Legal Approval Requirement', 'validation',
 'document_type = "contract" AND status = "final" AND legal_review_status != "approved"',
 'require_legal_department_approval',
 1, true, 'Legal department approval is required before contract finalization.',
 'route_to_legal_department',
 '{"approval_workflow": "legal_department", "required_reviewers": ["legal_counsel", "contract_specialist"], "sla_days": 5}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

-- Activity Business Logic Rules
('tf-rule-009', 'activity', 'Deployment Validation', 'validation',
 'activity_type = "deployment" AND (test_coverage < 80 OR security_scan_status != "passed")',
 'block_deployment_and_require_quality_gates',
 1, true, 'Deployment blocked: minimum test coverage (80%) not met or security scan failed.',
 'create_quality_gate_checklist',
 '{"quality_gates": ["test_coverage", "security_scan", "performance_benchmarks"], "override_authority": "senior_developer"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('tf-rule-010', 'activity', 'Code Review Timeout', 'automation',
 'activity_type = "review" AND created_at < (CURRENT_TIMESTAMP - INTERVAL "48 hours") AND status = "pending"',
 'escalate_review_to_team_lead',
 2, true, NULL,
 'assign_backup_reviewer',
 '{"escalation_chain": ["peer_reviewer", "senior_developer", "team_lead"], "timeout_hours": 48, "auto_assignment": true}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

-- File Business Logic Rules
('tf-rule-011', 'file', 'Code Quality Gate', 'validation',
 'file_type = "source_code" AND (code_quality_score < 80 OR security_scan_status = "failed")',
 'require_code_quality_improvement',
 1, true, 'Code quality standards not met. Please address quality issues before merging.',
 'create_code_quality_improvement_tasks',
 '{"minimum_quality_score": 80, "security_scan_required": true, "automated_fixes": "suggest"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

-- Collection Business Logic Rules
('tf-rule-012', 'collection', 'Dashboard Performance Monitoring', 'automation',
 'collection_type = "dashboard" AND (performance_score < 85 OR load_time > 3000)',
 'optimize_dashboard_performance',
 2, true, NULL,
 'create_performance_optimization_task',
 '{"performance_threshold": 85, "load_time_limit_ms": 3000, "optimization_suggestions": "auto_generate"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00');

-- StartupBoost Business Rules
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_business_rule (
  id, archetype, rule_name, rule_type, condition, action, priority, is_active,
  error_message, success_action, metadata, "createdAt", "updatedAt"
) VALUES 
-- Product Development Rules
('sb-rule-001', 'project', 'Feature Flag Rollout Validation', 'validation',
 'feature_flags_enabled = true AND rollout_percentage > 25 AND test_coverage < 90',
 'require_additional_testing_before_rollout',
 1, true, 'Feature rollout above 25% requires minimum 90% test coverage.',
 'approve_feature_rollout',
 '{"coverage_thresholds": {"25_percent": 80, "50_percent": 85, "100_percent": 90}, "rollback_plan_required": true}',
 '2025-01-01 08:00:00', '2025-07-22 11:30:00'),

('sb-rule-002', 'record', 'Research Statistical Significance', 'validation',
 'record_type = "research" AND statistical_significance = false',
 'require_larger_sample_size_or_longer_duration',
 1, true, 'Research findings lack statistical significance. Consider larger sample size or extended test duration.',
 'approve_research_findings',
 '{"minimum_confidence": 95, "minimum_sample_size": 1000, "significance_threshold": 0.05}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00'),

('sb-rule-003', 'activity', 'Production Deployment Gate', 'validation',
 'environment = "production" AND (security_scan_status != "passed" OR performance_benchmarks_met = false)',
 'block_production_deployment',
 1, true, 'Production deployment blocked: security scan failed or performance benchmarks not met.',
 'approve_production_deployment',
 '{"required_gates": ["security_scan", "performance_test", "integration_test"], "override_authority": "engineering_manager"}',
 '2025-01-01 08:00:00', '2025-01-01 08:00:00');

-- =============================================================================
-- CALCULATED FIELDS - FORMULA-BASED COMPUTED VALUES
-- =============================================================================

-- Calculated Fields for Dynamic Business Metrics
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_calculated_field_metadata (
  entity_type, entity_id, field_name, formula, dependencies, result_value,
  last_calculated, calculation_frequency, created_by, "createdAt", "updatedAt"
) VALUES 
-- Project Health Score Calculation
('project', 'tf-proj-001', 'project_health_score', 
 'ROUND(((code_quality_score * 0.3) + (test_coverage_percentage * 0.3) + (on_time_delivery_score * 0.2) + (client_satisfaction_score * 0.2)), 1)',
 '["code_quality_score", "test_coverage_percentage", "on_time_delivery_score", "client_satisfaction_score"]',
 '91.2', '2025-07-22 14:30:00', 'daily',
 '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', '2025-07-22 14:30:00'),

('project', 'tf-proj-001', 'budget_utilization_percentage',
 'ROUND((actual_cost / budget_amount) * 100, 2)',
 '["actual_cost", "budget_amount"]',
 '78.4', '2025-07-22 14:30:00', 'daily',
 '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', '2025-07-22 14:30:00'),

('project', 'tf-proj-003', 'completion_percentage',
 'ROUND((completed_tasks_count / total_tasks_count) * 100, 1)',
 '["completed_tasks_count", "total_tasks_count"]',
 '67.8', '2025-07-22 14:30:00', 'hourly',
 '0198ab70-1002-7000-8000-000000000001', '2025-05-01 10:00:00', '2025-07-22 14:30:00'),

-- Task Efficiency Metrics
('task', 'tf-task-015', 'effort_efficiency_percentage',
 'ROUND((estimated_hours / GREATEST(actual_hours, 0.1)) * 100, 1)',
 '["estimated_hours", "actual_hours"]',
 '160.0', '2025-07-22 14:30:00', 'on_change',
 '0198ab70-1005-7000-8000-000000000001', '2025-05-15 10:00:00', '2025-07-22 14:30:00'),

('task', 'tf-task-005', 'complexity_vs_effort_ratio',
 'ROUND(complexity_fibonacci / (actual_hours / 8), 2)',
 '["complexity_fibonacci", "actual_hours"]',
 '0.76', '2025-07-22 14:30:00', 'on_completion',
 '0198ab70-1004-7000-8000-000000000001', '2025-03-15 09:00:00', '2025-07-22 14:30:00'),

-- Document Freshness Score
('document', 'tf-doc-004', 'content_freshness_score',
 'ROUND(100 - (EXTRACT(DAYS FROM (CURRENT_DATE - last_updated::date)) * 1.5), 1)',
 '["last_updated"]',
 '94.5', '2025-07-22 14:30:00', 'daily',
 '0198ab70-1002-7000-8000-000000000001', '2025-07-25 14:00:00', '2025-07-22 14:30:00'),

-- Activity Success Rate
('activity', 'tf-activity-001', 'deployment_success_impact',
 'CASE WHEN status = "successful" THEN (performance_improvement_percentage + (zero_downtime::int * 20)) ELSE 0 END',
 '["status", "performance_improvement_percentage", "zero_downtime"]',
 '28', '2025-07-22 14:30:00', 'on_completion',
 '0198ab70-1003-7000-8000-000000000001', '2025-04-30 02:17:00', '2025-07-22 14:30:00');

-- StartupBoost Calculated Fields
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_calculated_field_metadata (
  entity_type, entity_id, field_name, formula, dependencies, result_value,
  last_calculated, calculation_frequency, created_by, "createdAt", "updatedAt"
) VALUES 
-- A/B Test Confidence Score
('project', 'sb-proj-001', 'ab_test_confidence_score',
 'ROUND(((sample_size / 1000) * statistical_confidence * conversion_lift_percentage), 1)',
 '["sample_size", "statistical_confidence", "conversion_lift_percentage"]',
 '285.6', '2025-07-22 14:30:00', 'daily',
 '0198ab70-2008-7000-8000-000000000002', '2025-06-01 09:00:00', '2025-07-22 14:30:00'),

-- Research Impact Score
('record', 'sb-record-003', 'research_business_impact',
 'ROUND((statistical_confidence * engagement_improvement_percentage * sample_size) / 1000, 1)',
 '["statistical_confidence", "engagement_improvement_percentage", "sample_size"]',
 '362.4', '2025-07-22 14:30:00', 'weekly',
 '0198ab70-2008-7000-8000-000000000002', '2025-06-20 17:30:00', '2025-07-22 14:30:00');

-- =============================================================================
-- LOOKUP FIELDS - CROSS-ARCHETYPE REFERENCES
-- =============================================================================

-- Lookup Fields for Cross-Entity References
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_lookup_field_metadata (
  entity_type, entity_id, field_name, target_entity_type, target_field,
  filter_criteria, current_value, lookup_type, created_by, "createdAt", "updatedAt"
) VALUES 
-- Task to Documentation Lookup
('task', 'tf-task-015', 'related_technical_specification', 'record', 'title',
 '{"record_type": "tech_spec", "project_id": "tf-proj-003", "status": "approved"}',
 'RetailCorp Inventory Management System Specification', 'single_select',
 '0198ab70-1005-7000-8000-000000000001', '2025-05-15 10:00:00', '2025-07-20 11:45:00'),

-- Project to Contract Lookup
('project', 'tf-proj-001', 'governing_contract', 'document', 'title',
 '{"document_type": "contract", "status": "executed", "client_name": "RetailCorp Inc"}',
 'RetailCorp E-commerce Development Agreement', 'single_select',
 '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', '2025-02-01 16:30:00'),

-- Task to Implementation Files Lookup
('task', 'tf-task-005', 'implementation_files', 'file', 'filename',
 '{"file_type": "source_code", "language": "typescript", "project_related": true}',
 '["ProductCatalog.tsx", "SearchFilters.tsx", "ProductDetail.tsx"]', 'multi_select',
 '0198ab70-1004-7000-8000-000000000001', '2025-03-15 09:00:00', '2025-03-31 16:45:00'),

-- Record to Implementing Tasks Lookup
('record', 'tf-record-004', 'implementing_tasks', 'task', 'title',
 '{"project_id": "tf-proj-001", "status": ["in_progress", "done"], "relates_to_api": true}',
 '["REST API Development", "Authentication System", "Payment Integration"]', 'multi_select',
 '0198ab70-1003-7000-8000-000000000001', '2025-02-10 14:00:00', '2025-07-22 14:30:00'),

-- Collection to Featured Projects Lookup
('collection', 'tf-collection-003', 'featured_portfolio_projects', 'project', 'name',
 '{"status": ["completed"], "client_satisfaction": ">= 4.5", "showcase_approved": true}',
 '["RetailCorp E-commerce Website", "FinancePlus Mobile App"]', 'multi_select',
 '0198ab70-1002-7000-8000-000000000001', '2025-04-01 11:00:00', '2025-07-20 16:45:00'),

-- Activity to Related Code Reviews Lookup
('activity', 'tf-activity-001', 'pre_deployment_reviews', 'activity', 'id',
 '{"activity_type": "review", "related_to_deployment": true, "approval_status": "approved"}',
 '["tf-activity-004", "tf-activity-006"]', 'multi_select',
 '0198ab70-1003-7000-8000-000000000001', '2025-04-30 02:00:00', '2025-04-30 02:17:00');

-- StartupBoost Lookup Fields
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_lookup_field_metadata (
  entity_type, entity_id, field_name, target_entity_type, target_field,
  filter_criteria, current_value, lookup_type, created_by, "createdAt", "updatedAt"
) VALUES 
-- Research to Product Features Lookup
('record', 'sb-record-003', 'validated_product_features', 'project', 'name',
 '{"product_area": "platform_core", "status": ["active", "completed"], "research_validated": true}',
 '["AI-Powered Analytics Dashboard", "Personalization Engine"]', 'multi_select',
 '0198ab70-2008-7000-8000-000000000002', '2025-06-20 17:30:00', '2025-07-01 10:15:00'),

-- Collection to Success Stories Lookup
('collection', 'sb-collection-002', 'featured_case_studies', 'record', 'title',
 '{"record_type": "case_study", "customer_permission": "granted", "results_quantified": true}',
 '["TechCorp 200% Growth Story", "RetailPlus Efficiency Gains", "StartupX Scaling Success"]', 'multi_select',
 '0198ab70-2007-7000-8000-000000000002', '2025-05-15 11:30:00', '2025-07-20 16:40:00');

-- This completes Phase 4: Cross-Archetype Relationships & Business Logic
-- ✅ Complex entity relationships across all 8 archetype patterns
-- ✅ Business rule validation with conditional logic and workflows
-- ✅ Calculated fields with dynamic business metrics
-- ✅ Lookup fields for cross-archetype references and data integrity

-- SUMMARY: Complete Universal Archetype System Demonstration
-- 🎯 8/8 Archetype Patterns: Project, Task, Record, Document, File, Activity, Discussion, Collection
-- 🏷️ Universal Label System: Hierarchical categorization with business context
-- ⚙️ Universal Option System: Status workflows with business logic and transitions
-- 🔗 Cross-Archetype Relationships: 18+ relationship types demonstrating real business workflows
-- 📊 Custom Fields: 15+ examples with validation rules and business requirements
-- 🧮 Calculated Fields: Dynamic metrics with formula-based calculations
-- 🔍 Lookup Fields: Cross-entity references with filtering and validation
-- ✅ Business Rules: Comprehensive validation logic for all archetype patterns