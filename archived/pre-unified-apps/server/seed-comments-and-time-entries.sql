-- Seed Realistic Comments and Time Entries for Multi-Tenant Testing
-- Adds realistic task comments and time tracking data

-- =============================================================================
-- TECHFLOW AGENCY - TASK COMMENTS (CLIENT INTERACTIONS & TEAM COLLABORATION)
-- =============================================================================

-- Comments for E-commerce Website Project (Completed)
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_task_comment (id, task_id, author_id, content, comment_type, "createdAt") VALUES 
-- UX Research Comments
('tf-comment-001', 'tf-task-001', '0198ab70-1002-7000-8000-000000000001', 'Initial user interviews completed. Key finding: users find current navigation confusing, especially on mobile. Recommend simplified menu structure.', 'status_update', NOW() - INTERVAL '115 days'),
('tf-comment-002', 'tf-task-001', '0198ab70-1007-7000-8000-000000000001', 'Great insights! The mobile navigation issue aligns with our customer service feedback. Priority should be on tablet experience too.', 'client_feedback', NOW() - INTERVAL '114 days'),
('tf-comment-003', 'tf-task-001', '0198ab70-1002-7000-8000-000000000001', '@jennifer.davis Absolutely! Added tablet wireframes to next deliverable. Also discovered checkout abandonment happens at payment step - investigating.', 'general', NOW() - INTERVAL '113 days'),

-- Wireframe & Design Comments
('tf-comment-004', 'tf-task-002', '0198ab70-1002-7000-8000-000000000001', 'Wireframes v1 uploaded to shared drive. Focus on simplified checkout flow and improved product discovery.', 'status_update', NOW() - INTERVAL '112 days'),
('tf-comment-005', 'tf-task-002', '0198ab70-1001-7000-8000-000000000001', 'Wireframes look great! Love the visual hierarchy improvements. Can we add a "recently viewed" section to product pages?', 'general', NOW() - INTERVAL '111 days'),
('tf-comment-006', 'tf-task-002', '0198ab70-1007-7000-8000-000000000001', 'The new checkout flow is much cleaner. Question: will guest checkout be available? Our customers frequently request this.', 'client_feedback', NOW() - INTERVAL '110 days'),
('tf-comment-007', 'tf-task-002', '0198ab70-1002-7000-8000-000000000001', 'Yes, guest checkout is included in phase 1. Added mockups for that flow. @sarah.chen please review before client presentation.', 'general', NOW() - INTERVAL '109 days'),

-- Development Phase Comments
('tf-comment-008', 'tf-task-005', '0198ab70-1004-7000-8000-000000000001', 'Product catalog API integration complete. Performance looks good - page loads under 2 seconds with 1000+ products.', 'status_update', NOW() - INTERVAL '95 days'),
('tf-comment-009', 'tf-task-005', '0198ab70-1003-7000-8000-000000000001', 'Excellent performance! Make sure to implement lazy loading for product images. Also, can we add infinite scroll as discussed?', 'general', NOW() - INTERVAL '94 days'),
('tf-comment-010', 'tf-task-005', '0198ab70-1004-7000-8000-000000000001', 'Lazy loading implemented ✓ Infinite scroll added ✓ Also optimized product filtering - now sub-100ms response time.', 'status_update', NOW() - INTERVAL '93 days'),

-- Shopping Cart Development
('tf-comment-011', 'tf-task-006', '0198ab70-1005-7000-8000-000000000001', 'Cart persistence working across sessions. Stripe integration testing in progress. Need client test API keys.', 'status_update', NOW() - INTERVAL '82 days'),
('tf-comment-012', 'tf-task-006', '0198ab70-1007-7000-8000-000000000001', 'Test API keys sent via secure email. Also, can we add PayPal as alternative payment option? High customer demand.', 'client_feedback', NOW() - INTERVAL '81 days'),
('tf-comment-013', 'tf-task-006', '0198ab70-1005-7000-8000-000000000001', 'PayPal integration added to scope. ETA +8 hours. All payment flows now working in staging environment.', 'status_update', NOW() - INTERVAL '80 days'),

