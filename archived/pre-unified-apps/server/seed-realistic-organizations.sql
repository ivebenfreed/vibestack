-- Realistic Multi-Tenant Data Seeding Script
-- Creates 2 organizations with realistic business data for testing

-- Clean up any existing test organizations first
DELETE FROM member WHERE "organizationId" IN (
  SELECT id FROM organization WHERE slug IN ('techflow-agency', 'startupboost-inc')
);
DELETE FROM organization WHERE slug IN ('techflow-agency', 'startupboost-inc');

-- =============================================================================
-- ORGANIZATION 1: TechFlow Agency (Digital Agency)
-- =============================================================================

-- Create TechFlow Agency organization
INSERT INTO organization (id, name, slug, "createdAt") VALUES 
('0198ab70-1000-7000-8000-000000000001', 'TechFlow Agency', 'techflow-agency', NOW() - INTERVAL '90 days');

-- Create TechFlow Agency users
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt") VALUES 
-- Owner
('0198ab70-1001-7000-8000-000000000001', 'Sarah Chen', 'sarah.chen@techflow.agency', true, NOW() - INTERVAL '90 days'),
-- Admins (Project Managers)
('0198ab70-1002-7000-8000-000000000001', 'Marcus Johnson', 'marcus.johnson@techflow.agency', true, NOW() - INTERVAL '85 days'),
('0198ab70-1003-7000-8000-000000000001', 'Elena Rodriguez', 'elena.rodriguez@techflow.agency', true, NOW() - INTERVAL '80 days'),
-- Members (Developers)
('0198ab70-1004-7000-8000-000000000001', 'Alex Kim', 'alex.kim@techflow.agency', true, NOW() - INTERVAL '75 days'),
('0198ab70-1005-7000-8000-000000000001', 'Jordan Williams', 'jordan.williams@techflow.agency', true, NOW() - INTERVAL '70 days'),
('0198ab70-1006-7000-8000-000000000001', 'Sam Patel', 'sam.patel@techflow.agency', true, NOW() - INTERVAL '65 days'),
-- Viewers (Clients)
('0198ab70-1007-7000-8000-000000000001', 'Jennifer Davis', 'jennifer.davis@retailcorp.com', true, NOW() - INTERVAL '60 days'),
('0198ab70-1008-7000-8000-000000000001', 'Michael Thompson', 'michael.thompson@financeplus.com', true, NOW() - INTERVAL '55 days');

-- Create TechFlow Agency memberships
INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES 
-- Owner
(generate_uuidv7(), '0198ab70-1000-7000-8000-000000000001', '0198ab70-1001-7000-8000-000000000001', 'owner', NOW() - INTERVAL '90 days'),
-- Admins
(generate_uuidv7(), '0198ab70-1000-7000-8000-000000000001', '0198ab70-1002-7000-8000-000000000001', 'admin', NOW() - INTERVAL '85 days'),
(generate_uuidv7(), '0198ab70-1000-7000-8000-000000000001', '0198ab70-1003-7000-8000-000000000001', 'admin', NOW() - INTERVAL '80 days'),
-- Members
(generate_uuidv7(), '0198ab70-1000-7000-8000-000000000001', '0198ab70-1004-7000-8000-000000000001', 'member', NOW() - INTERVAL '75 days'),
(generate_uuidv7(), '0198ab70-1000-7000-8000-000000000001', '0198ab70-1005-7000-8000-000000000001', 'member', NOW() - INTERVAL '70 days'),
(generate_uuidv7(), '0198ab70-1000-7000-8000-000000000001', '0198ab70-1006-7000-8000-000000000001', 'member', NOW() - INTERVAL '65 days'),
-- Viewers
(generate_uuidv7(), '0198ab70-1000-7000-8000-000000000001', '0198ab70-1007-7000-8000-000000000001', 'viewer', NOW() - INTERVAL '60 days'),
(generate_uuidv7(), '0198ab70-1000-7000-8000-000000000001', '0198ab70-1008-7000-8000-000000000001', 'viewer', NOW() - INTERVAL '55 days');

-- =============================================================================
-- ORGANIZATION 2: StartupBoost Inc (SaaS Startup)
-- =============================================================================

-- Create StartupBoost Inc organization
INSERT INTO organization (id, name, slug, "createdAt") VALUES 
('0198ab70-2000-7000-8000-000000000002', 'StartupBoost Inc', 'startupboost-inc', NOW() - INTERVAL '120 days');

