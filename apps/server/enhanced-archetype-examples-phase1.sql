-- Enhanced Archetype Examples - Phase 1: Complete Universal Coverage
-- Demonstrates all 8 universal archetype patterns with realistic business data

-- =============================================================================
-- RECORD ARCHETYPE EXAMPLES - STRUCTURED DATA RECORDS
-- =============================================================================

-- TechFlow Agency: Meeting Notes Records
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_meeting_notes (
  id, title, meeting_date, meeting_type, duration_minutes, location,
  attendees, agenda_items, action_items, decisions_made, next_meeting,
  recording_url, notes_taker, "createdAt", "updatedAt"
) VALUES 
('tf-record-001', 'RetailCorp Project Kickoff Meeting', '2025-02-01 10:00:00', 'client_kickoff', 90, 'TechFlow Conference Room A',
 '["Marcus Johnson (PM)", "Alex Kim (Dev)", "John Smith (Client CTO)", "Sarah Davis (Client PM)"]',
 '["Project scope review", "Timeline discussion", "Technical requirements", "Budget approval"]',
 '["Create project charter by Feb 3", "Set up dev environment by Feb 5", "Schedule design review for Feb 8"]',
 '["Approved React/Node.js tech stack", "Agreed on 3-month timeline", "Weekly status meetings on Fridays"]',
 '2025-02-08 10:00:00',
 'https://zoom.us/rec/play/retailcorp-kickoff-feb1',
 '0198ab70-1002-7000-8000-000000000001',
 '2025-02-01 11:30:00', '2025-02-01 11:30:00'),

('tf-record-002', 'Weekly Engineering Standup - Week 8', '2025-03-21 09:00:00', 'team_standup', 30, 'Virtual (Zoom)',
 '["Marcus Johnson", "Alex Kim", "Emma Rodriguez", "David Chen", "Lisa Wang"]',
 '["Sprint 3 progress review", "Blocker discussions", "Code review assignments", "Next week priorities"]',
 '["Alex: Complete payment integration testing", "Emma: Fix responsive design issues", "David: Update API documentation"]',
 '["Payment gateway integration approved for production", "Mobile-first approach confirmed", "API v2.1 ready for release"]',
 '2025-03-28 09:00:00',
 NULL,
 '0198ab70-1002-7000-8000-000000000001',
 '2025-03-21 09:30:00', '2025-03-21 09:30:00'),

('tf-record-003', 'FinancePlus Security Review', '2025-06-15 14:00:00', 'security_review', 120, 'TechFlow Secure Room',
 '["Marcus Johnson", "David Chen (Security Lead)", "FinancePlus CISO", "External Security Auditor"]',
 '["PCI DSS compliance review", "Penetration test results", "Security architecture validation", "Remediation planning"]',
 '["Fix SQL injection vulnerabilities by June 20", "Implement additional encryption layers", "Schedule final security audit"]',
 '["Approved for PCI DSS Level 1 certification path", "Minor vulnerabilities identified and prioritized", "Go-live approved pending fixes"]',
 '2025-06-22 14:00:00',
 'https://zoom.us/rec/play/financeplus-security-june15',
 '0198ab70-1006-7000-8000-000000000001',
 '2025-06-15 16:00:00', '2025-06-15 16:00:00');

-- TechFlow Agency: Technical Specification Records
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_tech_spec (
  id, title, project_id, specification_type, version, status, author,
  requirements_summary, architecture_overview, tech_stack_details,
  security_requirements, performance_targets, reviewed_by, approved_by,
  "createdAt", "updatedAt"
) VALUES 
('tf-record-004', 'RetailCorp E-commerce Platform API Specification', 'tf-proj-001', 'api_specification', '2.1', 'approved',
 '0198ab70-1003-7000-8000-000000000001',
 '{"total_endpoints": 45, "authentication": "JWT + OAuth2", "rate_limiting": "1000 requests/hour/user", "data_formats": ["JSON", "XML"]}',
 'Microservices architecture with API Gateway, Redis caching layer, PostgreSQL primary database, and Elasticsearch for search',
 '["Node.js 18+", "Express.js 4.18", "PostgreSQL 15", "Redis 7", "Elasticsearch 8", "Docker", "AWS ECS"]',
 '{"encryption": "AES-256", "transport": "TLS 1.3", "authentication": "Multi-factor", "audit_logging": "Full request/response"}',
 '{"response_time": "< 200ms p95", "throughput": "> 1000 RPS", "availability": "99.9%", "concurrent_users": 5000}',
 '0198ab70-1005-7000-8000-000000000001',
 '0198ab70-1002-7000-8000-000000000001',
 '2025-02-10 14:00:00', '2025-02-28 16:30:00'),