-- Current Inventory System Project Comments
('tf-comment-014', 'tf-task-015', '0198ab70-1005-7000-8000-000000000001', 'WebSocket connection established. Real-time updates working for stock levels. Testing with 100+ concurrent connections.', 'status_update', NOW() - INTERVAL '5 days'),
('tf-comment-015', 'tf-task-015', '0198ab70-1003-7000-8000-000000000001', 'Great progress! Make sure to handle connection drops gracefully. Also implement rate limiting for stock update broadcasts.', 'general', NOW() - INTERVAL '4 days'),
('tf-comment-016', 'tf-task-016', '0198ab70-1004-7000-8000-000000000001', 'Admin dashboard UI 60% complete. Inventory grid, search, and filters working. Need feedback on bulk edit workflow.', 'status_update', NOW() - INTERVAL '3 days'),
('tf-comment-017', 'tf-task-016', '0198ab70-1007-7000-8000-000000000001', 'Bulk edit looks good! Can we add CSV import/export functionality? Would save significant time on inventory updates.', 'client_feedback', NOW() - INTERVAL '2 days'),
('tf-comment-018', 'tf-task-016', '0198ab70-1004-7000-8000-000000000001', 'CSV import/export added to sprint backlog. Current focus on completing core CRUD operations first.', 'general', NOW() - INTERVAL '1 day');

-- =============================================================================
-- STARTUPBOOST INC - TASK COMMENTS (PRODUCT DEVELOPMENT & TEAM COLLABORATION)
-- =============================================================================

-- Analytics Dashboard Comments
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_task_comment (id, task_id, author_id, content, comment_type, "createdAt") VALUES 
('sb-comment-001', 'sb-task-001', '0198ab70-2006-7000-8000-000000000002', 'Dashboard layout responsive across all breakpoints. Using CSS Grid for optimal performance. Dark mode toggle added.', 'status_update', NOW() - INTERVAL '68 days'),
('sb-comment-002', 'sb-task-001', '0198ab70-2002-7000-8000-000000000002', 'Love the dark mode! Accessibility compliance looking good. Can we add keyboard navigation for power users?', 'general', NOW() - INTERVAL '67 days'),
('sb-comment-003', 'sb-task-001', '0198ab70-2006-7000-8000-000000000002', 'Keyboard nav implemented! Tab order optimized. Also added focus indicators and ARIA labels throughout.', 'status_update', NOW() - INTERVAL '66 days'),

('sb-comment-004', 'sb-task-002', '0198ab70-2006-7000-8000-000000000002', 'Real-time charts using D3.js + WebSocket connection. Handle up to 1000 data points with smooth transitions.', 'status_update', NOW() - INTERVAL '62 days'),
('sb-comment-005', 'sb-task-002', '0198ab70-2003-7000-8000-000000000002', 'Performance looking great! Make sure to implement data throttling for high-frequency updates. Also add chart export.', 'general', NOW() - INTERVAL '61 days'),
('sb-comment-006', 'sb-task-002', '0198ab70-2006-7000-8000-000000000002', 'Data throttling: ✓ (max 10 updates/sec) Chart export: ✓ (PNG, SVG, PDF) Memory usage optimized for long sessions.', 'status_update', NOW() - INTERVAL '60 days'),

('sb-comment-007', 'sb-task-004', '0198ab70-2008-7000-8000-000000000002', 'Export functionality 80% complete. CSV and Excel working. PDF generation needs styling improvements.', 'status_update', NOW() - INTERVAL '5 days'),
('sb-comment-008', 'sb-task-004', '0198ab70-2002-7000-8000-000000000002', 'For PDF styling, use our brand guidelines. Also add scheduling option for automated reports - enterprise customers requesting this.', 'feature_request', NOW() - INTERVAL '4 days'),
('sb-comment-009', 'sb-task-004', '0198ab70-2008-7000-8000-000000000002', 'Brand guidelines applied to PDF templates. Scheduled reports added to product backlog - good catch!', 'general', NOW() - INTERVAL '3 days'),

