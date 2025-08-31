-- Enhanced Archetype Examples - Phase 2: Complete Remaining Archetypes
-- Activity, Discussion, and Collection patterns with realistic business workflows

-- =============================================================================
-- ACTIVITY ARCHETYPE EXAMPLES - AUDIT/ACTIVITY LOG ENTRIES
-- =============================================================================

-- TechFlow Agency: Deployment Activities
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_deployment (
  id, project_id, environment, version, deployment_type, status,
  started_at, completed_at, deployed_by, rollback_available, rollback_plan,
  performance_impact, user_impact_assessment, monitoring_alerts_count,
  database_migrations, feature_flags_enabled, post_deployment_checklist,
  "createdAt", "updatedAt"
) VALUES 
('tf-activity-001', 'tf-proj-001', 'production', '2.1.0', 'blue_green', 'successful',
 '2025-04-30 02:00:00', '2025-04-30 02:17:00', '0198ab70-1003-7000-8000-000000000001', true,
 '{"strategy": "blue_green_rollback", "estimated_time": "5 minutes", "data_loss_risk": "none"}',
 '{"response_time": "improved 8%", "memory_usage": "stable", "cpu_usage": "reduced 3%", "database_connections": "optimized"}',
 'Zero downtime deployment with improved performance metrics across all endpoints',
 0, '["001_add_product_indexes.sql", "002_update_user_preferences.sql"]',
 '["enhanced_search", "personalized_recommendations", "advanced_analytics"]',
 '{"ssl_certificate": "verified", "cdn_cache": "cleared", "health_checks": "passing", "monitoring": "active"}',
 '2025-04-30 02:00:00', '2025-04-30 02:17:00'),

('tf-activity-002', 'tf-proj-002', 'production', '1.4.2', 'rolling_update', 'successful',
 '2025-07-15 03:30:00', '2025-07-15 03:52:00', '0198ab70-1003-7000-8000-000000000001', true,
 '{"strategy": "rolling_rollback", "estimated_time": "8 minutes", "data_loss_risk": "minimal"}',
 '{"api_latency": "reduced 12%", "mobile_app_crashes": "eliminated", "battery_usage": "improved 15%"}',
 'Critical security patches applied with significant performance improvements for mobile users',
 2, '["003_security_audit_log.sql", "004_session_management_update.sql"]',
 '["enhanced_security", "biometric_improvements", "session_optimization"]',
 '{"penetration_test": "passed", "compliance_scan": "clean", "user_acceptance": "positive"}',
 '2025-07-15 03:30:00', '2025-07-15 03:52:00'),

('tf-activity-003', 'tf-proj-003', 'staging', '0.8.1', 'direct_deployment', 'failed',
 '2025-07-20 14:15:00', '2025-07-20 14:23:00', '0198ab70-1005-7000-8000-000000000001', true,
 '{"strategy": "git_revert", "estimated_time": "2 minutes", "data_loss_risk": "none"}',
 '{"response_time": "degraded 45%", "error_rate": "increased to 8%", "websocket_connections": "unstable"}',
 'Deployment failed due to WebSocket connection issues, immediately rolled back',
 15, '["005_inventory_realtime_schema.sql"]',
 '["real_time_inventory", "websocket_notifications"]',
 '{"rollback_executed": "yes", "root_cause": "websocket_config_error", "fix_eta": "2 hours"}',
 '2025-07-20 14:15:00', '2025-07-20 14:23:00');

-- TechFlow Agency: Code Review Activities
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_review (
  id, pull_request_id, repository, reviewer, review_type, status,
  started_at, completed_at, lines_reviewed, files_changed, issues_found,
  approval_given, feedback_summary, security_concerns, performance_notes,
  code_quality_score, test_coverage_impact, recommendations,
  "createdAt", "updatedAt"
) VALUES 
('tf-activity-004', 'PR-456', 'retailcorp-ecommerce', '0198ab70-1003-7000-8000-000000000001', 'security_review', 'approved',
 '2025-03-25 09:00:00', '2025-03-25 11:15:00', 342, 8, 3,
 true, 'Minor SQL injection prevention improvements needed in search functionality',
 '["input_validation_enhancement", "sql_parameterization", "xss_prevention"]',
 'No significant performance concerns, query optimization suggestions provided',
 87, '+5%', '["Add input sanitization library", "Implement prepared statements", "Add security unit tests"]',
 '2025-03-25 09:00:00', '2025-03-25 11:15:00'),