('tf-record-005', 'RetailCorp Inventory Management System Specification', 'tf-proj-003', 'system_specification', '1.3', 'draft',
 '0198ab70-1003-7000-8000-000000000001',
 '{"real_time_updates": true, "multi_warehouse": true, "barcode_scanning": true, "low_stock_alerts": true, "reporting_dashboard": true}',
 'Event-driven architecture with WebSocket connections, microservices for inventory operations, and real-time analytics pipeline',
 '["Node.js 18+", "Socket.io", "PostgreSQL 15", "Redis Streams", "React 18", "TypeScript 5", "Docker Compose"]',
 '{"role_based_access": true, "audit_trail": "Full inventory movements", "data_encryption": "At rest and in transit"}',
 '{"real_time_latency": "< 100ms", "bulk_operations": "> 10k items/minute", "concurrent_users": 200, "uptime": "99.95%"}',
 NULL,
 NULL,
 '2025-05-10 09:00:00', '2025-07-20 11:45:00');

-- StartupBoost Inc: Product Requirements Records
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_product_requirements (
  id, title, product_area, priority_score, epic_id, user_stories_count,
  acceptance_criteria, business_value, technical_complexity, 
  stakeholder_feedback, market_research, "createdAt", "updatedAt"
) VALUES 
('sb-record-001', 'AI-Powered Analytics Dashboard Requirements', 'platform_core', 95, 'EPIC-AI-001', 12,
 '["Real-time data processing and visualization", "Machine learning model integration", "Interactive 3D charts", "Export capabilities", "Mobile responsive design"]',
 '{"revenue_impact": "Potential 25% increase in enterprise conversions", "user_engagement": "Expected 40% increase in session duration", "competitive_advantage": "First-to-market AI analytics in our segment"}',
 '{"complexity_score": 8, "required_skills": ["ML Engineering", "WebGL", "Real-time processing"], "estimated_effort": "3 sprints", "risk_level": "medium"}',
 '{"engineering": "Feasible with current tech stack", "product": "High strategic value", "design": "Complex but achievable", "sales": "Strong customer demand"}',
 '{"competitor_analysis": "2 major competitors lack real-time AI", "customer_surveys": "78% would pay premium for AI features", "market_size": "$2.3B TAM"}',
 '2025-06-01 10:00:00', '2025-07-15 14:20:00'),

('sb-record-002', 'Mobile App Performance Optimization Requirements', 'mobile_platform', 87, 'EPIC-PERF-001', 8,
 '["App startup time < 2 seconds", "Smooth 60fps scrolling", "Offline mode support", "Battery optimization", "Memory usage reduction"]',
 '{"user_retention": "Target 15% improvement", "app_store_rating": "Increase from 4.2 to 4.6+", "support_ticket_reduction": "30% fewer performance complaints"}',
 '{"complexity_score": 6, "required_skills": ["React Native optimization", "Mobile performance"], "estimated_effort": "2 sprints", "risk_level": "low"}',
 '{"mobile_team": "Confident in delivery", "QA": "Comprehensive testing plan ready", "customer_success": "Top customer complaint"}',
 '{"user_feedback": "Performance is #1 complaint", "analytics": "40% users abandon on slow load", "benchmark": "2x slower than competitors"}',
 '2025-06-15 09:30:00', '2025-07-18 16:10:00');