-- ML Recommendation Engine Comments
('sb-comment-010', 'sb-task-006', '0198ab70-2005-7000-8000-000000000002', 'Data pipeline processing 1M+ user interactions/day. ETL jobs running smoothly with 99.9% success rate.', 'status_update', NOW() - INTERVAL '50 days'),
('sb-comment-011', 'sb-task-006', '0198ab70-2001-7000-8000-000000000002', 'Impressive scale! Monitor memory usage on pipeline workers. Also consider adding data validation checkpoints.', 'general', NOW() - INTERVAL '49 days'),
('sb-comment-012', 'sb-task-006', '0198ab70-2005-7000-8000-000000000002', 'Memory optimizations deployed. Added comprehensive data validation with alerting. Pipeline now self-healing for common errors.', 'status_update', NOW() - INTERVAL '48 days'),

('sb-comment-013', 'sb-task-007', '0198ab70-2009-7000-8000-000000000002', 'Feature engineering complete! 47 features extracted including user behavior patterns, temporal features, and content similarity.', 'status_update', NOW() - INTERVAL '40 days'),
('sb-comment-014', 'sb-task-007', '0198ab70-2004-7000-8000-000000000002', 'Great feature set! Run correlation analysis to identify redundant features. Also document feature importance for explainability.', 'general', NOW() - INTERVAL '39 days'),
('sb-comment-015', 'sb-task-007', '0198ab70-2009-7000-8000-000000000002', 'Correlation analysis complete - removed 8 redundant features. Feature importance documented. Model ready for training!', 'status_update', NOW() - INTERVAL '38 days'),

('sb-comment-016', 'sb-task-008', '0198ab70-2005-7000-8000-000000000002', 'Initial model training complete! Collaborative filtering achieving 0.85 precision@10. Testing matrix factorization next.', 'status_update', NOW() - INTERVAL '10 days'),
('sb-comment-017', 'sb-task-008', '0198ab70-2001-7000-8000-000000000002', 'Excellent precision! Compare with content-based approach too. Also prepare model serving infrastructure.', 'general', NOW() - INTERVAL '9 days'),
('sb-comment-018', 'sb-task-008', '0198ab70-2005-7000-8000-000000000002', 'Hybrid model (collaborative + content) achieving 0.89 precision@10! Infrastructure ready for production deployment.', 'status_update', NOW() - INTERVAL '2 days'),

('sb-comment-019', 'sb-task-009', '0198ab70-2010-7000-8000-000000000002', 'Prediction API handling 1000+ requests/second with <50ms latency. Redis caching implemented for popular items.', 'status_update', NOW() - INTERVAL '8 days'),
('sb-comment-020', 'sb-task-009', '0198ab70-2003-7000-8000-000000000002', 'Latency looking great! Add fallback strategies for cold start problem. Also implement recommendation explanation features.', 'general', NOW() - INTERVAL '7 days'),
('sb-comment-021', 'sb-task-009', '0198ab70-2010-7000-8000-000000000002', 'Cold start fallbacks: ✓ (popularity-based) Explanation API: ✓ ("Because you liked X...") Ready for production!', 'status_update', NOW() - INTERVAL '1 day');

-- =============================================================================
-- REALISTIC TIME ENTRIES FOR BOTH ORGANIZATIONS
-- =============================================================================

-- TechFlow Agency Time Entries (Realistic Agency Patterns)
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_time_entry (id, task_id, user_id, description, hours, entry_date, billable, "createdAt") VALUES 
-- UX Research Time (Marcus Johnson - PM)
('tf-time-001', 'tf-task-001', '0198ab70-1002-7000-8000-000000000001', 'User interview session #1 - 5 participants, mobile usage patterns', 4.5, '2025-02-05', true, NOW() - INTERVAL '115 days'),
('tf-time-002', 'tf-task-001', '0198ab70-1002-7000-8000-000000000001', 'Analytics review and user journey mapping', 3.0, '2025-02-06', true, NOW() - INTERVAL '114 days'),
('tf-time-003', 'tf-task-001', '0198ab70-1002-7000-8000-000000000001', 'User interview session #2 - desktop e-commerce behavior', 4.0, '2025-02-07', true, NOW() - INTERVAL '113 days'),
('tf-time-004', 'tf-task-001', '0198ab70-1002-7000-8000-000000000001', 'Persona creation and documentation', 2.5, '2025-02-08', true, NOW() - INTERVAL '112 days'),