('tf-activity-005', 'PR-789', 'retailcorp-inventory', '0198ab70-1004-7000-8000-000000000001', 'architecture_review', 'changes_requested',
 '2025-07-18 14:30:00', '2025-07-18 16:45:00', 567, 12, 8,
 false, 'WebSocket implementation needs refactoring for better scalability and error handling',
 '["connection_pooling", "authentication_validation"]',
 'Memory leak potential in WebSocket connection management, recommend connection pooling',
 72, '-2%', '["Implement connection pooling", "Add WebSocket error handling", "Optimize memory usage", "Add load testing"]',
 '2025-07-18 14:30:00', '2025-07-18 16:45:00'),

('tf-activity-006', 'PR-234', 'financeplus-mobile', '0198ab70-1006-7000-8000-000000000001', 'compliance_review', 'approved',
 '2025-06-10 10:00:00', '2025-06-10 12:30:00', 234, 5, 1,
 true, 'PCI DSS compliance requirements met, minor documentation update needed',
 '["data_encryption_verified", "secure_storage_confirmed"]',
 'Biometric authentication implementation follows security best practices',
 94, '+3%', '["Update compliance documentation", "Add security test coverage"]',
 '2025-06-10 10:00:00', '2025-06-10 12:30:00');

-- StartupBoost Inc: Testing Activities
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_testing (
  id, test_suite, test_type, environment, status, started_at, completed_at,
  tests_total, tests_passed, tests_failed, tests_skipped, coverage_percentage,
  performance_benchmarks, bug_reports_created, critical_issues,
  regression_detected, automation_percentage, "createdAt", "updatedAt"
) VALUES 
('sb-activity-001', 'platform-integration-tests', 'integration', 'staging', 'completed',
 '2025-07-18 14:00:00', '2025-07-18 17:45:00', 1247, 1235, 9, 3, 89.7,
 '{"api_response_avg": "118ms", "db_query_avg": "42ms", "page_load_avg": "1.8s", "memory_usage": "stable"}',
 4, 1, false, 87,
 '2025-07-18 14:00:00', '2025-07-18 17:45:00'),

('sb-activity-002', 'mobile-app-e2e-tests', 'end_to_end', 'production_mirror', 'completed',
 '2025-07-20 20:00:00', '2025-07-20 23:30:00', 456, 451, 5, 0, 94.2,
 '{"app_startup": "1.9s", "screen_transitions": "smooth_60fps", "offline_sync": "functional", "battery_drain": "optimized"}',
 2, 0, false, 92,
 '2025-07-20 20:00:00', '2025-07-20 23:30:00'),

('sb-activity-003', 'security-penetration-test', 'security', 'staging', 'in_progress',
 '2025-07-22 09:00:00', NULL, 89, 67, 0, 22, 75.3,
 '{"vulnerability_scan": "in_progress", "auth_testing": "passed", "data_encryption": "verified"}',
 0, 0, false, 45,
 '2025-07-22 09:00:00', '2025-07-22 09:00:00');

-- =============================================================================
-- DISCUSSION ARCHETYPE EXAMPLES - THREADED CONVERSATIONS
-- =============================================================================

-- TechFlow Agency: Announcement Discussions
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_announcement (
  id, title, announcement_type, priority, content, posted_by, posted_at,
  expires_at, target_audience, acknowledgment_required, acknowledgment_count,
  discussion_enabled, pin_status, category, engagement_metrics,
  "createdAt", "updatedAt"
) VALUES 
('tf-discussion-001', 'Major Client Win: RetailCorp Partnership Secured!', 'company_news', 'high',
 'Thrilled to announce our largest contract to date! TechFlow has been selected by RetailCorp for a complete e-commerce platform transformation. This $125K project showcases our full-stack capabilities and positions us for enterprise growth. Congratulations to the entire sales and technical team who made this possible. Project kickoff is February 1st.',
 '0198ab70-1001-7000-8000-000000000001', '2025-01-28 16:00:00', '2025-02-15 23:59:59',
 'all_company', false, 18, true, 'pinned', 'major_wins',
 '{"views": 45, "reactions": 23, "comments": 8, "shares": 5}',
 '2025-01-28 16:00:00', '2025-01-30 10:15:00'),

