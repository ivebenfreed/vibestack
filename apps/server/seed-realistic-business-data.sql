-- Seed Realistic Business Data for Multi-Tenant Testing
-- Creates realistic projects, tasks, comments, and time entries for both organizations

-- =============================================================================
-- TECHFLOW AGENCY - REALISTIC DIGITAL AGENCY DATA
-- =============================================================================

-- TechFlow Agency Projects
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_project (id, name, description, status, priority, client_name, start_date, end_date, budget_hours, "createdAt", "updatedAt") VALUES 
-- Completed Projects
('tf-proj-001', 'RetailCorp E-commerce Website', 'Complete e-commerce platform redesign with modern UI/UX and performance optimization', 'completed', 'high', 'RetailCorp Inc', '2025-02-01', '2025-04-30', 480, NOW() - INTERVAL '120 days', NOW() - INTERVAL '30 days'),
('tf-proj-002', 'FinancePlus Mobile App', 'iOS and Android mobile banking application with biometric authentication', 'completed', 'urgent', 'FinancePlus Bank', '2025-01-15', '2025-07-15', 720, NOW() - INTERVAL '135 days', NOW() - INTERVAL '45 days'),

-- Active Projects  
('tf-proj-003', 'RetailCorp Inventory System', 'Backend API and admin dashboard for inventory management', 'active', 'high', 'RetailCorp Inc', '2025-05-01', '2025-08-31', 360, NOW() - INTERVAL '75 days', NOW() - INTERVAL '1 day'),
('tf-proj-004', 'TechFlow Agency Website Refresh', 'Internal company website redesign and blog platform', 'active', 'medium', 'Internal', '2025-06-01', '2025-09-30', 200, NOW() - INTERVAL '45 days', NOW() - INTERVAL '2 days'),

-- Upcoming Projects
('tf-proj-005', 'FinancePlus Analytics Dashboard', 'Real-time analytics and reporting dashboard for financial data', 'planning', 'medium', 'FinancePlus Bank', '2025-09-01', '2025-12-31', 400, NOW() - INTERVAL '10 days', NOW());

-- TechFlow Agency Tasks for E-commerce Website (Completed)
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_task (id, project_id, title, description, status, priority, assigned_to, estimated_hours, actual_hours, due_date, "createdAt", "updatedAt") VALUES 
-- Design Phase
('tf-task-001', 'tf-proj-001', 'User Experience Research & Analysis', 'Conduct user interviews, analyze current site analytics, create user personas', 'done', 'high', '0198ab70-1002-7000-8000-000000000001', 40, 45, '2025-02-15', NOW() - INTERVAL '118 days', NOW() - INTERVAL '105 days'),
('tf-task-002', 'tf-proj-001', 'Wireframe & Mockup Creation', 'Create detailed wireframes and high-fidelity mockups for all key pages', 'done', 'high', '0198ab70-1002-7000-8000-000000000001', 60, 58, '2025-02-28', NOW() - INTERVAL '115 days', NOW() - INTERVAL '95 days'),
('tf-task-003', 'tf-proj-001', 'Design System & Style Guide', 'Establish comprehensive design system with components and guidelines', 'done', 'medium', '0198ab70-1002-7000-8000-000000000001', 32, 35, '2025-03-10', NOW() - INTERVAL '110 days', NOW() - INTERVAL '85 days'),