-- Development Time (Alex Kim - Frontend Developer)
('tf-time-005', 'tf-task-004', '0198ab70-1004-7000-8000-000000000001', 'Project setup, configuration, and initial architecture', 6.0, '2025-03-15', true, NOW() - INTERVAL '105 days'),
('tf-time-006', 'tf-task-004', '0198ab70-1004-7000-8000-000000000001', 'ESLint/Prettier setup, testing framework configuration', 2.5, '2025-03-16', true, NOW() - INTERVAL '104 days'),
('tf-time-007', 'tf-task-005', '0198ab70-1004-7000-8000-000000000001', 'Product listing component development', 8.0, '2025-03-20', true, NOW() - INTERVAL '100 days'),
('tf-time-008', 'tf-task-005', '0198ab70-1004-7000-8000-000000000001', 'Product filtering and search implementation', 7.5, '2025-03-21', true, NOW() - INTERVAL '99 days'),
('tf-time-009', 'tf-task-005', '0198ab70-1004-7000-8000-000000000001', 'Product detail page with image gallery', 6.5, '2025-03-22', true, NOW() - INTERVAL '98 days'),

-- Current Active Work (Recent Time Entries)
('tf-time-010', 'tf-task-015', '0198ab70-1005-7000-8000-000000000001', 'WebSocket connection setup and testing', 5.0, '2025-08-10', true, NOW() - INTERVAL '5 days'),
('tf-time-011', 'tf-task-015', '0198ab70-1005-7000-8000-000000000001', 'Real-time update implementation', 4.5, '2025-08-11', true, NOW() - INTERVAL '4 days'),
('tf-time-012', 'tf-task-016', '0198ab70-1004-7000-8000-000000000001', 'Admin dashboard layout and routing', 6.0, '2025-08-12', true, NOW() - INTERVAL '3 days'),
('tf-time-013', 'tf-task-016', '0198ab70-1004-7000-8000-000000000001', 'Inventory grid component development', 7.0, '2025-08-13', true, NOW() - INTERVAL '2 days'),
('tf-time-014', 'tf-task-016', '0198ab70-1004-7000-8000-000000000001', 'Search and filtering functionality', 5.5, '2025-08-14', true, NOW() - INTERVAL '1 day');

-- StartupBoost Inc Time Entries (Startup Development Patterns)
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_time_entry (id, task_id, user_id, description, hours, entry_date, entry_type, "createdAt") VALUES 
-- Analytics Dashboard Development
('sb-time-001', 'sb-task-001', '0198ab70-2006-7000-8000-000000000002', 'Dashboard layout design and responsive grid setup', 6.5, '2025-06-03', 'development', NOW() - INTERVAL '68 days'),
('sb-time-002', 'sb-task-001', '0198ab70-2006-7000-8000-000000000002', 'Dark mode implementation and theme switching', 4.0, '2025-06-04', 'development', NOW() - INTERVAL '67 days'),
('sb-time-003', 'sb-task-002', '0198ab70-2006-7000-8000-000000000002', 'D3.js chart components and real-time data binding', 8.0, '2025-06-08', 'development', NOW() - INTERVAL '63 days'),
('sb-time-004', 'sb-task-002', '0198ab70-2006-7000-8000-000000000002', 'Performance optimization and memory leak fixes', 5.5, '2025-06-09', 'development', NOW() - INTERVAL '62 days'),

-- ML Pipeline Development
('sb-time-005', 'sb-task-006', '0198ab70-2005-7000-8000-000000000002', 'Data pipeline architecture design and documentation', 7.0, '2025-06-18', 'research', NOW() - INTERVAL '53 days'),
('sb-time-006', 'sb-task-006', '0198ab70-2005-7000-8000-000000000002', 'ETL job implementation with error handling', 8.5, '2025-06-19', 'development', NOW() - INTERVAL '52 days'),
('sb-time-007', 'sb-task-007', '0198ab70-2009-7000-8000-000000000002', 'Feature extraction algorithms and data preprocessing', 9.0, '2025-06-25', 'development', NOW() - INTERVAL '46 days'),
('sb-time-008', 'sb-task-007', '0198ab70-2009-7000-8000-000000000002', 'Feature validation and correlation analysis', 6.0, '2025-06-26', 'testing', NOW() - INTERVAL '45 days'),