('tf-discussion-002', 'New Development Standards: TypeScript and Testing Requirements', 'policy_update', 'medium',
 'Effective immediately, all new projects must use TypeScript and maintain minimum 80% test coverage. This aligns with our quality goals and client expectations. Resources and training materials are available in the knowledge base. Questions welcome in the engineering channel.',
 '0198ab70-1003-7000-8000-000000000001', '2025-03-01 09:00:00', '2025-04-01 23:59:59',
 'engineering_team', true, 12, true, 'active', 'development_standards',
 '{"views": 34, "reactions": 19, "comments": 12, "acknowledgments": 12}',
 '2025-03-01 09:00:00', '2025-03-15 14:30:00'),

('tf-discussion-003', 'Q2 Company Retreat Planning - Location Voting', 'event_planning', 'medium',
 'Time to plan our Q2 retreat! We\'ve narrowed it down to three locations: Mountain Resort (team building focus), Beach Resort (relaxation focus), or City Conference Center (learning focus). Please vote and share your preferences. Looking forward to some quality team time!',
 '0198ab70-1002-7000-8000-000000000001', '2025-05-15 11:00:00', '2025-06-01 23:59:59',
 'all_company', false, 23, true, 'active', 'company_events',
 '{"views": 67, "reactions": 31, "comments": 18, "poll_votes": 23}',
 '2025-05-15 11:00:00', '2025-05-20 09:45:00');

-- TechFlow Agency: Forum Thread Discussions
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_forum_thread (
  id, category, title, original_post, created_by, created_at, last_activity,
  reply_count, participant_count, is_resolved, solution_post_id, tags,
  view_count, upvote_count, difficulty_level, "createdAt", "updatedAt"
) VALUES 
('tf-discussion-004', 'technical_discussion', 'Best Practices: React State Management in Large Applications',
 'Looking for team input on standardizing our React state management approach. For the RetailCorp project, should we go with Redux Toolkit, Zustand, or stick with React Query + useState? Consider: learning curve, team familiarity, project complexity, and maintainability. What has worked well for others on similar projects?',
 '0198ab70-1004-7000-8000-000000000001', '2025-03-10 11:30:00', '2025-03-15 16:20:00',
 12, 6, true, 'reply-tf-456', '["react", "state-management", "redux", "zustand", "react-query", "architecture"]',
 67, 23, 'intermediate',
 '2025-03-10 11:30:00', '2025-03-15 16:20:00'),

('tf-discussion-005', 'knowledge_sharing', 'Database Optimization Techniques for High-Traffic E-commerce',
 'Sharing some insights from the RetailCorp performance optimization work. Key learnings: 1) Database indexing strategy made 40% improvement, 2) Connection pooling crucial for concurrent users, 3) Redis caching reduced query load by 60%. Full writeup and SQL examples in the thread. What optimization techniques have you found most effective?',
 '0198ab70-1003-7000-8000-000000000001', '2025-04-20 14:00:00', '2025-04-25 11:45:00',
 8, 5, false, NULL, '["database", "optimization", "performance", "postgresql", "redis", "e-commerce"]',
 89, 34, 'advanced',
 '2025-04-20 14:00:00', '2025-04-25 11:45:00'),

('tf-discussion-006', 'client_feedback', 'RetailCorp Project: Client Feedback and Lessons Learned',
 'Now that RetailCorp phase 1 is complete, sharing key client feedback and lessons learned: 1) Weekly demos were highly valued, 2) Documentation quality exceeded expectations, 3) Mobile-first approach was crucial, 4) Security review process built strong trust. What should we replicate for future client projects?',
 '0198ab70-1002-7000-8000-000000000001', '2025-05-01 10:00:00', '2025-05-03 15:30:00',
 15, 8, true, 'reply-tf-789', '["client-feedback", "project-management", "best-practices", "lessons-learned"]',
 45, 18, 'beginner',
 '2025-05-01 10:00:00', '2025-05-03 15:30:00');