-- Create StartupBoost Inc users
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt") VALUES 
-- Owner
('0198ab70-2001-7000-8000-000000000002', 'David Chen', 'david.chen@startupboost.com', true, NOW() - INTERVAL '120 days'),
-- Admins (Department Heads)
('0198ab70-2002-7000-8000-000000000002', 'Lisa Zhang', 'lisa.zhang@startupboost.com', true, NOW() - INTERVAL '115 days'),
('0198ab70-2003-7000-8000-000000000002', 'Ryan O''Connor', 'ryan.oconnor@startupboost.com', true, NOW() - INTERVAL '110 days'),
('0198ab70-2004-7000-8000-000000000002', 'Maya Sharma', 'maya.sharma@startupboost.com', true, NOW() - INTERVAL '105 days'),
-- Members (Engineers, Designers, Marketing)
('0198ab70-2005-7000-8000-000000000002', 'Carlos Mendez', 'carlos.mendez@startupboost.com', true, NOW() - INTERVAL '100 days'),
('0198ab70-2006-7000-8000-000000000002', 'Priya Gupta', 'priya.gupta@startupboost.com', true, NOW() - INTERVAL '95 days'),
('0198ab70-2007-7000-8000-000000000002', 'Jake Anderson', 'jake.anderson@startupboost.com', true, NOW() - INTERVAL '90 days'),
('0198ab70-2008-7000-8000-000000000002', 'Aisha Johnson', 'aisha.johnson@startupboost.com', true, NOW() - INTERVAL '85 days'),
('0198ab70-2009-7000-8000-000000000002', 'Kevin Liu', 'kevin.liu@startupboost.com', true, NOW() - INTERVAL '80 days'),
('0198ab70-2010-7000-8000-000000000002', 'Sophia Martinez', 'sophia.martinez@startupboost.com', true, NOW() - INTERVAL '75 days'),
('0198ab70-2011-7000-8000-000000000002', 'Tyler Brown', 'tyler.brown@startupboost.com', true, NOW() - INTERVAL '70 days'),
('0198ab70-2012-7000-8000-000000000002', 'Nina Kowalski', 'nina.kowalski@startupboost.com', true, NOW() - INTERVAL '65 days'),
-- Viewers (Advisors, Stakeholders)
('0198ab70-2013-7000-8000-000000000002', 'Robert Kim', 'robert.kim@venture.capital', true, NOW() - INTERVAL '60 days'),
('0198ab70-2014-7000-8000-000000000002', 'Amanda Foster', 'amanda.foster@advisory.board', true, NOW() - INTERVAL '55 days'),
('0198ab70-2015-7000-8000-000000000002', 'Thomas Wright', 'thomas.wright@board.member', true, NOW() - INTERVAL '50 days');

-- Create StartupBoost Inc memberships
INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES 
-- Owner
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2001-7000-8000-000000000002', 'owner', NOW() - INTERVAL '120 days'),
-- Admins
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2002-7000-8000-000000000002', 'admin', NOW() - INTERVAL '115 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2003-7000-8000-000000000002', 'admin', NOW() - INTERVAL '110 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2004-7000-8000-000000000002', 'admin', NOW() - INTERVAL '105 days'),
-- Members
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2005-7000-8000-000000000002', 'member', NOW() - INTERVAL '100 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2006-7000-8000-000000000002', 'member', NOW() - INTERVAL '95 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2007-7000-8000-000000000002', 'member', NOW() - INTERVAL '90 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2008-7000-8000-000000000002', 'member', NOW() - INTERVAL '85 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2009-7000-8000-000000000002', 'member', NOW() - INTERVAL '80 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2010-7000-8000-000000000002', 'member', NOW() - INTERVAL '75 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2011-7000-8000-000000000002', 'member', NOW() - INTERVAL '70 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2012-7000-8000-000000000002', 'member', NOW() - INTERVAL '65 days'),
-- Viewers
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2013-7000-8000-000000000002', 'viewer', NOW() - INTERVAL '60 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2014-7000-8000-000000000002', 'viewer', NOW() - INTERVAL '55 days'),
(generate_uuidv7(), '0198ab70-2000-7000-8000-000000000002', '0198ab70-2015-7000-8000-000000000002', 'viewer', NOW() - INTERVAL '50 days');

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify organization creation
SELECT name, slug, "createdAt" FROM organization WHERE slug IN ('techflow-agency', 'startupboost-inc');

-- Verify user counts per organization
SELECT 
  o.name,
  o.slug,
  COUNT(m.id) as member_count,
  COUNT(CASE WHEN m.role = 'owner' THEN 1 END) as owners,
  COUNT(CASE WHEN m.role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN m.role = 'member' THEN 1 END) as members,
  COUNT(CASE WHEN m.role = 'viewer' THEN 1 END) as viewers
FROM organization o
LEFT JOIN member m ON o.id = m."organizationId"
WHERE o.slug IN ('techflow-agency', 'startupboost-inc')
GROUP BY o.id, o.name, o.slug
ORDER BY o.slug;

-- List all users by organization
SELECT 
  o.name as org_name,
  u.name as user_name,
  u.email,
  m.role,
  m."createdAt"
FROM organization o
JOIN member m ON o.id = m."organizationId"
JOIN "user" u ON m."userId" = u.id
WHERE o.slug IN ('techflow-agency', 'startupboost-inc')
ORDER BY o.slug, m.role, u.name;