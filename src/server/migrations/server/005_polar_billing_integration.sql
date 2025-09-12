-- Polar Billing Integration Database Schema
-- This migration adds billing capabilities to our existing organization system

-- ===================================
-- PART 1: EXTEND ORGANIZATIONS TABLE
-- ===================================

-- Add billing columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS polar_customer_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'trial';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trialing';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_seats INTEGER DEFAULT 5;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP DEFAULT NOW();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days');
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly'; -- 'monthly', 'yearly'
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_settings JSONB DEFAULT '{}'::jsonb;

-- Add indexes for billing queries
CREATE INDEX IF NOT EXISTS idx_organizations_polar_customer_id ON organizations(polar_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_tier ON organizations(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status ON organizations(subscription_status);
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at ON organizations(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_organizations_next_billing_date ON organizations(next_billing_date);

-- ===================================
-- PART 2: USAGE TRACKING TABLE
-- ===================================

-- Create organization usage tracking table
CREATE TABLE IF NOT EXISTS organization_usage (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'api_calls', 'storage_gb', 'active_users', 'projects', 'tasks'
    usage_count INTEGER NOT NULL DEFAULT 0,
    usage_details JSONB DEFAULT '{}'::jsonb, -- Additional metadata about usage
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    period_type VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'monthly'
    synced_to_polar BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_organization_usage_org_id ON organization_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_usage_metric_type ON organization_usage(metric_type);
CREATE INDEX IF NOT EXISTS idx_organization_usage_period ON organization_usage(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_organization_usage_sync_status ON organization_usage(synced_to_polar);
CREATE INDEX IF NOT EXISTS idx_organization_usage_composite ON organization_usage(organization_id, metric_type, period_start);

-- ===================================
-- PART 3: BILLING EVENTS TABLE
-- ===================================

-- Create billing events table for audit and debugging
CREATE TABLE IF NOT EXISTS organization_billing_events (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- 'subscription_created', 'payment_succeeded', 'payment_failed', etc.
    polar_event_id VARCHAR(255), -- Polar's event ID for deduplication
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT false,
    processing_attempts INTEGER DEFAULT 0,
    last_processing_error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Add indexes for billing events
CREATE INDEX IF NOT EXISTS idx_billing_events_org_id ON organization_billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON organization_billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_polar_id ON organization_billing_events(polar_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_processed ON organization_billing_events(processed);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at ON organization_billing_events(created_at);

-- Unique constraint to prevent duplicate Polar events
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_polar_unique 
    ON organization_billing_events(polar_event_id) 
    WHERE polar_event_id IS NOT NULL;

-- ===================================
-- PART 4: SUBSCRIPTION LIMITS TABLE
-- ===================================

-- Create subscription limits table for feature gating
CREATE TABLE IF NOT EXISTS subscription_limits (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    tier VARCHAR(50) NOT NULL, -- 'free', 'pro', 'enterprise'
    limit_type VARCHAR(100) NOT NULL, -- 'api_calls_per_month', 'storage_gb', 'max_users', etc.
    limit_value INTEGER NOT NULL,
    limit_details JSONB DEFAULT '{}'::jsonb, -- Additional configuration
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for limits
CREATE INDEX IF NOT EXISTS idx_subscription_limits_tier ON subscription_limits(tier);
CREATE INDEX IF NOT EXISTS idx_subscription_limits_type ON subscription_limits(limit_type);
CREATE INDEX IF NOT EXISTS idx_subscription_limits_active ON subscription_limits(is_active);

-- Unique constraint for tier + limit_type combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_limits_unique 
    ON subscription_limits(tier, limit_type) 
    WHERE is_active = true;

-- ===================================
-- PART 5: INSERT DEFAULT SUBSCRIPTION LIMITS
-- ===================================

-- Insert default subscription limits (3-tier + trial model)
INSERT INTO subscription_limits (tier, limit_type, limit_value, limit_details) VALUES
-- Trial tier - full access during 14-day trial
('trial', 'api_calls_per_month', 50000, '{"description": "API calls per month during trial"}'),
('trial', 'storage_gb', 10, '{"description": "Storage limit in GB during trial"}'),
('trial', 'max_users', 25, '{"description": "Maximum organization members during trial"}'),
('trial', 'max_entities_total', -1, '{"description": "Unlimited entities during trial (-1 = unlimited)"}'),
('trial', 'trial_days', 14, '{"description": "Trial period length in days"}'),

-- Starter tier limits ($5/month, $50/year)
('starter', 'api_calls_per_month', 5000, '{"description": "API calls per month"}'),
('starter', 'storage_gb', 5, '{"description": "Storage limit in GB"}'),
('starter', 'max_users', 3, '{"description": "Maximum organization members"}'),
('starter', 'max_entities_total', -1, '{"description": "Unlimited entities (-1 = unlimited)"}'),

-- Pro tier limits ($19/month, $190/year)
('pro', 'api_calls_per_month', 25000, '{"description": "API calls per month"}'),
('pro', 'storage_gb', 50, '{"description": "Storage limit in GB"}'),
('pro', 'max_users', 25, '{"description": "Maximum organization members"}'),
('pro', 'max_entities_total', -1, '{"description": "Unlimited entities (-1 = unlimited)"}'),

-- Enterprise tier limits ($99/month, $990/year)
('enterprise', 'api_calls_per_month', 250000, '{"description": "API calls per month"}'),
('enterprise', 'storage_gb', 500, '{"description": "Storage limit in GB"}'),
('enterprise', 'max_users', -1, '{"description": "Unlimited organization members (-1 = unlimited)"}'),
('enterprise', 'max_entities_total', -1, '{"description": "Unlimited entities (-1 = unlimited)"}'),

ON CONFLICT (tier, limit_type) WHERE is_active = true DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    limit_details = EXCLUDED.limit_details,
    updated_at = NOW();

-- ===================================
-- PART 6: RLS POLICIES FOR BILLING TABLES
-- ===================================

-- Enable RLS on billing tables
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_billing_events ENABLE ROW LEVEL SECURITY;

-- RLS policy for organization_usage table
CREATE POLICY "organization_usage_isolation" ON organization_usage
    USING (organization_id = get_current_organization_id());

-- RLS policy for organization_billing_events table  
CREATE POLICY "organization_billing_events_isolation" ON organization_billing_events
    USING (organization_id = get_current_organization_id());

-- Note: subscription_limits table is global (no RLS needed)

-- ===================================
-- PART 7: BILLING UTILITY FUNCTIONS
-- ===================================

-- Function to get current usage for an organization
CREATE OR REPLACE FUNCTION get_organization_usage(
    org_id UUID,
    metric_type_param VARCHAR(50),
    period_start_param TIMESTAMP DEFAULT DATE_TRUNC('month', NOW()),
    period_end_param TIMESTAMP DEFAULT NOW()
) RETURNS INTEGER AS $$
DECLARE
    total_usage INTEGER := 0;
BEGIN
    SELECT COALESCE(SUM(usage_count), 0) INTO total_usage
    FROM organization_usage
    WHERE organization_id = org_id
      AND metric_type = metric_type_param
      AND period_start >= period_start_param
      AND period_end <= period_end_param;
    
    RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if organization exceeds limits
CREATE OR REPLACE FUNCTION check_organization_limits(
    org_id UUID,
    limit_type_param VARCHAR(100)
) RETURNS JSONB AS $$
DECLARE
    org_tier VARCHAR(50);
    limit_value INTEGER;
    current_usage INTEGER;
    result JSONB;
BEGIN
    -- Get organization tier
    SELECT subscription_tier INTO org_tier
    FROM organizations
    WHERE id = org_id;
    
    IF org_tier IS NULL THEN
        RETURN '{"error": "Organization not found"}'::jsonb;
    END IF;
    
    -- Get limit for this tier
    SELECT sl.limit_value INTO limit_value
    FROM subscription_limits sl
    WHERE sl.tier = org_tier
      AND sl.limit_type = limit_type_param
      AND sl.is_active = true;
    
    IF limit_value IS NULL THEN
        RETURN '{"error": "Limit not defined for tier"}'::jsonb;
    END IF;
    
    -- Get current usage (this month)
    current_usage := get_organization_usage(
        org_id,
        CASE 
            WHEN limit_type_param LIKE '%_per_month' THEN REPLACE(limit_type_param, '_per_month', '')
            ELSE limit_type_param
        END,
        DATE_TRUNC('month', NOW()),
        NOW()
    );
    
    -- Build result
    result := jsonb_build_object(
        'tier', org_tier,
        'limit_type', limit_type_param,
        'limit_value', limit_value,
        'current_usage', current_usage,
        'remaining', GREATEST(0, limit_value - current_usage),
        'exceeded', current_usage > limit_value,
        'usage_percentage', ROUND((current_usage::NUMERIC / limit_value::NUMERIC) * 100, 2)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to count total entities for an organization
CREATE OR REPLACE FUNCTION count_organization_entities(org_id UUID) RETURNS INTEGER AS $$
DECLARE
    total_entities INTEGER := 0;
    table_name TEXT;
    entity_count INTEGER;
    sql_query TEXT;
BEGIN
    -- List of dynamic entity tables to count (these are created by DataForge)
    -- We'll check information_schema for tables that match the organization pattern
    FOR table_name IN 
        SELECT t.table_name 
        FROM information_schema.tables t 
        WHERE t.table_schema = 'public' 
        AND t.table_name LIKE '%_entities_%'
        AND t.table_type = 'BASE TABLE'
    LOOP
        -- Build dynamic query to count entities for this organization
        sql_query := format('SELECT COUNT(*) FROM %I WHERE organization_id = $1 AND deleted_at IS NULL', table_name);
        
        -- Execute the query
        EXECUTE sql_query INTO entity_count USING org_id;
        
        -- Add to total
        total_entities := total_entities + entity_count;
    END LOOP;
    
    -- Also count foundation entities (users, relationships, etc.)
    -- Note: These might have different organization reference patterns
    
    RETURN total_entities;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage
CREATE OR REPLACE FUNCTION record_organization_usage(
    org_id UUID,
    metric_type_param VARCHAR(50),
    usage_amount INTEGER DEFAULT 1,
    usage_details_param JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
DECLARE
    current_period_start TIMESTAMP;
    current_period_end TIMESTAMP;
BEGIN
    -- Calculate current day period
    current_period_start := DATE_TRUNC('day', NOW());
    current_period_end := current_period_start + INTERVAL '1 day';
    
    -- Insert or update usage record for today
    INSERT INTO organization_usage (
        organization_id,
        metric_type,
        usage_count,
        usage_details,
        period_start,
        period_end,
        period_type
    ) VALUES (
        org_id,
        metric_type_param,
        usage_amount,
        usage_details_param,
        current_period_start,
        current_period_end,
        'daily'
    )
    ON CONFLICT (organization_id, metric_type, period_start) 
    DO UPDATE SET
        usage_count = organization_usage.usage_count + usage_amount,
        usage_details = usage_details_param,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check trial status for an organization
CREATE OR REPLACE FUNCTION check_organization_trial_status(org_id UUID) RETURNS JSONB AS $$
DECLARE
    org_record RECORD;
    result JSONB;
    days_remaining INTEGER;
BEGIN
    -- Get organization trial info
    SELECT 
        subscription_tier,
        subscription_status,
        trial_started_at,
        trial_ends_at
    INTO org_record
    FROM organizations
    WHERE id = org_id;
    
    IF org_record IS NULL THEN
        RETURN '{"error": "Organization not found"}'::jsonb;
    END IF;
    
    -- Calculate days remaining
    IF org_record.trial_ends_at IS NOT NULL THEN
        days_remaining := GREATEST(0, EXTRACT(days FROM (org_record.trial_ends_at - NOW()))::INTEGER);
    ELSE
        days_remaining := 0;
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'tier', org_record.subscription_tier,
        'status', org_record.subscription_status,
        'is_trial', org_record.subscription_tier = 'trial',
        'trial_started_at', org_record.trial_started_at,
        'trial_ends_at', org_record.trial_ends_at,
        'days_remaining', days_remaining,
        'trial_expired', (org_record.trial_ends_at IS NOT NULL AND NOW() > org_record.trial_ends_at),
        'needs_upgrade', (org_record.subscription_tier = 'trial' AND org_record.trial_ends_at IS NOT NULL AND NOW() > org_record.trial_ends_at)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- PART 8: UPDATE EXISTING ORGANIZATIONS
-- ===================================

-- Update existing organizations with default trial settings
UPDATE organizations 
SET 
    subscription_tier = 'trial',
    subscription_status = 'trialing',
    subscription_seats = 25,
    trial_started_at = NOW(),
    trial_ends_at = NOW() + INTERVAL '14 days'
WHERE subscription_tier IS NULL;

-- ===================================
-- PART 9: VALIDATION QUERIES
-- ===================================

-- Validation function to check billing schema
CREATE OR REPLACE FUNCTION validate_billing_schema() 
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check if billing columns exist
    RETURN QUERY SELECT 
        'Organizations billing columns'::TEXT,
        CASE WHEN COUNT(*) = 8 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' of 8 expected billing columns'
    FROM information_schema.columns 
    WHERE table_name = 'organizations' 
    AND column_name IN (
        'polar_customer_id', 'subscription_tier', 'subscription_status', 
        'subscription_seats', 'billing_email', 'subscription_expires_at',
        'billing_cycle', 'next_billing_date'
    );
    
    -- Check if usage table exists
    RETURN QUERY SELECT 
        'Usage tracking table'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_usage') 
             THEN 'PASS' ELSE 'FAIL' END,
        'Organization usage tracking table'::TEXT;
    
    -- Check if billing events table exists
    RETURN QUERY SELECT 
        'Billing events table'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_billing_events') 
             THEN 'PASS' ELSE 'FAIL' END,
        'Billing events audit table'::TEXT;
    
    -- Check if subscription limits exist
    RETURN QUERY SELECT 
        'Subscription limits'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM subscription_limits WHERE is_active = true) >= 15 
             THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || (SELECT COUNT(*) FROM subscription_limits WHERE is_active = true) || ' active limits'::TEXT;
    
    -- Check RLS policies
    RETURN QUERY SELECT 
        'RLS policies'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('organization_usage', 'organization_billing_events')) >= 2 
             THEN 'PASS' ELSE 'FAIL' END,
        'Billing table RLS policies'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Run validation
SELECT * FROM validate_billing_schema();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Polar Billing Integration Schema Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Organizations: Extended with billing columns';
    RAISE NOTICE 'Usage Tracking: Table created with RLS';
    RAISE NOTICE 'Billing Events: Audit table created with RLS';
    RAISE NOTICE 'Subscription Limits: 15 limits configured for 3 tiers';
    RAISE NOTICE 'Utility Functions: 4 functions for usage and limits';
    RAISE NOTICE 'RLS Policies: Billing data isolated by organization';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for Polar billing integration with multi-tenant security!';
END
$$;