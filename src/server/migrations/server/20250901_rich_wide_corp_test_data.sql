-- Rich Wide Corp Test Data Migration
-- Creates comprehensive test data for Wide Corp with diverse teams, worlds, and users

-- First, let's add more teams with different structures
INSERT INTO teams (id, organization_id, name, description, parent_team_id, team_type, created_at, updated_at) VALUES
-- Top-level departments
('01920000-1002-7002-8002-000000000010', '01920000-1000-7000-8000-000000000001', 'Marketing & Growth', 'Brand marketing, content, and growth strategies', NULL, 'department', NOW(), NOW()),
('01920000-1002-7002-8002-000000000011', '01920000-1000-7000-8000-000000000001', 'Operations', 'Internal operations, HR, and administration', NULL, 'department', NOW(), NOW()),
('01920000-1002-7002-8002-000000000012', '01920000-1000-7000-8000-000000000001', 'Finance & Legal', 'Financial planning, accounting, and legal affairs', NULL, 'department', NOW(), NOW()),

-- Sub-teams under departments
('01920000-1002-7002-8002-000000000013', '01920000-1000-7000-8000-000000000001', 'Frontend Team', 'React, Vue, and UI/UX development', '01920000-1002-7002-8002-000000000001', 'functional', NOW(), NOW()),
('01920000-1002-7002-8002-000000000014', '01920000-1000-7000-8000-000000000001', 'Backend Team', 'APIs, databases, and server infrastructure', '01920000-1002-7002-8002-000000000001', 'functional', NOW(), NOW()),
('01920000-1002-7002-8002-000000000015', '01920000-1000-7000-8000-000000000001', 'DevOps Team', 'CI/CD, cloud infrastructure, and monitoring', '01920000-1002-7002-8002-000000000001', 'functional', NOW(), NOW()),

-- Cross-functional project teams
('01920000-1002-7002-8002-000000000016', '01920000-1000-7000-8000-000000000001', 'Project Phoenix', 'Strategic initiative for platform modernization', NULL, 'cross_functional', NOW(), NOW()),
('01920000-1002-7002-8002-000000000017', '01920000-1000-7000-8000-000000000001', 'Customer Success', 'Client onboarding, support, and success', '01920000-1002-7002-8002-000000000002', 'functional', NOW(), NOW());