-- StartupBoost Inc: Support Thread Discussions
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_support_thread (
  id, ticket_id, priority, issue_category, title, description, reported_by,
  assigned_to, status, created_at, resolved_at, escalation_level,
  customer_satisfaction, resolution_summary, affected_users_count,
  workaround_provided, "createdAt", "updatedAt"
) VALUES 
('sb-discussion-001', 'TICKET-1001', 'urgent', 'platform_outage', 'Analytics Dashboard Completely Inaccessible for Enterprise Users',
 'Multiple enterprise customers reporting complete inability to access analytics dashboard. Error message: "Service temporarily unavailable". This affects approximately 300+ users across 15 enterprise accounts. Issue started at 2:30 PM EST. Revenue impact estimated at $50K+ if not resolved quickly.',
 '0198ab70-2010-7000-8000-000000000002', '0198ab70-2005-7000-8000-000000000002', 'resolved',
 '2025-07-15 14:30:00', '2025-07-15 16:45:00', 3,
 4.2, 'Database connection pool exhaustion resolved by increasing max connections from 50 to 150 and implementing connection queuing',
 312, false,
 '2025-07-15 14:30:00', '2025-07-15 16:45:00'),

('sb-discussion-002', 'TICKET-1002', 'high', 'performance_issue', 'Mobile App Extremely Slow on Android Devices',
 'Users reporting 10+ second load times on Android devices, particularly older models (Android 8-10). iOS performance remains normal. Affects approximately 40% of mobile user base. Users are abandoning sessions due to poor performance.',
 '0198ab70-2009-7000-8000-000000000002', '0198ab70-2004-7000-8000-000000000002', 'in_progress',
 '2025-07-20 09:15:00', NULL, 2,
 NULL, NULL, 1247, true,
 '2025-07-20 09:15:00', '2025-07-22 11:30:00'),

('sb-discussion-003', 'TICKET-1003', 'medium', 'feature_request', 'Bulk Data Export Functionality for Enterprise Customers',
 'Enterprise customers requesting ability to export large datasets (>100K records) in multiple formats (CSV, Excel, JSON). Current export limit of 10K records insufficient for enterprise analytics workflows. 8 enterprise accounts have specifically requested this enhancement.',
 '0198ab70-2011-7000-8000-000000000002', '0198ab70-2005-7000-8000-000000000002', 'planned',
 '2025-07-18 13:45:00', NULL, 1,
 NULL, 'Feature planned for Q4 2025 release with background job processing for large exports',
 8, false,
 '2025-07-18 13:45:00', '2025-07-22 10:15:00');

-- =============================================================================
-- COLLECTION ARCHETYPE EXAMPLES - GROUPED ENTITY CONTAINERS
-- =============================================================================

-- TechFlow Agency: Project Dashboard Collections
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_dashboard (
  id, title, dashboard_type, visibility, owner, created_at, last_updated,
  widget_count, data_sources, refresh_interval_minutes, shared_with,
  usage_analytics, performance_score, customization_level, "createdAt", "updatedAt"
) VALUES 
('tf-collection-001', 'RetailCorp Project Command Center', 'project_dashboard', 'team',
 '0198ab70-1002-7000-8000-000000000001', '2025-02-01 10:00:00', '2025-07-22 14:30:00',
 15, '["jira", "github", "google_analytics", "time_tracking", "slack", "deployment_status"]',
 5, '["project_team", "client_stakeholders", "management"]',
 '{"daily_views": 67, "avg_session_duration": "12_minutes", "most_used_widget": "project_progress"}',
 96, 'high',
 '2025-02-01 10:00:00', '2025-07-22 14:30:00'),

('tf-collection-002', 'Engineering Metrics Overview', 'team_dashboard', 'department',
 '0198ab70-1003-7000-8000-000000000001', '2025-03-01 08:00:00', '2025-07-22 09:15:00',
 12, '["github", "sonarqube", "jenkins", "test_coverage", "code_quality"]',
 15, '["engineering_team", "engineering_manager", "cto"]',
 '{"daily_views": 34, "avg_session_duration": "8_minutes", "most_used_widget": "code_quality_trends"}',
 89, 'medium',
 '2025-03-01 08:00:00', '2025-07-22 09:15:00'),

('tf-collection-003', 'Client Portfolio Showcase', 'portfolio_dashboard', 'public',
 '0198ab70-1002-7000-8000-000000000001', '2025-04-01 11:00:00', '2025-07-20 16:45:00',
 8, '["portfolio_projects", "client_testimonials", "case_studies", "technology_stack"]',
 60, '["all_company", "sales_team", "potential_clients"]',
 '{"monthly_views": 234, "avg_session_duration": "6_minutes", "conversion_rate": "12%"}',
 92, 'low',
 '2025-04-01 11:00:00', '2025-07-20 16:45:00');