-- StartupBoost Inc: Research Notes Records  
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_research_notes (
  id, title, research_area, hypothesis, methodology, duration_weeks,
  sample_size, findings_summary, confidence_level, statistical_significance,
  next_steps, related_experiments, researcher, "createdAt", "updatedAt"
) VALUES 
('sb-record-003', 'User Engagement Patterns with Personalized Content', 'user_behavior', 
 'Personalized content recommendations increase user engagement by 35%+ and reduce churn by 20%',
 'A/B testing with control group (generic content) vs. test group (AI-personalized content) over 4-week period',
 4, 10000,
 '{"engagement_increase": "38.2%", "session_duration": "+22 minutes avg", "churn_reduction": "18.7%", "feature_adoption": "+15%"}',
 'high', '{"p_value": 0.003, "confidence_interval": "95%", "effect_size": "large"}',
 '["Implement personalization engine in production", "Expand testing to mobile app", "Research advanced ML models", "A/B test different algorithms"]',
 '["sb-record-004", "sb-record-005"]',
 '0198ab70-2008-7000-8000-000000000002',
 '2025-05-15 08:00:00', '2025-06-20 17:30:00'),

('sb-record-004', 'Onboarding Flow Optimization Analysis', 'user_experience',
 'Simplified 3-step onboarding increases completion rate from 45% to 70%+',
 'Comparative analysis of current 7-step vs. new 3-step onboarding flow with user journey tracking',
 3, 5000,
 '{"completion_rate": "72.4% (+27.4%)", "time_to_complete": "3.2 minutes (-8.1 min)", "user_satisfaction": "4.6/5 (+0.9)", "support_tickets": "-45%"}',
 'very_high', '{"p_value": 0.001, "confidence_interval": "99%", "effect_size": "very_large"}',
 '["Deploy new onboarding to all users", "Create onboarding analytics dashboard", "Test mobile app onboarding", "Localize for international markets"]',
 '["sb-record-003", "sb-record-006"]',
 '0198ab70-2009-7000-8000-000000000002',
 '2025-06-01 12:00:00', '2025-07-05 14:45:00');

-- =============================================================================
-- DOCUMENT ARCHETYPE EXAMPLES - VERSIONED CONTENT WITH BUSINESS LOGIC
-- =============================================================================

-- TechFlow Agency: Contract Documents
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_contract (
  id, title, client_name, contract_type, version, status, effective_date,
  expiration_date, value_amount, currency, payment_terms, scope_summary,
  legal_review_status, signed_by_client, signed_by_company, witness,
  document_url, amendment_count, renewal_options, "createdAt", "updatedAt"
) VALUES 
('tf-doc-001', 'RetailCorp E-commerce Development Agreement', 'RetailCorp Inc', 'master_service_agreement', '1.2', 'executed',
 '2025-02-01', '2025-05-01', 125000.00, 'USD', 'Net 30, milestone-based payments',
 'Complete e-commerce platform development including frontend, backend, payment processing, and admin dashboard',
 'approved', 'John Smith (CTO)', 'Marcus Johnson (CEO)', 'Jennifer Lee (Legal Counsel)',
 'https://docs.techflow.com/contracts/retailcorp-msa-v1.2.pdf',
 1, '{"auto_renewal": false, "renewal_term": "6 months", "price_adjustment": "5% annual"}',
 '2025-01-15 10:00:00', '2025-02-01 16:30:00'),

('tf-doc-002', 'FinancePlus Mobile Banking Development Agreement', 'FinancePlus Bank', 'service_agreement', '2.0', 'executed',
 '2025-01-15', '2025-08-15', 280000.00, 'USD', 'Net 15, bi-weekly milestones',
 'iOS and Android mobile banking application with biometric authentication, real-time notifications, and comprehensive security',
 'approved', 'Michael Torres (VP Technology)', 'Marcus Johnson (CEO)', 'David Chen (Legal Review)',
 'https://docs.techflow.com/contracts/financeplus-mobile-v2.0.pdf',
 3, '{"auto_renewal": true, "renewal_term": "12 months", "maintenance_included": true}',
 '2025-01-01 09:00:00', '2025-01-15 14:20:00'),

