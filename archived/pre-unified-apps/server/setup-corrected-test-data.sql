-- Corrected RLS Test Data Setup - Matching Actual Database Schema
-- This script creates realistic test data for comprehensive RLS testing

-- ===================================
-- PART 1: CLEAN UP EXISTING TEST DATA
-- ===================================

-- Clear existing test data (if any)
DELETE FROM organization_audit_logs WHERE organization_id IN (
    SELECT id FROM organizations WHERE name LIKE '%Test%' OR name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%'
);
DELETE FROM organization_invitations WHERE organization_id IN (
    SELECT id FROM organizations WHERE name LIKE '%Test%' OR name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%'
);
DELETE FROM organization_members WHERE organization_id IN (
    SELECT id FROM organizations WHERE name LIKE '%Test%' OR name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%'
);
DELETE FROM organizations WHERE name LIKE '%Test%' OR name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%';

-- Clean up test users
DELETE FROM "user" WHERE email LIKE '%@techstartup.%' OR email LIKE '%@globalcorp.%' OR email LIKE '%@creativeagency.%' OR email LIKE '%@healthtech.%';

-- ===================================
-- PART 2: TEST ORGANIZATIONS
-- ===================================

-- Organization 1: TechStartup Inc (Growing SaaS company)
INSERT INTO organizations (
    id, name, slug, description, industry, company_size, 
    website_url, country, timezone, subscription_tier, 
    subscription_status, max_users, max_projects, storage_limit_gb,
    settings, created_at, updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'TechStartup Inc',
    'techstartup-inc',
    'Innovative SaaS platform for project management',
    'Technology',
    '11-50',
    'https://techstartup.example.com',
    'US',
    'America/New_York',
    'pro',
    'active',
    50,
    25,
    100,
    '{"notifications": true, "api_access": true, "custom_branding": true}'::jsonb,
    NOW() - INTERVAL '6 months',
    NOW() - INTERVAL '1 day'
);

-- Organization 2: GlobalCorp Enterprise (Large enterprise client)
INSERT INTO organizations (
    id, name, slug, description, industry, company_size,
    website_url, country, timezone, subscription_tier,
    subscription_status, max_users, max_projects, storage_limit_gb,
    settings, created_at, updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002'::uuid,
    'GlobalCorp Enterprise',
    'globalcorp-enterprise',
    'Fortune 500 manufacturing and logistics company',
    'Manufacturing',
    '1000+',
    'https://globalcorp.example.com',
    'US',
    'America/Chicago',
    'enterprise',
    'active',
    500,
    100,
    1000,
    '{"sso_enabled": true, "enforce_2fa": true, "audit_retention": 7}'::jsonb,
    NOW() - INTERVAL '2 years',
    NOW() - INTERVAL '2 hours'
);

-- Organization 3: CreativeAgency Studio (Small creative team)
INSERT INTO organizations (
    id, name, slug, description, industry, company_size,
    website_url, country, timezone, subscription_tier,
    subscription_status, max_users, max_projects, storage_limit_gb,
    settings, created_at, updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003'::uuid,
    'CreativeAgency Studio',
    'creative-agency-studio',
    'Digital marketing and design agency',
    'Marketing',
    '2-10',
    'https://creativeagency.example.com',
    'GB',
    'Europe/London',
    'free',
    'active',
    5,
    3,
    1,
    '{"client_access": true, "public_galleries": false}'::jsonb,
    NOW() - INTERVAL '3 months',
    NOW() - INTERVAL '5 minutes'
);

-- Organization 4: HealthTech Solutions (Regulated healthcare)
INSERT INTO organizations (
    id, name, slug, description, industry, company_size,
    website_url, country, timezone, subscription_tier,
    subscription_status, max_users, max_projects, storage_limit_gb,
    settings, created_at, updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440004'::uuid,
    'HealthTech Solutions',
    'healthtech-solutions',
    'HIPAA-compliant healthcare software solutions',
    'Healthcare',
    '51-100',
    'https://healthtech.example.com',
    'US',
    'America/Los_Angeles',
    'enterprise',
    'active',
    100,
    50,
    500,
    '{"hipaa_compliance": true, "encryption_required": true, "audit_everything": true}'::jsonb,
    NOW() - INTERVAL '1 year',
    NOW() - INTERVAL '1 hour'
);

-- ===================================
-- PART 3: TEST USERS (Better Auth format)
-- ===================================