-- Development Phase
('tf-task-004', 'tf-proj-001', 'Frontend Framework Setup', 'Initialize React/Next.js project with TypeScript, ESLint, and build tools', 'done', 'medium', '0198ab70-1004-7000-8000-000000000001', 16, 18, '2025-03-15', NOW() - INTERVAL '105 days', NOW() - INTERVAL '90 days'),
('tf-task-005', 'tf-proj-001', 'Product Catalog Implementation', 'Build dynamic product listing, filtering, search, and detail pages', 'done', 'high', '0198ab70-1004-7000-8000-000000000001', 80, 85, '2025-03-31', NOW() - INTERVAL '100 days', NOW() - INTERVAL '75 days'),
('tf-task-006', 'tf-proj-001', 'Shopping Cart & Checkout Flow', 'Implement cart functionality, checkout process, and payment integration', 'done', 'urgent', '0198ab70-1005-7000-8000-000000000001', 72, 78, '2025-04-10', NOW() - INTERVAL '90 days', NOW() - INTERVAL '65 days'),
('tf-task-007', 'tf-proj-001', 'User Authentication System', 'Build secure login, registration, password reset, and profile management', 'done', 'high', '0198ab70-1006-7000-8000-000000000001', 48, 52, '2025-04-15', NOW() - INTERVAL '85 days', NOW() - INTERVAL '60 days'),
('tf-task-008', 'tf-proj-001', 'Admin Dashboard Development', 'Create admin interface for product management, orders, and analytics', 'done', 'medium', '0198ab70-1005-7000-8000-000000000001', 64, 68, '2025-04-20', NOW() - INTERVAL '80 days', NOW() - INTERVAL '55 days'),

-- Testing & Launch
('tf-task-009', 'tf-proj-001', 'Cross-browser Testing & Bug Fixes', 'Comprehensive testing across browsers, devices, and accessibility compliance', 'done', 'high', '0198ab70-1006-7000-8000-000000000001', 40, 42, '2025-04-25', NOW() - INTERVAL '70 days', NOW() - INTERVAL '45 days'),
('tf-task-010', 'tf-proj-001', 'Performance Optimization', 'Optimize loading times, implement caching, compress assets', 'done', 'medium', '0198ab70-1004-7000-8000-000000000001', 24, 28, '2025-04-28', NOW() - INTERVAL '65 days', NOW() - INTERVAL '40 days'),
('tf-task-011', 'tf-proj-001', 'Production Deployment & Launch', 'Deploy to production, configure CDN, monitor launch metrics', 'done', 'urgent', '0198ab70-1003-7000-8000-000000000001', 16, 20, '2025-04-30', NOW() - INTERVAL '60 days', NOW() - INTERVAL '35 days');