('tf-doc-003', 'TechFlow-RetailCorp Inventory System SOW', 'RetailCorp Inc', 'statement_of_work', '1.0', 'pending_signature',
 '2025-08-01', '2025-12-31', 95000.00, 'USD', 'Net 30, 40% upfront, 60% on delivery',
 'Real-time inventory management system with WebSocket updates, barcode scanning, multi-warehouse support, and analytics dashboard',
 'in_review', NULL, NULL, NULL,
 'https://docs.techflow.com/contracts/retailcorp-inventory-sow-v1.0.pdf',
 0, '{"maintenance_term": "12 months", "support_level": "business_hours", "enhancement_rate": "$150/hour"}',
 '2025-07-20 11:00:00', '2025-07-25 09:15:00');

-- TechFlow Agency: Proposal Documents
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_proposal (
  id, title, client_name, proposal_type, version, status, submitted_date,
  estimated_value, estimated_duration_weeks, scope_summary, timeline_overview,
  win_probability, next_action, decision_deadline, competitor_analysis,
  unique_value_proposition, risk_assessment, "createdAt", "updatedAt"
) VALUES 
('tf-doc-004', 'FinancePlus Real-time Analytics Dashboard Proposal', 'FinancePlus Bank', 'new_project', '2.1', 'submitted',
 '2025-08-01', 185000.00, 20, 'Real-time financial analytics dashboard with predictive modeling, risk assessment, and regulatory reporting',
 '{"discovery": "2 weeks", "design": "3 weeks", "development": "12 weeks", "testing": "2 weeks", "deployment": "1 week"}',
 78, 'Technical presentation scheduled for August 15th', '2025-08-30',
 '{"primary_competitor": "TechCorp Solutions", "our_advantages": ["Banking domain expertise", "Existing relationship", "Proven security track record"]}',
 'Only vendor with both banking compliance expertise and real-time analytics specialization, plus existing successful project history',
 '{"technical_risk": "Low", "timeline_risk": "Medium", "resource_risk": "Low", "client_risk": "Very Low"}',
 '2025-07-25 14:00:00', '2025-08-01 11:30:00'),

('tf-doc-005', 'HealthTech Startup MVP Development Proposal', 'WellnessTech Inc', 'new_client', '1.0', 'draft',
 NULL, 125000.00, 16, 'HIPAA-compliant health tracking MVP with patient portal, provider dashboard, and secure messaging',
 '{"discovery": "2 weeks", "compliance_review": "1 week", "design": "3 weeks", "development": "8 weeks", "testing": "2 weeks"}',
 65, 'Finalizing proposal for submission next week', '2025-09-15',
 '{"main_competitors": ["HealthDev Co", "MedTech Solutions"], "differentiators": ["HIPAA specialization", "Faster delivery", "Lower cost"]}',
 'Specialized HIPAA compliance expertise with healthcare industry experience and accelerated MVP delivery methodology',
 '{"technical_risk": "Medium", "compliance_risk": "Low", "timeline_risk": "Medium", "budget_risk": "Low"}',
 '2025-08-10 09:00:00', '2025-08-12 16:45:00');

-- StartupBoost Inc: User Manual Documents
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_user_manual (
  id, title, product_feature, version, target_audience, document_format,
  page_count, last_updated, accessibility_compliant, translation_status,
  usage_analytics, user_feedback_score, maintenance_schedule, author,
  review_cycle, "createdAt", "updatedAt"
) VALUES 
('sb-doc-001', 'StartupBoost Platform Complete User Guide', 'core_platform', '3.2', 'end_users', 'interactive_web',
 67, '2025-07-20', true, '{"spanish": "complete", "french": "in_progress", "german": "planned"}',
 '{"monthly_views": 15670, "avg_session_duration": "12.4 minutes", "completion_rate": "72%", "search_queries": 2340}',
 4.4, 'Monthly updates, major revisions quarterly', '0198ab70-2007-7000-8000-000000000002',
 'Bi-weekly review with product team', '2025-01-15 10:00:00', '2025-07-20 14:30:00'),