-- Recent Active Development
('sb-time-009', 'sb-task-008', '0198ab70-2005-7000-8000-000000000002', 'Collaborative filtering model training and tuning', 7.5, '2025-08-10', 'development', NOW() - INTERVAL '5 days'),
('sb-time-010', 'sb-task-008', '0198ab70-2005-7000-8000-000000000002', 'Model evaluation and performance analysis', 4.0, '2025-08-11', 'testing', NOW() - INTERVAL '4 days'),
('sb-time-011', 'sb-task-009', '0198ab70-2010-7000-8000-000000000002', 'REST API development for prediction serving', 6.5, '2025-08-12', 'development', NOW() - INTERVAL '3 days'),
('sb-time-012', 'sb-task-009', '0198ab70-2010-7000-8000-000000000002', 'API performance testing and Redis caching', 5.0, '2025-08-13', 'testing', NOW() - INTERVAL '2 days'),
('sb-time-013', 'sb-task-004', '0198ab70-2008-7000-8000-000000000002', 'Data export functionality and PDF styling', 6.0, '2025-08-14', 'development', NOW() - INTERVAL '1 day');

-- Meeting and Collaboration Time (Both Organizations)
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_time_entry (id, task_id, user_id, description, hours, entry_date, billable, "createdAt") VALUES 
('tf-time-015', 'tf-task-003', '0198ab70-1002-7000-8000-000000000001', 'Client design review meeting and feedback incorporation', 2.0, '2025-03-12', true, NOW() - INTERVAL '108 days'),
('tf-time-016', 'tf-task-016', '0198ab70-1003-7000-8000-000000000001', 'Team standup and sprint planning', 1.0, '2025-08-14', false, NOW() - INTERVAL '1 day');

INSERT INTO org_0198ab70_2000_7000_8000_000000000002_time_entry (id, task_id, user_id, description, hours, entry_date, entry_type, "createdAt") VALUES 
('sb-time-014', 'sb-task-008', '0198ab70-2001-7000-8000-000000000002', 'Sprint retrospective and planning meeting', 1.5, '2025-08-13', 'meeting', NOW() - INTERVAL '2 days'),
('sb-time-015', 'sb-task-009', '0198ab70-2003-7000-8000-000000000002', 'Technical architecture review session', 2.0, '2025-08-14', 'meeting', NOW() - INTERVAL '1 day');

-- Verification Queries
SELECT 
  'TechFlow Agency' as organization,
  COUNT(DISTINCT p.id) as projects,
  COUNT(DISTINCT t.id) as tasks,
  COUNT(DISTINCT c.id) as comments,
  COUNT(DISTINCT te.id) as time_entries
FROM org_0198ab70_1000_7000_8000_000000000001_project p
LEFT JOIN org_0198ab70_1000_7000_8000_000000000001_task t ON p.id = t.project_id
LEFT JOIN org_0198ab70_1000_7000_8000_000000000001_task_comment c ON t.id = c.task_id
LEFT JOIN org_0198ab70_1000_7000_8000_000000000001_time_entry te ON t.id = te.task_id

UNION ALL

SELECT 
  'StartupBoost Inc' as organization,
  COUNT(DISTINCT p.id) as projects,
  COUNT(DISTINCT t.id) as tasks,
  COUNT(DISTINCT c.id) as comments,
  COUNT(DISTINCT te.id) as time_entries
FROM org_0198ab70_2000_7000_8000_000000000002_project p
LEFT JOIN org_0198ab70_2000_7000_8000_000000000002_task t ON p.id = t.project_id
LEFT JOIN org_0198ab70_2000_7000_8000_000000000002_task_comment c ON t.id = c.task_id
LEFT JOIN org_0198ab70_2000_7000_8000_000000000002_time_entry te ON t.id = te.task_id;