-- TechFlow Agency Tasks for Inventory System (Active)
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_task (id, project_id, title, description, status, priority, assigned_to, estimated_hours, actual_hours, due_date, "createdAt", "updatedAt") VALUES 
-- Backend Development
('tf-task-012', 'tf-proj-003', 'Database Schema Design', 'Design normalized database schema for inventory tracking with audit trails', 'done', 'high', '0198ab70-1003-7000-8000-000000000001', 24, 26, '2025-05-15', NOW() - INTERVAL '70 days', NOW() - INTERVAL '65 days'),
('tf-task-013', 'tf-proj-003', 'REST API Development', 'Build comprehensive REST API for inventory CRUD operations', 'done', 'high', '0198ab70-1005-7000-8000-000000000001', 48, 45, '2025-06-01', NOW() - INTERVAL '65 days', NOW() - INTERVAL '55 days'),
('tf-task-014', 'tf-proj-003', 'Authentication & Authorization', 'Implement JWT-based auth with role-based access control', 'done', 'high', '0198ab70-1006-7000-8000-000000000001', 32, 35, '2025-06-10', NOW() - INTERVAL '55 days', NOW() - INTERVAL '45 days'),
('tf-task-015', 'tf-proj-003', 'Real-time Inventory Updates', 'WebSocket integration for live inventory level notifications', 'in_progress', 'medium', '0198ab70-1005-7000-8000-000000000001', 40, 25, '2025-07-15', NOW() - INTERVAL '45 days', NOW() - INTERVAL '1 day'),
('tf-task-016', 'tf-proj-003', 'Admin Dashboard Frontend', 'React-based admin interface for inventory management', 'in_progress', 'high', '0198ab70-1004-7000-8000-000000000001', 56, 30, '2025-07-30', NOW() - INTERVAL '40 days', NOW() - INTERVAL '2 days'),
('tf-task-017', 'tf-proj-003', 'Reporting & Analytics Module', 'Generate inventory reports, low stock alerts, trend analysis', 'todo', 'medium', '0198ab70-1004-7000-8000-000000000001', 36, 0, '2025-08-15', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
('tf-task-018', 'tf-proj-003', 'API Documentation', 'Comprehensive API documentation with Swagger/OpenAPI', 'todo', 'low', '0198ab70-1003-7000-8000-000000000001', 16, 0, '2025-08-20', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days');

-- =============================================================================
-- STARTUPBOOST INC - REALISTIC SAAS STARTUP DATA  
-- =============================================================================

-- StartupBoost Inc Projects (Product Development Focus)
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_project (id, name, description, status, priority, product_area, sprint_number, start_date, end_date, story_points, "createdAt", "updatedAt") VALUES 
-- Completed Sprints
('sb-proj-001', 'User Onboarding Flow V2', 'Redesigned user registration and initial setup experience', 'completed', 'high', 'frontend', 12, '2025-04-01', '2025-04-14', 21, NOW() - INTERVAL '105 days', NOW() - INTERVAL '95 days'),
('sb-proj-002', 'API Rate Limiting Implementation', 'Implement Redis-based rate limiting for API protection', 'completed', 'high', 'backend', 13, '2025-04-15', '2025-04-28', 13, NOW() - INTERVAL '95 days', NOW() - INTERVAL '85 days'),
('sb-proj-003', 'Mobile App MVP Launch', 'React Native mobile app with core features for iOS and Android', 'completed', 'urgent', 'mobile', 14, '2025-05-01', '2025-05-28', 34, NOW() - INTERVAL '85 days', NOW() - INTERVAL '75 days'),

-- Active Sprints
('sb-proj-004', 'Advanced Analytics Dashboard', 'Real-time user analytics with custom metrics and visualization', 'active', 'high', 'frontend', 15, '2025-06-01', '2025-06-21', 25, NOW() - INTERVAL '75 days', NOW() - INTERVAL '5 days'),
('sb-proj-005', 'Machine Learning Recommendation Engine', 'AI-powered content recommendation system', 'active', 'urgent', 'backend', 16, '2025-06-15', '2025-07-12', 40, NOW() - INTERVAL '60 days', NOW() - INTERVAL '3 days'),
('sb-proj-006', 'Enterprise SSO Integration', 'SAML and OAuth2 integration for enterprise customers', 'active', 'high', 'backend', 17, '2025-07-01', '2025-07-25', 30, NOW() - INTERVAL '45 days', NOW() - INTERVAL '1 day'),

-- Planned Sprints
('sb-proj-007', 'Performance Optimization Sprint', 'Database query optimization and caching improvements', 'planning', 'medium', 'backend', 18, '2025-08-01', '2025-08-22', 18, NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days'),
('sb-proj-008', 'Marketing Automation Platform', 'Email campaigns, user segmentation, and A/B testing tools', 'planning', 'medium', 'marketing', 19, '2025-08-15', '2025-09-15', 45, NOW() - INTERVAL '10 days', NOW());

-- StartupBoost Inc Tasks for Analytics Dashboard (Active Sprint)
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_task (id, project_id, title, description, status, priority, assigned_to, story_points, estimated_hours, actual_hours, epic_tag, feature_flag, due_date, "createdAt", "updatedAt") VALUES 
-- Frontend Tasks
('sb-task-001', 'sb-proj-004', 'Dashboard Layout & Navigation', 'Create responsive dashboard layout with collapsible sidebar navigation', 'done', 'high', '0198ab70-2006-7000-8000-000000000002', 5, 20, 22, 'analytics_v2', 'dashboard_v2', '2025-06-05', NOW() - INTERVAL '70 days', NOW() - INTERVAL '65 days'),
('sb-task-002', 'sb-proj-004', 'Real-time Metrics Components', 'Build reusable chart components for displaying live metrics', 'done', 'high', '0198ab70-2006-7000-8000-000000000002', 8, 32, 35, 'analytics_v2', 'realtime_charts', '2025-06-10', NOW() - INTERVAL '65 days', NOW() - INTERVAL '60 days'),
('sb-task-003', 'sb-proj-004', 'Custom Date Range Picker', 'Advanced date range selection with presets and custom ranges', 'done', 'medium', '0198ab70-2007-7000-8000-000000000002', 3, 12, 14, 'analytics_v2', 'date_picker_v2', '2025-06-12', NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days'),
('sb-task-004', 'sb-proj-004', 'Data Export Functionality', 'Export dashboard data to CSV, PDF, and Excel formats', 'in_progress', 'medium', '0198ab70-2008-7000-8000-000000000002', 5, 20, 12, 'analytics_v2', 'data_export', '2025-06-18', NOW() - INTERVAL '55 days', NOW() - INTERVAL '2 days'),
('sb-task-005', 'sb-proj-004', 'Dashboard Customization', 'Allow users to customize dashboard layout and metrics', 'todo', 'low', '0198ab70-2006-7000-8000-000000000002', 4, 16, 0, 'analytics_v2', 'dashboard_custom', '2025-06-21', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days');

-- Backend Tasks for ML Recommendation Engine
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_task (id, project_id, title, description, status, priority, assigned_to, story_points, estimated_hours, actual_hours, epic_tag, feature_flag, due_date, "createdAt", "updatedAt") VALUES 
('sb-task-006', 'sb-proj-005', 'Data Pipeline Architecture', 'Design and implement data pipeline for ML model training', 'done', 'urgent', '0198ab70-2005-7000-8000-000000000002', 8, 32, 38, 'ml_recommendations', 'ml_pipeline', '2025-06-25', NOW() - INTERVAL '55 days', NOW() - INTERVAL '45 days'),
('sb-task-007', 'sb-proj-005', 'Feature Engineering Module', 'Extract and transform user behavior features for model training', 'done', 'high', '0198ab70-2009-7000-8000-000000000002', 13, 52, 55, 'ml_recommendations', 'feature_eng', '2025-07-02', NOW() - INTERVAL '45 days', NOW() - INTERVAL '35 days'),
('sb-task-008', 'sb-proj-005', 'Model Training & Validation', 'Train collaborative filtering model with cross-validation', 'in_progress', 'urgent', '0198ab70-2005-7000-8000-000000000002', 10, 40, 25, 'ml_recommendations', 'model_training', '2025-07-08', NOW() - INTERVAL '35 days', NOW() - INTERVAL '1 day'),
('sb-task-009', 'sb-proj-005', 'Real-time Prediction API', 'REST API for serving real-time recommendations', 'in_progress', 'high', '0198ab70-2010-7000-8000-000000000002', 6, 24, 15, 'ml_recommendations', 'prediction_api', '2025-07-10', NOW() - INTERVAL '30 days', NOW() - INTERVAL '3 days'),
('sb-task-010', 'sb-proj-005', 'A/B Testing Framework', 'Framework for testing recommendation algorithm performance', 'todo', 'medium', '0198ab70-2011-7000-8000-000000000002', 3, 12, 0, 'ml_recommendations', 'ab_testing', '2025-07-12', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days');

-- Verification Query
SELECT 
  SUBSTRING(table_name FROM 'org_([^_]+_[^_]+_[^_]+_[^_]+_[^_]+)_') as org_id,
  COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_name LIKE 'org_%'
  AND table_name ~ 'org_0198ab70_[12]000_7000_8000_00000000000[12]_'
GROUP BY org_id
ORDER BY org_id;