('sb-doc-002', 'Advanced Analytics Module User Guide', 'analytics_dashboard', '2.1', 'power_users', 'pdf_and_web',
 34, '2025-07-18', true, '{"spanish": "complete", "french": "complete"}',
 '{"monthly_views": 5890, "avg_session_duration": "18.2 minutes", "completion_rate": "89%", "advanced_feature_adoption": "67%"}',
 4.7, 'Updated with each feature release', '0198ab70-2008-7000-8000-000000000002',
 'Weekly review during feature development', '2025-03-01 11:00:00', '2025-07-18 09:15:00'),

('sb-doc-003', 'Mobile App Quick Start Guide', 'mobile_app', '1.8', 'new_users', 'interactive_mobile',
 12, '2025-07-15', true, '{"spanish": "complete", "french": "complete", "german": "complete", "chinese": "in_progress"}',
 '{"monthly_views": 8920, "avg_session_duration": "6.1 minutes", "completion_rate": "85%", "onboarding_conversion": "78%"}',
 4.3, 'Updated with each mobile release', '0198ab70-2009-7000-8000-000000000002',
 'Continuous updating based on user feedback', '2025-04-10 13:00:00', '2025-07-15 16:20:00');

-- =============================================================================
-- FILE ARCHETYPE EXAMPLES - BINARY ASSETS WITH METADATA
-- =============================================================================

-- TechFlow Agency: Source Code Files
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_source_code (
  id, filename, file_path, repository_name, repository_url, language,
  file_size_bytes, lines_of_code, last_modified, last_commit_hash,
  author, code_quality_score, test_coverage_percentage, complexity_score,
  dependencies, security_scan_status, documentation_coverage, "createdAt", "updatedAt"
) VALUES 
('tf-file-001', 'ProductCatalog.tsx', '/src/components/catalog/ProductCatalog.tsx', 'retailcorp-ecommerce',
 'https://github.com/techflow/retailcorp-ecommerce', 'typescript', 8742, 284, '2025-03-28 14:30:00', 'a1b2c3d4e5f6789',
 '0198ab70-1004-7000-8000-000000000001', 94, 87, 6,
 '["react@18.2.0", "styled-components@5.3.0", "react-query@4.0.0", "@types/react@18.0.0"]',
 'passed', 92, '2025-02-15 09:00:00', '2025-03-28 14:30:00'),

('tf-file-002', 'PaymentService.ts', '/src/services/payment/PaymentService.ts', 'retailcorp-ecommerce',
 'https://github.com/techflow/retailcorp-ecommerce', 'typescript', 6543, 198, '2025-03-25 11:15:00', 'f6e5d4c3b2a1987',
 '0198ab70-1005-7000-8000-000000000001', 96, 95, 4,
 '["stripe@10.0.0", "express@4.18.0", "joi@17.0.0", "crypto@1.0.1"]',
 'passed', 89, '2025-02-20 14:00:00', '2025-03-25 11:15:00'),

('tf-file-003', 'InventoryAPI.ts', '/src/api/inventory/InventoryAPI.ts', 'retailcorp-inventory',
 'https://github.com/techflow/retailcorp-inventory', 'typescript', 12890, 456, '2025-07-22 16:45:00', 'z9y8x7w6v5u4321',
 '0198ab70-1003-7000-8000-000000000001', 91, 83, 7,
 '["express@4.18.0", "socket.io@4.7.0", "prisma@5.0.0", "zod@3.21.0", "redis@4.6.0"]',
 'warning', 94, '2025-05-15 10:00:00', '2025-07-22 16:45:00');