-- Add more diverse users
INSERT INTO "user" (id, name, email, "emailVerified", password, role, "createdAt", "updatedAt") VALUES
-- Development Team Members  
('01980000-2000-4000-8000-000000000010', 'Emma Frontend', 'emma@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW()),
('01980000-2000-4000-8000-000000000011', 'Marcus Backend', 'marcus@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW()),
('01980000-2000-4000-8000-000000000012', 'Sofia DevOps', 'sofia@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW()),

-- Sales & Marketing Team
('01980000-2000-4000-8000-000000000013', 'David Sales', 'david@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW()),
('01980000-2000-4000-8000-000000000014', 'Luna Marketing', 'luna@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW()),

-- Operations & Support
('01980000-2000-4000-8000-000000000015', 'Oliver Ops', 'oliver@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW()),
('01980000-2000-4000-8000-000000000016', 'Ava Customer', 'ava@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW()),

-- Leadership
('01980000-2000-4000-8000-000000000017', 'James CTO', 'cto@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW()),
('01980000-2000-4000-8000-000000000018', 'Isabella CFO', 'cfo@widecorp.com', true, '$2a$10$example.hash.for.password123', 'user', NOW(), NOW());

-- Add organization memberships for all new users
INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES
-- Development team members
('01990000-3000-5000-7000-000000000010', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000010', 'member', NOW()),
('01990000-3000-5000-7000-000000000011', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000011', 'member', NOW()),
('01990000-3000-5000-7000-000000000012', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000012', 'member', NOW()),

-- Sales & Marketing
('01990000-3000-5000-7000-000000000013', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000013', 'member', NOW()),
('01990000-3000-5000-7000-000000000014', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000014', 'member', NOW()),

-- Operations  
('01990000-3000-5000-7000-000000000015', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000015', 'member', NOW()),
('01990000-3000-5000-7000-000000000016', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000016', 'member', NOW()),

-- Leadership
('01990000-3000-5000-7000-000000000017', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000017', 'admin', NOW()),
('01990000-3000-5000-7000-000000000018', '01920000-1000-7000-8000-000000000001', '01980000-2000-4000-8000-000000000018', 'admin', NOW());

-- Add comprehensive team memberships with varied roles
INSERT INTO team_memberships (id, team_id, user_id, role, created_at) VALUES
-- Alice CEO is admin of all major teams
('01950000-4000-6000-8000-000000000010', '01920000-1002-7002-8002-000000000010', '0198b046-c453-72d9-b71a-092e1f75601a', 'admin', NOW()),
('01950000-4000-6000-8000-000000000011', '01920000-1002-7002-8002-000000000011', '0198b046-c453-72d9-b71a-092e1f75601a', 'admin', NOW()),
('01950000-4000-6000-8000-000000000012', '01920000-1002-7002-8002-000000000012', '0198b046-c453-72d9-b71a-092e1f75601a', 'admin', NOW()),

-- James CTO leads all development teams  
('01950000-4000-6000-8000-000000000020', '01920000-1002-7002-8002-000000000001', '01980000-2000-4000-8000-000000000017', 'admin', NOW()),
('01950000-4000-6000-8000-000000000021', '01920000-1002-7002-8002-000000000013', '01980000-2000-4000-8000-000000000017', 'admin', NOW()),
('01950000-4000-6000-8000-000000000022', '01920000-1002-7002-8002-000000000014', '01980000-2000-4000-8000-000000000017', 'admin', NOW()),
('01950000-4000-6000-8000-000000000023', '01920000-1002-7002-8002-000000000015', '01980000-2000-4000-8000-000000000017', 'admin', NOW()),

-- Frontend team
('01950000-4000-6000-8000-000000000030', '01920000-1002-7002-8002-000000000013', '01980000-2000-4000-8000-000000000010', 'lead', NOW()),

-- Backend team  
('01950000-4000-6000-8000-000000000031', '01920000-1002-7002-8002-000000000014', '01980000-2000-4000-8000-000000000011', 'lead', NOW()),

-- DevOps team
('01950000-4000-6000-8000-000000000032', '01920000-1002-7002-8002-000000000015', '01980000-2000-4000-8000-000000000012', 'lead', NOW()),

-- Sales team memberships
('01950000-4000-6000-8000-000000000040', '01920000-1002-7002-8002-000000000002', '01980000-2000-4000-8000-000000000013', 'lead', NOW()),

-- Marketing team  
('01950000-4000-6000-8000-000000000041', '01920000-1002-7002-8002-000000000010', '01980000-2000-4000-8000-000000000014', 'lead', NOW()),

-- Operations team
('01950000-4000-6000-8000-000000000050', '01920000-1002-7002-8002-000000000011', '01980000-2000-4000-8000-000000000015', 'lead', NOW()),

-- Customer Success
('01950000-4000-6000-8000-000000000051', '01920000-1002-7002-8002-000000000017', '01980000-2000-4000-8000-000000000016', 'lead', NOW()),

-- Cross-functional Project Phoenix team (diverse membership)
('01950000-4000-6000-8000-000000000060', '01920000-1002-7002-8002-000000000016', '01980000-2000-4000-8000-000000000017', 'admin', NOW()), -- CTO leads
('01950000-4000-6000-8000-000000000061', '01920000-1002-7002-8002-000000000016', '01980000-2000-4000-8000-000000000010', 'member', NOW()), -- Frontend
('01950000-4000-6000-8000-000000000062', '01920000-1002-7002-8002-000000000016', '01980000-2000-4000-8000-000000000011', 'member', NOW()), -- Backend  
('01950000-4000-6000-8000-000000000063', '01920000-1002-7002-8002-000000000016', '01980000-2000-4000-8000-000000000012', 'member', NOW()), -- DevOps
('01950000-4000-6000-8000-000000000064', '01920000-1002-7002-8002-000000000016', '01980000-2000-4000-8000-000000000014', 'member', NOW()); -- Marketing

-- Add rich business worlds across different business areas
INSERT INTO worlds (id, organization_id, team_id, name, description, owner_user_id, state, world_type, priority, created_at, updated_at, created_by) VALUES
-- Engineering & Product worlds
('01920000-1003-7003-8003-000000000020', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000013', 'Mobile App Development', 'iOS and Android app development for core platform', NULL, 'developing', 'business', 'critical', NOW(), NOW(), '01980000-2000-4000-8000-000000000017'),
('01920000-1003-7003-8003-000000000021', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000014', 'API Infrastructure', 'Core API services, microservices architecture', NULL, 'active', 'business', 'critical', NOW(), NOW(), '01980000-2000-4000-8000-000000000017'),
('01920000-1003-7003-8003-000000000022', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000015', 'Cloud Infrastructure', 'AWS/Azure deployment, monitoring, and scaling', NULL, 'active', 'business', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000017'),

-- Marketing & Sales worlds  
('01920000-1003-7003-8003-000000000025', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000010', 'Brand & Content Strategy', 'Brand positioning, content marketing, social media', NULL, 'active', 'business', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000014'),
('01920000-1003-7003-8003-000000000026', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000002', 'Enterprise Sales Pipeline', 'B2B enterprise client acquisition and nurturing', NULL, 'active', 'business', 'critical', NOW(), NOW(), '01980000-2000-4000-8000-000000000013'),
('01920000-1003-7003-8003-000000000027', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000017', 'Customer Onboarding', 'New client setup, training, and success metrics', NULL, 'active', 'client', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000016'),

-- Operations & Finance worlds
('01920000-1003-7003-8003-000000000030', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000011', 'HR & Talent Management', 'Recruiting, onboarding, performance management', NULL, 'active', 'department', 'medium', NOW(), NOW(), '01980000-2000-4000-8000-000000000015'),
('01920000-1003-7003-8003-000000000031', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000012', 'Financial Planning 2024', 'Budget planning, forecasting, and financial analysis', NULL, 'developing', 'business', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000018'),
('01920000-1003-7003-8003-000000000032', '01920000-1000-7000-8000-000000000001', NULL, 'Company All-Hands', 'Quarterly company meetings, announcements, culture', NULL, 'active', 'department', 'medium', NOW(), NOW(), '0198b046-c453-72d9-b71a-092e1f75601a'),

-- Strategic project worlds
('01920000-1003-7003-8003-000000000035', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000016', 'Phoenix Platform Migration', 'Legacy system modernization and platform upgrade', NULL, 'developing', 'project_domain', 'critical', NOW(), NOW(), '01980000-2000-4000-8000-000000000017'),
('01920000-1003-7003-8003-000000000036', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000016', 'AI Integration Initiative', 'Machine learning and AI feature development', NULL, 'exploring', 'business', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000017');

-- Add diverse personal worlds for Alice CEO and other team members
INSERT INTO worlds (id, organization_id, team_id, name, description, owner_user_id, state, world_type, priority, created_at, updated_at, created_by) VALUES
-- Alice CEO personal worlds (diverse interests)
('01920000-1003-7003-8003-000000000050', '01920000-1000-7000-8000-000000000001', NULL, 'Executive Leadership Development', 'CEO coaching, leadership books, strategic planning', '0198b046-c453-72d9-b71a-092e1f75601a', 'active', 'personal', 'high', NOW(), NOW(), '0198b046-c453-72d9-b71a-092e1f75601a'),
('01920000-1003-7003-8003-000000000051', '01920000-1000-7000-8000-000000000001', NULL, 'Board Meeting Preparation', 'Quarterly board reports, investor relations, metrics', '0198b046-c453-72d9-b71a-092e1f75601a', 'active', 'personal', 'critical', NOW(), NOW(), '0198b046-c453-72d9-b71a-092e1f75601a'),
('01920000-1003-7003-8003-000000000052', '01920000-1000-7000-8000-000000000001', NULL, 'Industry Research & Networking', 'Conference planning, competitor analysis, partnerships', '0198b046-c453-72d9-b71a-092e1f75601a', 'active', 'personal', 'medium', NOW(), NOW(), '0198b046-c453-72d9-b71a-092e1f75601a'),

-- James CTO personal worlds  
('01920000-1003-7003-8003-000000000055', '01920000-1000-7000-8000-000000000001', NULL, 'Technical Architecture Research', 'New frameworks, architecture patterns, tech evaluation', '01980000-2000-4000-8000-000000000017', 'active', 'personal', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000017'),
('01920000-1003-7003-8003-000000000056', '01920000-1000-7000-8000-000000000001', NULL, 'Team Building & Mentoring', ' 1-on-1s, career development, team culture initiatives', '01980000-2000-4000-8000-000000000017', 'active', 'personal', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000017'),

-- Developer personal worlds
('01920000-1003-7003-8003-000000000060', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000013', 'UI/UX Design Learning', 'Design systems, accessibility, user research', '01980000-2000-4000-8000-000000000010', 'active', 'personal', 'medium', NOW(), NOW(), '01980000-2000-4000-8000-000000000010'),
('01920000-1003-7003-8003-000000000061', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000014', 'Database Optimization Project', 'PostgreSQL tuning, query optimization, performance', '01980000-2000-4000-8000-000000000011', 'developing', 'personal', 'medium', NOW(), NOW(), '01980000-2000-4000-8000-000000000011'),
('01920000-1003-7003-8003-000000000062', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000015', 'Kubernetes Certification', 'CKA certification study, hands-on lab practice', '01980000-2000-4000-8000-000000000012', 'active', 'personal', 'medium', NOW(), NOW(), '01980000-2000-4000-8000-000000000012'),

-- Sales & Marketing personal worlds
('01920000-1003-7003-8003-000000000065', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000002', 'Sales Training & Development', 'Negotiation skills, CRM mastery, sales methodology', '01980000-2000-4000-8000-000000000013', 'active', 'personal', 'medium', NOW(), NOW(), '01980000-2000-4000-8000-000000000013'),
('01920000-1003-7003-8003-000000000066', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000010', 'Digital Marketing Experiments', 'A/B testing, growth hacking, analytics deep dives', '01980000-2000-4000-8000-000000000014', 'developing', 'personal', 'medium', NOW(), NOW(), '01980000-2000-4000-8000-000000000014'),

-- Support & Operations personal worlds  
('01920000-1003-7003-8003-000000000070', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000011', 'Process Automation Ideas', 'Workflow optimization, automation tools, efficiency', '01980000-2000-4000-8000-000000000015', 'exploring', 'personal', 'low', NOW(), NOW(), '01980000-2000-4000-8000-000000000015'),
('01920000-1003-7003-8003-000000000071', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000017', 'Customer Success Metrics', 'NPS tracking, churn analysis, success playbooks', '01980000-2000-4000-8000-000000000016', 'active', 'personal', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000016');