-- TechFlow Agency: Knowledge Base Collections
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_knowledge_base (
  id, title, category, visibility, maintainer, article_count, last_updated,
  search_enabled, version_control, access_analytics, content_freshness_score,
  user_rating, collaboration_enabled, taxonomy_tags, "createdAt", "updatedAt"
) VALUES 
('tf-collection-004', 'TechFlow Development Standards & Best Practices', 'technical_standards', 'internal',
 '0198ab70-1003-7000-8000-000000000001', 67, '2025-07-22',
 true, true, '{"monthly_searches": 456, "popular_articles": ["typescript_standards", "testing_guidelines", "security_checklist"]}',
 94, 4.7, true, '["development", "standards", "best-practices", "guidelines", "security"]',
 '2025-01-15 10:00:00', '2025-07-22 11:30:00'),

('tf-collection-005', 'Client Onboarding & Project Management Hub', 'business_process', 'internal',
 '0198ab70-1002-7000-8000-000000000001', 34, '2025-07-20',
 true, true, '{"monthly_searches": 123, "popular_articles": ["client_kickoff_checklist", "project_communication_templates"]}',
 89, 4.4, true, '["client-management", "project-management", "templates", "processes"]',
 '2025-02-01 09:00:00', '2025-07-20 15:20:00'),

('tf-collection-006', 'Technology Research & Innovation Lab', 'research_development', 'internal',
 '0198ab70-1004-7000-8000-000000000001', 23, '2025-07-18',
 true, true, '{"monthly_searches": 89, "popular_articles": ["react_18_features", "postgresql_optimization", "aws_cost_optimization"]}',
 91, 4.5, true, '["research", "innovation", "technology", "experiments", "poc"]',
 '2025-03-15 14:00:00', '2025-07-18 13:45:00');

-- StartupBoost Inc: Portfolio Collections
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_portfolio (
  id, title, portfolio_type, description, curated_by, item_count,
  creation_date, last_modified, visibility, tags, featured_items,
  analytics_enabled, collaboration_level, success_metrics, "createdAt", "updatedAt"
) VALUES 
('sb-collection-001', 'StartupBoost Product Feature Showcase', 'product_portfolio',
 'Comprehensive showcase of our platform capabilities, customer success stories, and innovative features that drive business growth',
 '0198ab70-2003-7000-8000-000000000002', 28, '2025-06-01', '2025-07-22',
 'public', '["product", "features", "showcase", "customer_success", "innovation"]',
 '["ai_analytics_dashboard", "real_time_collaboration", "mobile_app", "enterprise_integrations"]',
 true, 'collaborative', '{"monthly_views": 1247, "lead_generation": 23, "demo_requests": 8}',
 '2025-06-01 10:00:00', '2025-07-22 14:15:00'),

('sb-collection-002', 'Customer Success Stories & Case Studies', 'case_study_portfolio',
 'Real-world success stories demonstrating how StartupBoost transforms business operations and drives growth for companies of all sizes',
 '0198ab70-2007-7000-8000-000000000002', 15, '2025-05-15', '2025-07-20',
 'public', '["case-studies", "success-stories", "roi", "testimonials", "growth"]',
 '["techcorp_200_percent_growth", "retailplus_efficiency_gains", "startupx_scaling_success"]',
 true, 'curated', '{"monthly_views": 567, "sales_qualified_leads": 12, "conversion_rate": "8.2%"}',
 '2025-05-15 11:30:00', '2025-07-20 16:40:00'),

('sb-collection-003', 'Developer Resources & Integration Guides', 'developer_portfolio',
 'Complete developer documentation, API guides, SDK resources, and integration examples for technical teams implementing StartupBoost',
 '0198ab70-2005-7000-8000-000000000002', 42, '2025-04-01', '2025-07-22',
 'public', '["developer", "api", "sdk", "integration", "documentation", "examples"]',
 '["rest_api_guide", "webhook_implementation", "sdk_quickstart", "authentication_examples"]',
 true, 'open_source', '{"monthly_downloads": 2340, "github_stars": 156, "community_contributions": 23}',
 '2025-04-01 13:00:00', '2025-07-22 10:30:00');

-- This completes the remaining 3 archetype patterns:
-- ✅ Activity Archetype: Deployments, reviews, testing with detailed workflow tracking
-- ✅ Discussion Archetype: Announcements, forums, support threads with engagement metrics  
-- ✅ Collection Archetype: Dashboards, knowledge bases, portfolios with analytics

-- Next: Universal systems integration (labels, options, custom fields)