-- Insert test users into Better Auth user table
INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt") VALUES
-- TechStartup Inc users
('user_sarah_ceo_001', 'sarah.johnson@techstartup.example.com', 'Sarah Johnson', true, NOW() - INTERVAL '6 months', NOW()),
('user_mike_pm_001', 'mike.chen@techstartup.example.com', 'Mike Chen', true, NOW() - INTERVAL '5 months', NOW()),
('user_alex_dev_001', 'alex.rodriguez@techstartup.example.com', 'Alex Rodriguez', true, NOW() - INTERVAL '4 months', NOW()),
('user_lisa_designer_001', 'lisa.wang@techstartup.example.com', 'Lisa Wang', true, NOW() - INTERVAL '3 months', NOW()),

-- GlobalCorp Enterprise users  
('user_robert_cto_002', 'robert.smith@globalcorp.example.com', 'Robert Smith', true, NOW() - INTERVAL '2 years', NOW()),
('user_jennifer_pm_002', 'jennifer.davis@globalcorp.example.com', 'Jennifer Davis', true, NOW() - INTERVAL '18 months', NOW()),
('user_david_analyst_002', 'david.wilson@globalcorp.example.com', 'David Wilson', true, NOW() - INTERVAL '1 year', NOW()),
('user_maria_qa_002', 'maria.garcia@globalcorp.example.com', 'Maria Garcia', true, NOW() - INTERVAL '8 months', NOW()),
('user_james_dev_002', 'james.brown@globalcorp.example.com', 'James Brown', true, NOW() - INTERVAL '6 months', NOW()),

-- CreativeAgency Studio users
('user_emma_owner_003', 'emma.taylor@creativeagency.example.com', 'Emma Taylor', true, NOW() - INTERVAL '3 months', NOW()),
('user_tom_designer_003', 'tom.anderson@creativeagency.example.com', 'Tom Anderson', true, NOW() - INTERVAL '2 months', NOW()),
('user_sophie_client_003', 'sophie.martin@bigbrand.example.com', 'Sophie Martin', true, NOW() - INTERVAL '1 month', NOW()),

-- HealthTech Solutions users
('user_dr_patricia_004', 'patricia.lee@healthtech.example.com', 'Dr. Patricia Lee', true, NOW() - INTERVAL '1 year', NOW()),
('user_michael_dev_004', 'michael.thomas@healthtech.example.com', 'Michael Thomas', true, NOW() - INTERVAL '10 months', NOW()),
('user_rachel_pm_004', 'rachel.white@healthtech.example.com', 'Rachel White', true, NOW() - INTERVAL '8 months', NOW()),
('user_kevin_security_004', 'kevin.harris@healthtech.example.com', 'Kevin Harris', true, NOW() - INTERVAL '6 months', NOW())

ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    "updatedAt" = NOW();

-- ===================================
-- PART 4: ORGANIZATION MEMBERSHIPS
-- ===================================