-- TechFlow Agency: Media Files
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_media (
  id, filename, file_type, file_size_bytes, mime_type, resolution,
  duration_seconds, created_by, usage_context, optimization_status,
  cdn_url, alt_text, metadata_tags, download_count, last_accessed,
  "createdAt", "updatedAt"
) VALUES 
('tf-file-004', 'retailcorp-hero-banner.webp', 'image', 247680, 'image/webp', '1920x1080', NULL,
 '0198ab70-1002-7000-8000-000000000001', 'homepage_hero', 'optimized',
 'https://cdn.techflow.com/images/retailcorp-hero-banner.webp',
 'Modern e-commerce storefront showcasing product catalog with shopping cart functionality',
 '["hero", "ecommerce", "banner", "responsive", "optimized", "webp"]', 1847, '2025-07-22 09:30:00',
 '2025-02-18 13:00:00', '2025-02-20 11:30:00'),

('tf-file-005', 'financeplus-app-demo.mp4', 'video', 15678943, 'video/mp4', '1280x720', 187,
 '0198ab70-1002-7000-8000-000000000001', 'client_presentation', 'optimized',
 'https://cdn.techflow.com/videos/financeplus-app-demo.mp4',
 'FinancePlus mobile banking app demonstration showcasing biometric login and real-time transaction features',
 '["demo", "mobile_app", "fintech", "presentation", "client_facing"]', 234, '2025-07-20 14:15:00',
 '2025-07-10 10:00:00', '2025-07-12 15:45:00'),

('tf-file-006', 'techflow-logo-suite.svg', 'image', 8945, 'image/svg+xml', 'scalable', NULL,
 '0198ab70-1002-7000-8000-000000000001', 'brand_identity', 'optimized',
 'https://cdn.techflow.com/brand/techflow-logo-suite.svg',
 'TechFlow Agency complete logo suite including primary logo, horizontal lockup, and icon variations',
 '["logo", "brand", "svg", "scalable", "identity", "vectorized"]', 567, '2025-07-23 11:00:00',
 '2025-01-05 08:00:00', '2025-01-05 08:00:00');

-- StartupBoost Inc: Documentation Files
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_documentation (
  id, filename, file_path, doc_type, file_size_bytes, format, last_updated,
  maintained_by, relevance_score, access_count_monthly, outdated_sections,
  review_due_date, linked_features, contributor_count, "createdAt", "updatedAt"
) VALUES 
('sb-file-001', 'API-Integration-Guide.md', '/docs/developers/API-Integration-Guide.md', 'technical_guide',
 23456, 'markdown', '2025-07-22', '0198ab70-2005-7000-8000-000000000002', 98, 4567, '[]',
 '2025-10-22', '["authentication", "rate_limiting", "webhooks", "real_time_apis"]', 8,
 '2025-03-01 09:00:00', '2025-07-22 14:30:00'),

('sb-file-002', 'Security-Best-Practices.pdf', '/docs/security/Security-Best-Practices.pdf', 'security_guide',
 1894567, 'pdf', '2025-07-15', '0198ab70-2006-7000-8000-000000000002', 95, 2890, 
 '["section_4.2_encryption", "appendix_b_compliance"]', '2025-09-15',
 '["data_encryption", "access_control", "audit_logging", "compliance"]', 5,
 '2025-04-01 11:00:00', '2025-07-15 16:45:00'),

('sb-file-003', 'Mobile-App-Architecture.drawio', '/docs/architecture/Mobile-App-Architecture.drawio', 'architecture_diagram',
 156789, 'drawio', '2025-07-20', '0198ab70-2004-7000-8000-000000000002', 89, 1234,
 '["offline_sync_section"]', '2025-08-20',
 '["mobile_architecture", "react_native", "offline_sync", "state_management"]', 3,
 '2025-05-15 13:00:00', '2025-07-20 10:15:00');

-- This completes Phase 1 of the enhanced archetype examples, providing realistic data for:
-- ✅ Record Archetype: Meeting notes, tech specs, requirements, research
-- ✅ Document Archetype: Contracts, proposals, user manuals with versioning
-- ✅ File Archetype: Source code, media files, documentation with metadata

-- Next: Continue with Activity, Discussion, and Collection archetypes...