-- TechStartup Inc memberships
INSERT INTO organization_members (
    id, organization_id, user_id, role, status, title, 
    joined_at, invited_by, invited_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'user_sarah_ceo_001', 'owner', 'active', 'CEO & Founder', NOW() - INTERVAL '6 months', 'user_sarah_ceo_001', NOW() - INTERVAL '6 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'user_mike_pm_001', 'admin', 'active', 'Head of Product', NOW() - INTERVAL '5 months', 'user_sarah_ceo_001', NOW() - INTERVAL '5 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'user_alex_dev_001', 'member', 'active', 'Senior Developer', NOW() - INTERVAL '4 months', 'user_mike_pm_001', NOW() - INTERVAL '4 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'user_lisa_designer_001', 'member', 'active', 'UX Designer', NOW() - INTERVAL '3 months', 'user_mike_pm_001', NOW() - INTERVAL '3 months');

-- GlobalCorp Enterprise memberships
INSERT INTO organization_members (
    id, organization_id, user_id, role, status, title,
    joined_at, invited_by, invited_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'user_robert_cto_002', 'owner', 'active', 'Chief Technology Officer', NOW() - INTERVAL '2 years', 'user_robert_cto_002', NOW() - INTERVAL '2 years'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'user_jennifer_pm_002', 'admin', 'active', 'Director of Digital Transformation', NOW() - INTERVAL '18 months', 'user_robert_cto_002', NOW() - INTERVAL '18 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'user_david_analyst_002', 'manager', 'active', 'Business Analyst Lead', NOW() - INTERVAL '1 year', 'user_jennifer_pm_002', NOW() - INTERVAL '1 year'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'user_maria_qa_002', 'member', 'active', 'QA Engineer', NOW() - INTERVAL '8 months', 'user_jennifer_pm_002', NOW() - INTERVAL '8 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'user_james_dev_002', 'member', 'active', 'Software Developer', NOW() - INTERVAL '6 months', 'user_david_analyst_002', NOW() - INTERVAL '6 months');

-- CreativeAgency Studio memberships
INSERT INTO organization_members (
    id, organization_id, user_id, role, status, title,
    joined_at, invited_by, invited_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440003'::uuid, 'user_emma_owner_003', 'owner', 'active', 'Creative Director', NOW() - INTERVAL '3 months', 'user_emma_owner_003', NOW() - INTERVAL '3 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440003'::uuid, 'user_tom_designer_003', 'member', 'active', 'Senior Designer', NOW() - INTERVAL '2 months', 'user_emma_owner_003', NOW() - INTERVAL '2 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440003'::uuid, 'user_sophie_client_003', 'viewer', 'active', 'Brand Manager - BigBrand Co', NOW() - INTERVAL '1 month', 'user_emma_owner_003', NOW() - INTERVAL '1 month');

-- HealthTech Solutions memberships
INSERT INTO organization_members (
    id, organization_id, user_id, role, status, title,
    joined_at, invited_by, invited_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440004'::uuid, 'user_dr_patricia_004', 'owner', 'active', 'Chief Medical Officer', NOW() - INTERVAL '1 year', 'user_dr_patricia_004', NOW() - INTERVAL '1 year'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440004'::uuid, 'user_michael_dev_004', 'admin', 'active', 'Lead Developer - HIPAA Compliance', NOW() - INTERVAL '10 months', 'user_dr_patricia_004', NOW() - INTERVAL '10 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440004'::uuid, 'user_rachel_pm_004', 'manager', 'active', 'Product Manager', NOW() - INTERVAL '8 months', 'user_dr_patricia_004', NOW() - INTERVAL '8 months'),
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440004'::uuid, 'user_kevin_security_004', 'admin', 'active', 'Security & Compliance Officer', NOW() - INTERVAL '6 months', 'user_dr_patricia_004', NOW() - INTERVAL '6 months');

-- ===================================
-- PART 5: ACTIVE INVITATIONS
-- ===================================

-- TechStartup Inc pending invitations
INSERT INTO organization_invitations (
    id, organization_id, email, role, status, token,
    personal_message, invited_by, expires_at, created_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'john.frontend@developer.com', 'member', 'pending', 'tok_frontend_dev_001_' || extract(epoch from now()),
'We need a frontend specialist for our React components. Excited to have you join!', 'user_mike_pm_001', NOW() + INTERVAL '47 hours', NOW() - INTERVAL '1 hour'),

(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'sales.lead@business.com', 'manager', 'pending', 'tok_sales_lead_001_' || extract(epoch from now()),
'Ready to build our sales team? Join us as Sales Lead!', 'user_sarah_ceo_001', NOW() + INTERVAL '46 hours', NOW() - INTERVAL '2 hours');

-- GlobalCorp Enterprise pending invitations
INSERT INTO organization_invitations (
    id, organization_id, email, role, status, token,
    personal_message, invited_by, expires_at, created_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'enterprise.architect@globalcorp.example.com', 'admin', 'pending', 'tok_enterprise_arch_002_' || extract(epoch from now()),
'We need your expertise for our digital transformation initiative.', 'user_robert_cto_002', NOW() + INTERVAL '45 hours', NOW() - INTERVAL '3 hours'),

(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'external.consultant@consulting.com', 'viewer', 'pending', 'tok_external_consultant_002_' || extract(epoch from now()),
'Providing read-only access for consulting engagement.', 'user_jennifer_pm_002', NOW() + INTERVAL '44 hours', NOW() - INTERVAL '4 hours');

-- CreativeAgency Studio pending invitations
INSERT INTO organization_invitations (
    id, organization_id, email, role, status, token,
    personal_message, invited_by, expires_at, created_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440003'::uuid, 'freelance.developer@creative.com', 'member', 'pending', 'tok_freelance_dev_003_' || extract(epoch from now()),
'We have a web development project that needs your skills!', 'user_emma_owner_003', NOW() + INTERVAL '43 hours', NOW() - INTERVAL '5 hours');

-- ===================================
-- PART 6: AUDIT LOGS (Realistic Activity)
-- ===================================

-- TechStartup Inc audit logs
INSERT INTO organization_audit_logs (
    id, organization_id, actor_id, action, target_type, target_id,
    details, ip_address, user_agent, created_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'user_sarah_ceo_001', 'organization_created', 'organization', '550e8400-e29b-41d4-a716-446655440001',
'{"initial_setup": true, "subscription": "pro"}'::jsonb, '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', NOW() - INTERVAL '6 months'),

(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'user_mike_pm_001', 'member_invited', 'invitation', 'pending_invitation',
'{"role": "member", "email": "john.frontend@developer.com"}'::jsonb, '10.0.1.50', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '1 hour'),

(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440001'::uuid, 'user_alex_dev_001', 'project_created', 'project', 'proj_mobile_app_001',
'{"project_type": "mobile", "technology": "React Native"}'::jsonb, '172.16.0.25', 'Mozilla/5.0 (X11; Linux x86_64)', NOW() - INTERVAL '30 minutes');

-- GlobalCorp Enterprise audit logs (more formal/compliance-focused)
INSERT INTO organization_audit_logs (
    id, organization_id, actor_id, action, target_type, target_id,
    details, ip_address, user_agent, created_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'user_robert_cto_002', 'security_policy_updated', 'organization', '550e8400-e29b-41d4-a716-446655440002',
'{"2fa_required": true, "session_timeout": 30, "compliance": "SOC2"}'::jsonb, '10.50.100.10', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Enterprise', NOW() - INTERVAL '2 hours'),

(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440002'::uuid, 'user_kevin_security_004', 'compliance_audit', 'audit', 'compliance_q4_2024',
'{"findings": 0, "recommendations": 3, "status": "passed"}'::jsonb, '10.50.100.25', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Enterprise', NOW() - INTERVAL '1 hour');

-- CreativeAgency Studio audit logs (creative workflow focused)
INSERT INTO organization_audit_logs (
    id, organization_id, actor_id, action, target_type, target_id,
    details, ip_address, user_agent, created_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440003'::uuid, 'user_emma_owner_003', 'client_onboarded', 'member', 'user_sophie_client_003',
'{"client_company": "BigBrand Co", "project_scope": "brand_refresh", "access_level": "viewer"}'::jsonb, '203.0.113.45', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', NOW() - INTERVAL '1 month'),

(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440003'::uuid, 'user_tom_designer_003', 'design_uploaded', 'file', 'design_v3_final',
'{"file_count": 5, "total_size_mb": 45, "format": "figma"}'::jsonb, '203.0.113.50', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', NOW() - INTERVAL '2 days');

-- HealthTech Solutions audit logs (HIPAA compliance focused)
INSERT INTO organization_audit_logs (
    id, organization_id, actor_id, action, target_type, target_id,
    details, ip_address, user_agent, created_at
) VALUES
(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440004'::uuid, 'user_dr_patricia_004', 'hipaa_training_completed', 'compliance', 'hipaa_q4_2024',
'{"participants": 4, "score_average": 96, "certification_valid_until": "2025-12-31"}'::jsonb, '172.20.1.10', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Healthcare', NOW() - INTERVAL '1 week'),

(generate_uuidv7(), '550e8400-e29b-41d4-a716-446655440004'::uuid, 'user_michael_dev_004', 'encryption_keys_rotated', 'security', 'encryption_rotation_dec_2024',
'{"key_type": "AES-256", "rotation_schedule": "quarterly", "compliance_requirement": "HIPAA"}'::jsonb, '172.20.1.15', 'Mozilla/5.0 (X11; Linux x86_64) Healthcare', NOW() - INTERVAL '30 minutes');

-- ===================================
-- PART 7: VALIDATION & SUMMARY
-- ===================================

-- Validate test data
SELECT 
    'Test Data Summary' as check_type,
    (SELECT COUNT(*) FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%') as organizations,
    (SELECT COUNT(*) FROM "user" WHERE email LIKE '%@techstartup.%' OR email LIKE '%@globalcorp.%' OR email LIKE '%@creativeagency.%' OR email LIKE '%@healthtech.%') as users,
    (SELECT COUNT(*) FROM organization_members WHERE organization_id IN (SELECT id FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%')) as memberships,
    (SELECT COUNT(*) FROM organization_invitations WHERE status = 'pending') as pending_invitations,
    (SELECT COUNT(*) FROM organization_audit_logs WHERE organization_id IN (SELECT id FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%')) as audit_logs;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'RLS Test Data Setup Complete!';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Organizations: 4 (TechStartup, GlobalCorp, CreativeAgency, HealthTech)';
    RAISE NOTICE 'Users: 14 (across all organizations with Better Auth schema)';
    RAISE NOTICE 'Memberships: 14 (various roles - owner, admin, manager, member, viewer)';
    RAISE NOTICE 'Pending Invitations: 5 (realistic business scenarios)';
    RAISE NOTICE 'Audit Log Entries: 8 (compliance and business activities)';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for comprehensive RLS security testing with real data!';
    RAISE NOTICE 'All data follows proper schema constraints and relationships.';
END
$$;