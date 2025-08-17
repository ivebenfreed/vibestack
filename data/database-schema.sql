--
-- PostgreSQL database dump
-- Test modification for pre-commit hook testing
--

-- Dumped from database version 17.5 (Debian 17.5-1.pgdg120+1)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: neon_control_plane; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA neon_control_plane;


ALTER SCHEMA neon_control_plane OWNER TO postgres;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: check_organization_limits(uuid, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_organization_limits(org_id uuid, limit_type_param character varying) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION public.check_organization_limits(org_id uuid, limit_type_param character varying) OWNER TO postgres;

--
-- Name: check_organization_trial_status(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_organization_trial_status(org_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION public.check_organization_trial_status(org_id uuid) OWNER TO postgres;

--
-- Name: cleanup_old_change_history(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_change_history(days_to_keep integer DEFAULT 30) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count BIGINT;
BEGIN
    DELETE FROM change_history 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_change_history(days_to_keep integer) OWNER TO postgres;

--
-- Name: clear_rls_context(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.clear_rls_context() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    PERFORM set_config('app.current_organization_id', NULL, true);
    PERFORM set_config('app.current_user_id', NULL, true);
    PERFORM set_config('app.current_user_role', NULL, true);
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION public.clear_rls_context() OWNER TO postgres;

--
-- Name: count_organization_entities(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.count_organization_entities(org_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
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
$_$;


ALTER FUNCTION public.count_organization_entities(org_id uuid) OWNER TO postgres;

--
-- Name: debug_org_check(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.debug_org_check() RETURNS uuid
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE NOTICE 'debug_org_check called, setting: %', current_setting('app.current_organization_id', true);
    RETURN current_setting('app.current_organization_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'debug_org_check error: %', SQLERRM;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.debug_org_check() OWNER TO postgres;

--
-- Name: disable_system_mode(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.disable_system_mode() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    PERFORM set_config('app.system_mode', 'false', false);
END;
$$;


ALTER FUNCTION public.disable_system_mode() OWNER TO postgres;

--
-- Name: enable_system_mode(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enable_system_mode() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    PERFORM set_config('app.system_mode', 'true', false);
END;
$$;


ALTER FUNCTION public.enable_system_mode() OWNER TO postgres;

--
-- Name: generate_uuidv7(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_uuidv7() RETURNS uuid
    LANGUAGE sql
    AS $$ SELECT gen_random_uuid(); $$;


ALTER FUNCTION public.generate_uuidv7() OWNER TO postgres;

--
-- Name: get_current_organization_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_current_organization_id() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN current_setting('app.current_organization_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.get_current_organization_id() OWNER TO postgres;

--
-- Name: FUNCTION get_current_organization_id(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_current_organization_id() IS 'RLS context function - gets current organization ID from session variable';


--
-- Name: get_current_user_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_current_user_id() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
EXCEPTION 
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;


ALTER FUNCTION public.get_current_user_id() OWNER TO postgres;

--
-- Name: get_current_user_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_current_user_role() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN current_setting('app.current_user_role', true);
EXCEPTION 
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;


ALTER FUNCTION public.get_current_user_role() OWNER TO postgres;

--
-- Name: get_organization_change_stats(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_organization_change_stats(org_id uuid, hours_back integer DEFAULT 24) RETURNS TABLE(change_count bigint, latest_lsn text, last_change_at timestamp without time zone, tables_affected text[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as change_count,
        MAX(ch.lsn) as latest_lsn,
        MAX(ch.created_at) as last_change_at,
        ARRAY_AGG(DISTINCT ch.table_name) as tables_affected
    FROM change_history ch
    WHERE ch.organization_id = org_id
      AND ch.created_at > NOW() - (hours_back || ' hours')::INTERVAL;
END;
$$;


ALTER FUNCTION public.get_organization_change_stats(org_id uuid, hours_back integer) OWNER TO postgres;

--
-- Name: get_organization_usage(uuid, character varying, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_organization_usage(org_id uuid, metric_type_param character varying, period_start_param timestamp without time zone DEFAULT date_trunc('month'::text, now()), period_end_param timestamp without time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION public.get_organization_usage(org_id uuid, metric_type_param character varying, period_start_param timestamp without time zone, period_end_param timestamp without time zone) OWNER TO postgres;

--
-- Name: get_secure_config(character varying, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_secure_config(config_key character varying, master_password text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    result TEXT;
    encrypted_data BYTEA;
BEGIN
    SELECT encrypted_value::BYTEA 
    INTO encrypted_data
    FROM secure_config 
    WHERE key = config_key;
    
    IF encrypted_data IS NULL THEN
        RAISE EXCEPTION 'Config key not found: %', config_key;
    END IF;
    
    SELECT pgp_sym_decrypt(encrypted_data, master_password::TEXT)
    INTO result;
    
    RETURN result;
EXCEPTION 
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to decrypt config for key: % (wrong password?)', config_key;
END;
$$;


ALTER FUNCTION public.get_secure_config(config_key character varying, master_password text) OWNER TO postgres;

--
-- Name: FUNCTION get_secure_config(config_key character varying, master_password text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_secure_config(config_key character varying, master_password text) IS 'Safely retrieve and decrypt configuration value';


--
-- Name: is_organization_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_organization_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_current_user_role() IN ('owner', 'admin');
END;
$$;


ALTER FUNCTION public.is_organization_admin() OWNER TO postgres;

--
-- Name: list_secure_config_keys(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.list_secure_config_keys() RETURNS TABLE(config_key character varying, config_description text, last_updated timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY 
    SELECT key, description, updated_at
    FROM secure_config 
    ORDER BY updated_at DESC;
END;
$$;


ALTER FUNCTION public.list_secure_config_keys() OWNER TO postgres;

--
-- Name: FUNCTION list_secure_config_keys(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.list_secure_config_keys() IS 'List all configuration keys without exposing values';


--
-- Name: record_organization_usage(uuid, character varying, integer, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_organization_usage(org_id uuid, metric_type_param character varying, usage_amount integer DEFAULT 1, usage_details_param jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION public.record_organization_usage(org_id uuid, metric_type_param character varying, usage_amount integer, usage_details_param jsonb) OWNER TO postgres;

--
-- Name: set_current_organization_id(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_current_organization_id(org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    PERFORM set_config('app.current_organization_id', org_id::TEXT, false);
END;
$$;


ALTER FUNCTION public.set_current_organization_id(org_id uuid) OWNER TO postgres;

--
-- Name: set_rls_context(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_rls_context(p_organization_id uuid, p_user_id text, p_user_role text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Set the organization context
    PERFORM set_config('app.current_organization_id', p_organization_id::text, true);
    PERFORM set_config('app.current_user_id', p_user_id, true);
    
    -- Set user role if provided
    IF p_user_role IS NOT NULL THEN
        PERFORM set_config('app.current_user_role', p_user_role, true);
    END IF;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION public.set_rls_context(p_organization_id uuid, p_user_id text, p_user_role text) OWNER TO postgres;

--
-- Name: FUNCTION set_rls_context(p_organization_id uuid, p_user_id text, p_user_role text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.set_rls_context(p_organization_id uuid, p_user_id text, p_user_role text) IS 'Sets RLS context for multi-tenant security - called by application middleware';


--
-- Name: set_secure_config(character varying, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_secure_config(config_key character varying, config_value text, master_password text, config_description text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO secure_config (key, encrypted_value, description, updated_at)
    VALUES (config_key, pgp_sym_encrypt(config_value, master_password), config_description, NOW())
    ON CONFLICT (key) 
    DO UPDATE SET 
        encrypted_value = pgp_sym_encrypt(config_value, master_password),
        description = COALESCE(config_description, secure_config.description),
        updated_at = NOW();
END;
$$;


ALTER FUNCTION public.set_secure_config(config_key character varying, config_value text, master_password text, config_description text) OWNER TO postgres;

--
-- Name: FUNCTION set_secure_config(config_key character varying, config_value text, master_password text, config_description text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.set_secure_config(config_key character varying, config_value text, master_password text, config_description text) IS 'Safely store encrypted configuration value';


--
-- Name: test_rls_isolation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.test_rls_isolation() RETURNS TABLE(test_name text, passed boolean, details text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Test 1: No context = no access
    PERFORM clear_rls_context();
    
    RETURN QUERY SELECT 
        'No context access test'::TEXT,
        (SELECT COUNT(*) FROM organizations) = 0,
        'Organizations should be inaccessible without context'::TEXT;
    
    -- Test 2: With context = proper access  
    PERFORM set_rls_context(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
        'test-user-id',
        'owner'
    );
    
    RETURN QUERY SELECT 
        'With context access test'::TEXT,
        TRUE, -- This would need actual test data to validate properly
        'Should only see organizations in context'::TEXT;
        
    -- Clean up
    PERFORM clear_rls_context();
END;
$$;


ALTER FUNCTION public.test_rls_isolation() OWNER TO postgres;

--
-- Name: update_organization_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_organization_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_organization_updated_at() OWNER TO postgres;

--
-- Name: validate_billing_schema(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_billing_schema() RETURNS TABLE(check_name text, status text, details text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.validate_billing_schema() OWNER TO postgres;

--
-- Name: validate_rls_context(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_rls_context() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if organization context is set
    IF get_current_organization_id() IS NULL THEN
        RAISE EXCEPTION 'Organization context not set - RLS security violation';
    END IF;
    
    -- Check if user context is set  
    IF get_current_user_id() IS NULL THEN
        RAISE EXCEPTION 'User context not set - RLS security violation';
    END IF;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION public.validate_rls_context() OWNER TO postgres;

--
-- Name: validate_rls_test_data(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_rls_test_data() RETURNS TABLE(check_name text, expected_count integer, actual_count integer, status text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check organizations
    RETURN QUERY SELECT 
        'Organizations'::TEXT, 
        4::INTEGER, 
        (SELECT COUNT(*)::INTEGER FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%'),
        CASE WHEN (SELECT COUNT(*) FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%') = 4 THEN 'PASS' ELSE 'FAIL' END;
    
    -- Check users
    RETURN QUERY SELECT 
        'Users'::TEXT,
        14::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM "user" WHERE email LIKE '%@techstartup.%' OR email LIKE '%@globalcorp.%' OR email LIKE '%@creativeagency.%' OR email LIKE '%@healthtech.%'),
        CASE WHEN (SELECT COUNT(*) FROM "user" WHERE email LIKE '%@techstartup.%' OR email LIKE '%@globalcorp.%' OR email LIKE '%@creativeagency.%' OR email LIKE '%@healthtech.%') = 14 THEN 'PASS' ELSE 'FAIL' END;
    
    -- Check memberships
    RETURN QUERY SELECT 
        'Memberships'::TEXT,
        14::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM organization_members WHERE organization_id IN (
            SELECT id FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%'
        )),
        CASE WHEN (SELECT COUNT(*) FROM organization_members WHERE organization_id IN (
            SELECT id FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%'
        )) = 14 THEN 'PASS' ELSE 'FAIL' END;
    
    -- Check invitations
    RETURN QUERY SELECT 
        'Invitations'::TEXT,
        4::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM organization_invitations WHERE status = 'pending'),
        CASE WHEN (SELECT COUNT(*) FROM organization_invitations WHERE status = 'pending') = 4 THEN 'PASS' ELSE 'FAIL' END;
    
    -- Check audit logs
    RETURN QUERY SELECT 
        'Audit Logs'::TEXT,
        8::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM organization_audit_logs WHERE organization_id IN (
            SELECT id FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%'
        )),
        CASE WHEN (SELECT COUNT(*) FROM organization_audit_logs WHERE organization_id IN (
            SELECT id FROM organizations WHERE name LIKE '%Corp%' OR name LIKE '%Tech%' OR name LIKE '%Creative%' OR name LIKE '%Health%'
        )) >= 8 THEN 'PASS' ELSE 'FAIL' END;
END;
$$;


ALTER FUNCTION public.validate_rls_test_data() OWNER TO postgres;

--
-- Name: validate_wal_rls_schema(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_wal_rls_schema() RETURNS TABLE(check_name text, status text, details text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if change_history table exists with correct columns
    RETURN QUERY SELECT 
        'Change history table structure'::TEXT,
        CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' of 7 expected columns'
    FROM information_schema.columns 
    WHERE table_name = 'change_history' 
    AND column_name IN (
        'id', 'lsn', 'organization_id', 'table_name', 
        'operation', 'data', 'client_id'
    );
    
    -- Check if RLS is enabled
    RETURN QUERY SELECT 
        'Row Level Security'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE c.relname = 'change_history' 
            AND n.nspname = 'public' 
            AND c.relrowsecurity = true
        ) THEN 'PASS' ELSE 'FAIL' END,
        'RLS enabled on change_history table'::TEXT;
    
    -- Check if RLS policies exist
    RETURN QUERY SELECT 
        'RLS policies'::TEXT,
        CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' RLS policies'
    FROM pg_policies 
    WHERE tablename = 'change_history';
    
    -- Check if indexes exist
    RETURN QUERY SELECT 
        'Performance indexes'::TEXT,
        CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' performance indexes'
    FROM pg_indexes 
    WHERE tablename = 'change_history';
    
    -- Check if helper functions exist
    RETURN QUERY SELECT 
        'RLS helper functions'::TEXT,
        CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' of 4 RLS helper functions'
    FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
        'get_current_organization_id', 'set_current_organization_id',
        'enable_system_mode', 'disable_system_mode'
    );
END;
$$;


ALTER FUNCTION public.validate_wal_rls_schema() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: endpoints; Type: TABLE; Schema: neon_control_plane; Owner: postgres
--

CREATE TABLE neon_control_plane.endpoints (
    endpoint_id character varying(255) NOT NULL,
    allowed_ips character varying(255)
);


ALTER TABLE neon_control_plane.endpoints OWNER TO postgres;

--
-- Name: account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp without time zone,
    "refreshTokenExpiresAt" timestamp without time zone,
    scope text,
    password text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.account OWNER TO postgres;

--
-- Name: anon_test_org_1755171376923_anonymous_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anon_test_org_1755171376923_anonymous_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id text NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    anonymous_field character varying(255)
);


ALTER TABLE public.anon_test_org_1755171376923_anonymous_tests OWNER TO postgres;

--
-- Name: audit_org_1755171369652_audit_test_taskss; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_org_1755171369652_audit_test_taskss (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id text NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    project_id uuid NOT NULL,
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    due_date date,
    completed_date timestamp with time zone,
    assignee_id uuid,
    assignee character varying(255) NOT NULL
);


ALTER TABLE public.audit_org_1755171369652_audit_test_taskss OWNER TO postgres;

--
-- Name: auth_test_org_1755171367708_auth_tracked_projectss; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_test_org_1755171367708_auth_tracked_projectss (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id text NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    project_owner character varying(255) NOT NULL,
    auth_test_field character varying(255)
);


ALTER TABLE public.auth_test_org_1755171367708_auth_tracked_projectss OWNER TO postgres;

--
-- Name: auth_test_org_auth_test_projectss; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_test_org_auth_test_projectss (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id text NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    client_name character varying(255) NOT NULL,
    budget integer
);


ALTER TABLE public.auth_test_org_auth_test_projectss OWNER TO postgres;

--
-- Name: change_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.change_history (
    id uuid DEFAULT public.generate_uuidv7() NOT NULL,
    lsn text NOT NULL,
    organization_id uuid,
    table_name text NOT NULL,
    operation text NOT NULL,
    data jsonb NOT NULL,
    client_id text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT change_history_lsn_format CHECK ((lsn ~ '^[0-9A-F]+/[0-9A-F]+$'::text)),
    CONSTRAINT change_history_operation_check CHECK ((operation = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);

ALTER TABLE ONLY public.change_history FORCE ROW LEVEL SECURITY;


ALTER TABLE public.change_history OWNER TO postgres;

--
-- Name: container_permission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.container_permission (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    user_id text,
    permission_container_type character varying(50) NOT NULL,
    permission_container_id text NOT NULL,
    role character varying(50) NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    granted_by_id text,
    expires_at timestamp with time zone,
    restrictions jsonb,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.container_permission OWNER TO postgres;

--
-- Name: entity_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_roles (
    id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.entity_roles OWNER TO postgres;

--
-- Name: error_test_org_1755170779580_test_tables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.error_test_org_1755170779580_test_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.error_test_org_1755170779580_test_tables OWNER TO postgres;

--
-- Name: invitation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invitation (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "inviterId" text NOT NULL
);


ALTER TABLE public.invitation OWNER TO postgres;

--
-- Name: isolation_org_a_1755170777829_shared_table_names; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.isolation_org_a_1755170777829_shared_table_names (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    org_specific_field character varying(255) NOT NULL
);


ALTER TABLE public.isolation_org_a_1755170777829_shared_table_names OWNER TO postgres;

--
-- Name: isolation_org_b_1755170777829_shared_table_names; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.isolation_org_b_1755170777829_shared_table_names (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    org_specific_field character varying(255) NOT NULL
);


ALTER TABLE public.isolation_org_b_1755170777829_shared_table_names OWNER TO postgres;

--
-- Name: member; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp without time zone NOT NULL
);


ALTER TABLE public.member OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_certification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_certification (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    user_id text,
    name character varying(255) NOT NULL,
    issuer character varying(255),
    issue_date date,
    expiry_date date,
    credential_id character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_certification OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_client; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_client (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    name character varying(255) NOT NULL,
    industry character varying(100),
    contact_email character varying(255),
    contract_value numeric(10,2),
    status character varying(50) DEFAULT 'active'::character varying,
    created_by text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_client OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_contract; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_contract (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    client_id text,
    project_id text,
    contract_number character varying(100),
    value numeric(10,2),
    signed_date date,
    start_date date,
    end_date date,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_contract OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_document; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_document (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    project_id text,
    title character varying(255) NOT NULL,
    description text,
    file_url character varying(255),
    file_size integer,
    file_type character varying(100),
    version character varying(50) DEFAULT '1.0'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_document OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_expense; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_expense (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    project_id text,
    user_id text,
    category character varying(100),
    amount numeric(8,2),
    description text,
    receipt_url character varying(255),
    date date,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_expense OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_invoice; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_invoice (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    client_id text,
    project_id text,
    invoice_number character varying(100),
    amount numeric(10,2),
    due_date date,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_invoice OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_meeting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_meeting (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    project_id text,
    title character varying(255) NOT NULL,
    description text,
    meeting_date timestamp with time zone,
    duration integer,
    location character varying(255),
    meeting_type character varying(50),
    status character varying(50) DEFAULT 'scheduled'::character varying,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_meeting OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_project; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_project (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    client_id text,
    name character varying(255) NOT NULL,
    description text,
    project_type character varying(100),
    budget numeric(10,2),
    start_date date,
    end_date date,
    status character varying(50) DEFAULT 'planning'::character varying,
    created_by text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_project OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_proposal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_proposal (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    client_id text,
    title character varying(255) NOT NULL,
    description text,
    estimated_value numeric(10,2),
    estimated_duration integer,
    status character varying(50) DEFAULT 'draft'::character varying,
    submitted_date date,
    created_by text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_proposal OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_resource; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_resource (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100),
    description text,
    availability_status character varying(50) DEFAULT 'available'::character varying,
    hourly_rate numeric(6,2),
    created_by text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_resource OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_skill; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_skill (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100),
    description text,
    level character varying(50),
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_skill OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_timesheet; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_timesheet (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-1000-7000-8000-000000000001'::text NOT NULL,
    project_id text,
    user_id text,
    date date,
    hours numeric(4,2),
    description text,
    billable boolean DEFAULT true,
    rate numeric(6,2),
    status character varying(50) DEFAULT 'submitted'::character varying,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_timesheet OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_activity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_activity (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    subject_type character varying(100) NOT NULL,
    subject_id text NOT NULL,
    activity_type character varying(100) NOT NULL,
    description text,
    metadata jsonb,
    performed_by text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_activity OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_attachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_attachment (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    attachable_type character varying(100) NOT NULL,
    attachable_id text NOT NULL,
    filename character varying(255) NOT NULL,
    file_url character varying(500),
    file_size integer,
    mime_type character varying(100),
    uploaded_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_attachment OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_comment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_comment (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    commentable_type character varying(100) NOT NULL,
    commentable_id text NOT NULL,
    content text NOT NULL,
    author_id text,
    is_internal boolean DEFAULT false,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_comment OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_contact; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_contact (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    company character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    created_by text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_contact OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_custom_field_definitio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_custom_field_definitio (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    entity_type character varying(100) NOT NULL,
    field_name character varying(100) NOT NULL,
    field_type character varying(50) NOT NULL,
    field_options jsonb,
    is_required boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_custom_field_definitio OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_custom_field_value; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_custom_field_value (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    field_definition_id text NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id text NOT NULL,
    value_text text,
    value_number numeric(15,4),
    value_date date,
    value_boolean boolean,
    value_json jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_custom_field_value OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_deal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_deal (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    title character varying(255) NOT NULL,
    value numeric(12,2),
    stage character varying(100),
    probability integer DEFAULT 50,
    close_date date,
    contact_id text,
    created_by text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_deal OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_sync_configuration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_sync_configuration (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    entity_type character varying(100) NOT NULL,
    sync_options jsonb NOT NULL,
    is_enabled boolean DEFAULT true,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_sync_configuration OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_tag (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7),
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_tag OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_tagging; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_tagging (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    tag_id text NOT NULL,
    taggable_type character varying(100) NOT NULL,
    taggable_id text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_tagging OWNER TO postgres;

--
-- Name: org_01920000_2000_7000_8000_000000000002_ticket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_2000_7000_8000_000000000002_ticket (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text DEFAULT '01920000-2000-7000-8000-000000000002'::text NOT NULL,
    subject character varying(255) NOT NULL,
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'open'::character varying,
    contact_id text,
    assigned_to text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_01920000_2000_7000_8000_000000000002_ticket OWNER TO postgres;

--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_members (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    organization_id text NOT NULL,
    user_id text NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.organization_members OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    settings jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: secure_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.secure_config (
    key character varying(255) NOT NULL,
    encrypted_value bytea NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.secure_config OWNER TO postgres;

--
-- Name: TABLE secure_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.secure_config IS 'Encrypted storage for API keys and secrets. Values are encrypted with master password.';


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "impersonatedBy" text,
    "activeOrganizationId" text
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: subscription_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_limits (
    id uuid DEFAULT public.generate_uuidv7() NOT NULL,
    tier character varying(50) NOT NULL,
    limit_type character varying(100) NOT NULL,
    limit_value integer NOT NULL,
    limit_details jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.subscription_limits OWNER TO postgres;

--
-- Name: task_org_api_1755170776840_development_tasks_apis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_org_api_1755170776840_development_tasks_apis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    project_id uuid NOT NULL,
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    due_date date,
    completed_date timestamp with time zone,
    assignee_id uuid,
    github_issue character varying(255),
    story_points integer,
    sprint character varying(255)
);


ALTER TABLE public.task_org_api_1755170776840_development_tasks_apis OWNER TO postgres;

--
-- Name: test_crud_final_final_crud_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_crud_final_final_crud_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id text NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    client_name character varying(255) NOT NULL,
    budget integer
);


ALTER TABLE public.test_crud_final_final_crud_tests OWNER TO postgres;

--
-- Name: test_crud_org_crud_test_projectss; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_crud_org_crud_test_projectss (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    client_name character varying(255) NOT NULL,
    budget integer
);


ALTER TABLE public.test_crud_org_crud_test_projectss OWNER TO postgres;

--
-- Name: test_crud_org_v2_crud_test_v2s; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_crud_org_v2_crud_test_v2s (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    client_name character varying(255) NOT NULL,
    budget integer
);


ALTER TABLE public.test_crud_org_v2_crud_test_v2s OWNER TO postgres;

--
-- Name: test_manual_org_manual_test_projectss; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_manual_org_manual_test_projectss (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    client_name character varying(255) NOT NULL,
    budget integer
);


ALTER TABLE public.test_manual_org_manual_test_projectss OWNER TO postgres;

--
-- Name: test_org_api_1755170768084_client_projects_apis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_org_api_1755170768084_client_projects_apis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    client_name character varying(255) NOT NULL,
    contract_value integer,
    project_phase character varying(255)
);


ALTER TABLE public.test_org_api_1755170768084_client_projects_apis OWNER TO postgres;

--
-- Name: test_org_api_1755170775829_client_projects_apis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_org_api_1755170775829_client_projects_apis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    client_name character varying(255) NOT NULL,
    contract_value integer,
    project_phase character varying(255)
);


ALTER TABLE public.test_org_api_1755170775829_client_projects_apis OWNER TO postgres;

--
-- Name: universal_entity_registry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.universal_entity_registry (
    org_id text NOT NULL,
    entity_name text NOT NULL,
    table_name text,
    definition json,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.universal_entity_registry OWNER TO postgres;

--
-- Name: user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."user" (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    name text,
    email text NOT NULL,
    "emailVerified" boolean DEFAULT false,
    image text,
    role text,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone,
    password text
);


ALTER TABLE public."user" OWNER TO postgres;

--
-- Name: user_org_a_1755171371820_user_isolated_recordss; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_org_a_1755171371820_user_isolated_recordss (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id text NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_data character varying(255) NOT NULL
);


ALTER TABLE public.user_org_a_1755171371820_user_isolated_recordss OWNER TO postgres;

--
-- Name: user_org_b_1755171371820_user_isolated_recordss; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_org_b_1755171371820_user_isolated_recordss (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id text NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_data character varying(255) NOT NULL
);


ALTER TABLE public.user_org_b_1755171371820_user_isolated_recordss OWNER TO postgres;

--
-- Name: validation_org_1755170780558_comprehensive_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.validation_org_1755170780558_comprehensive_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_id uuid,
    client_id uuid,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    end_date date,
    owner_id uuid,
    text_field character varying(255),
    longtext_field text,
    number_field integer,
    decimal_field integer,
    boolean_field boolean,
    date_field timestamp with time zone,
    datetime_field timestamp with time zone,
    json_field jsonb
);


ALTER TABLE public.validation_org_1755170780558_comprehensive_tests OWNER TO postgres;

--
-- Name: verification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone,
    "updatedAt" timestamp without time zone
);


ALTER TABLE public.verification OWNER TO postgres;

--
-- Name: endpoints endpoints_pkey; Type: CONSTRAINT; Schema: neon_control_plane; Owner: postgres
--

ALTER TABLE ONLY neon_control_plane.endpoints
    ADD CONSTRAINT endpoints_pkey PRIMARY KEY (endpoint_id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: anon_test_org_1755171376923_anonymous_tests anon_test_org_1755171376923_anonymous_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anon_test_org_1755171376923_anonymous_tests
    ADD CONSTRAINT anon_test_org_1755171376923_anonymous_tests_pkey PRIMARY KEY (id);


--
-- Name: audit_org_1755171369652_audit_test_taskss audit_org_1755171369652_audit_test_taskss_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_org_1755171369652_audit_test_taskss
    ADD CONSTRAINT audit_org_1755171369652_audit_test_taskss_pkey PRIMARY KEY (id);


--
-- Name: auth_test_org_1755171367708_auth_tracked_projectss auth_test_org_1755171367708_auth_tracked_projectss_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_test_org_1755171367708_auth_tracked_projectss
    ADD CONSTRAINT auth_test_org_1755171367708_auth_tracked_projectss_pkey PRIMARY KEY (id);


--
-- Name: auth_test_org_auth_test_projectss auth_test_org_auth_test_projectss_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_test_org_auth_test_projectss
    ADD CONSTRAINT auth_test_org_auth_test_projectss_pkey PRIMARY KEY (id);


--
-- Name: change_history change_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.change_history
    ADD CONSTRAINT change_history_pkey PRIMARY KEY (id);


--
-- Name: container_permission container_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.container_permission
    ADD CONSTRAINT container_permission_pkey PRIMARY KEY (id);


--
-- Name: container_permission container_permission_user_id_permission_container_type_perm_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.container_permission
    ADD CONSTRAINT container_permission_user_id_permission_container_type_perm_key UNIQUE (user_id, permission_container_type, permission_container_id);


--
-- Name: entity_roles entity_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_roles
    ADD CONSTRAINT entity_roles_pkey PRIMARY KEY (id);


--
-- Name: error_test_org_1755170779580_test_tables error_test_org_1755170779580_test_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.error_test_org_1755170779580_test_tables
    ADD CONSTRAINT error_test_org_1755170779580_test_tables_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: isolation_org_a_1755170777829_shared_table_names isolation_org_a_1755170777829_shared_table_names_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.isolation_org_a_1755170777829_shared_table_names
    ADD CONSTRAINT isolation_org_a_1755170777829_shared_table_names_pkey PRIMARY KEY (id);


--
-- Name: isolation_org_b_1755170777829_shared_table_names isolation_org_b_1755170777829_shared_table_names_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.isolation_org_b_1755170777829_shared_table_names
    ADD CONSTRAINT isolation_org_b_1755170777829_shared_table_names_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_certification org_01920000_1000_7000_8000_000000000001_certification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_certification
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_certification_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_client org_01920000_1000_7000_8000_000000000001_client_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_client
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_client_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_contract org_01920000_1000_7000_8000_000000000001_co_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_contract
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_co_contract_number_key UNIQUE (contract_number);


--
-- Name: org_01920000_1000_7000_8000_000000000001_contract org_01920000_1000_7000_8000_000000000001_contract_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_contract
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_contract_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_document org_01920000_1000_7000_8000_000000000001_document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_document
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_document_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_expense org_01920000_1000_7000_8000_000000000001_expense_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_expense
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_expense_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_invoice org_01920000_1000_7000_8000_000000000001_inv_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_invoice
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_inv_invoice_number_key UNIQUE (invoice_number);


--
-- Name: org_01920000_1000_7000_8000_000000000001_invoice org_01920000_1000_7000_8000_000000000001_invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_invoice
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_invoice_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_meeting org_01920000_1000_7000_8000_000000000001_meeting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_meeting
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_meeting_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_project org_01920000_1000_7000_8000_000000000001_project_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_project
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_project_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_proposal org_01920000_1000_7000_8000_000000000001_proposal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_proposal
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_proposal_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_resource org_01920000_1000_7000_8000_000000000001_resource_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_resource
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_resource_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_skill org_01920000_1000_7000_8000_000000000001_skill_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_skill
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_skill_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_timesheet org_01920000_1000_7000_8000_000000000001_timesheet_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_timesheet
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_timesheet_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_activity org_01920000_2000_7000_8000_000000000002_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_activity
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_activity_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_attachment org_01920000_2000_7000_8000_000000000002_attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_attachment
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_attachment_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_comment org_01920000_2000_7000_8000_000000000002_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_comment
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_comment_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_contact org_01920000_2000_7000_8000_000000000002_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_contact
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_contact_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_custom_field_definitio org_01920000_2000_7000_8000_000000000002_custom_field_defi_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_custom_field_definitio
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_custom_field_defi_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_custom_field_value org_01920000_2000_7000_8000_000000000002_custom_field_valu_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_custom_field_value
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_custom_field_valu_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_deal org_01920000_2000_7000_8000_000000000002_deal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_deal
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_deal_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_sync_configuration org_01920000_2000_7000_8000_000000000002_sync_configuratio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_sync_configuration
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_sync_configuratio_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_tag org_01920000_2000_7000_8000_000000000002_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_tag
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_tag_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_tagging org_01920000_2000_7000_8000_000000000002_tagging_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_tagging
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_tagging_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_2000_7000_8000_000000000002_ticket org_01920000_2000_7000_8000_000000000002_ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_2000_7000_8000_000000000002_ticket
    ADD CONSTRAINT org_01920000_2000_7000_8000_000000000002_ticket_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: secure_config secure_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.secure_config
    ADD CONSTRAINT secure_config_pkey PRIMARY KEY (key);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: subscription_limits subscription_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_limits
    ADD CONSTRAINT subscription_limits_pkey PRIMARY KEY (id);


--
-- Name: task_org_api_1755170776840_development_tasks_apis task_org_api_1755170776840_development_tasks_apis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_org_api_1755170776840_development_tasks_apis
    ADD CONSTRAINT task_org_api_1755170776840_development_tasks_apis_pkey PRIMARY KEY (id);


--
-- Name: test_crud_final_final_crud_tests test_crud_final_final_crud_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_crud_final_final_crud_tests
    ADD CONSTRAINT test_crud_final_final_crud_tests_pkey PRIMARY KEY (id);


--
-- Name: test_crud_org_crud_test_projectss test_crud_org_crud_test_projectss_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_crud_org_crud_test_projectss
    ADD CONSTRAINT test_crud_org_crud_test_projectss_pkey PRIMARY KEY (id);


--
-- Name: test_crud_org_v2_crud_test_v2s test_crud_org_v2_crud_test_v2s_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_crud_org_v2_crud_test_v2s
    ADD CONSTRAINT test_crud_org_v2_crud_test_v2s_pkey PRIMARY KEY (id);


--
-- Name: test_manual_org_manual_test_projectss test_manual_org_manual_test_projectss_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_manual_org_manual_test_projectss
    ADD CONSTRAINT test_manual_org_manual_test_projectss_pkey PRIMARY KEY (id);


--
-- Name: test_org_api_1755170768084_client_projects_apis test_org_api_1755170768084_client_projects_apis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_org_api_1755170768084_client_projects_apis
    ADD CONSTRAINT test_org_api_1755170768084_client_projects_apis_pkey PRIMARY KEY (id);


--
-- Name: test_org_api_1755170775829_client_projects_apis test_org_api_1755170775829_client_projects_apis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_org_api_1755170775829_client_projects_apis
    ADD CONSTRAINT test_org_api_1755170775829_client_projects_apis_pkey PRIMARY KEY (id);


--
-- Name: universal_entity_registry universal_entity_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.universal_entity_registry
    ADD CONSTRAINT universal_entity_registry_pkey PRIMARY KEY (org_id, entity_name);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user_org_a_1755171371820_user_isolated_recordss user_org_a_1755171371820_user_isolated_recordss_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_org_a_1755171371820_user_isolated_recordss
    ADD CONSTRAINT user_org_a_1755171371820_user_isolated_recordss_pkey PRIMARY KEY (id);


--
-- Name: user_org_b_1755171371820_user_isolated_recordss user_org_b_1755171371820_user_isolated_recordss_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_org_b_1755171371820_user_isolated_recordss
    ADD CONSTRAINT user_org_b_1755171371820_user_isolated_recordss_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: validation_org_1755170780558_comprehensive_tests validation_org_1755170780558_comprehensive_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.validation_org_1755170780558_comprehensive_tests
    ADD CONSTRAINT validation_org_1755170780558_comprehensive_tests_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: entity_roles_entity_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_roles_entity_lookup ON public.entity_roles USING btree (entity_type, entity_id);


--
-- Name: entity_roles_role_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_roles_role_lookup ON public.entity_roles USING btree (entity_type, role);


--
-- Name: entity_roles_unique_entity_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX entity_roles_unique_entity_user ON public.entity_roles USING btree (entity_type, entity_id, user_id);


--
-- Name: entity_roles_user_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_roles_user_lookup ON public.entity_roles USING btree (user_id);


--
-- Name: idx_anon_test_org_1755171376923_anonymous_tests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anon_test_org_1755171376923_anonymous_tests_created_at ON public.anon_test_org_1755171376923_anonymous_tests USING btree (created_at);


--
-- Name: idx_audit_org_1755171369652_audit_test_taskss_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_org_1755171369652_audit_test_taskss_created_at ON public.audit_org_1755171369652_audit_test_taskss USING btree (created_at);


--
-- Name: idx_auth_test_org_1755171367708_auth_tracked_projectss_created_; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_test_org_1755171367708_auth_tracked_projectss_created_ ON public.auth_test_org_1755171367708_auth_tracked_projectss USING btree (created_at);


--
-- Name: idx_auth_test_org_auth_test_projectss_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_test_org_auth_test_projectss_created_at ON public.auth_test_org_auth_test_projectss USING btree (created_at);


--
-- Name: idx_change_history_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_change_history_client_id ON public.change_history USING btree (client_id) WHERE (client_id IS NOT NULL);


--
-- Name: idx_change_history_lsn_pg; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_change_history_lsn_pg ON public.change_history USING btree (((lsn)::pg_lsn));


--
-- Name: idx_change_history_org_lsn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_change_history_org_lsn ON public.change_history USING btree (organization_id, lsn) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_change_history_org_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_change_history_org_time ON public.change_history USING btree (organization_id, created_at) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_change_history_system_lsn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_change_history_system_lsn ON public.change_history USING btree (lsn) WHERE (organization_id IS NULL);


--
-- Name: idx_change_history_table_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_change_history_table_org ON public.change_history USING btree (table_name, organization_id);


--
-- Name: idx_container_permission_container; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_container_permission_container ON public.container_permission USING btree (permission_container_type, permission_container_id);


--
-- Name: idx_container_permission_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_container_permission_user ON public.container_permission USING btree (user_id);


--
-- Name: idx_error_test_org_1755170779580_test_tables_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_error_test_org_1755170779580_test_tables_created_at ON public.error_test_org_1755170779580_test_tables USING btree (created_at);


--
-- Name: idx_isolation_org_a_1755170777829_shared_table_names_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_isolation_org_a_1755170777829_shared_table_names_created_at ON public.isolation_org_a_1755170777829_shared_table_names USING btree (created_at);


--
-- Name: idx_isolation_org_b_1755170777829_shared_table_names_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_isolation_org_b_1755170777829_shared_table_names_created_at ON public.isolation_org_b_1755170777829_shared_table_names USING btree (created_at);


--
-- Name: idx_secure_config_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_secure_config_key ON public.secure_config USING btree (key);


--
-- Name: idx_subscription_limits_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_limits_active ON public.subscription_limits USING btree (is_active);


--
-- Name: idx_subscription_limits_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_limits_tier ON public.subscription_limits USING btree (tier);


--
-- Name: idx_subscription_limits_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_limits_type ON public.subscription_limits USING btree (limit_type);


--
-- Name: idx_subscription_limits_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_subscription_limits_unique ON public.subscription_limits USING btree (tier, limit_type) WHERE (is_active = true);


--
-- Name: idx_task_org_api_1755170776840_development_tasks_apis_created_a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_org_api_1755170776840_development_tasks_apis_created_a ON public.task_org_api_1755170776840_development_tasks_apis USING btree (created_at);


--
-- Name: idx_test_crud_final_final_crud_tests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_crud_final_final_crud_tests_created_at ON public.test_crud_final_final_crud_tests USING btree (created_at);


--
-- Name: idx_test_crud_org_crud_test_projectss_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_crud_org_crud_test_projectss_created_at ON public.test_crud_org_crud_test_projectss USING btree (created_at);


--
-- Name: idx_test_crud_org_v2_crud_test_v2s_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_crud_org_v2_crud_test_v2s_created_at ON public.test_crud_org_v2_crud_test_v2s USING btree (created_at);


--
-- Name: idx_test_manual_org_manual_test_projectss_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_manual_org_manual_test_projectss_created_at ON public.test_manual_org_manual_test_projectss USING btree (created_at);


--
-- Name: idx_test_org_api_1755170768084_client_projects_apis_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_org_api_1755170768084_client_projects_apis_created_at ON public.test_org_api_1755170768084_client_projects_apis USING btree (created_at);


--
-- Name: idx_test_org_api_1755170775829_client_projects_apis_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_org_api_1755170775829_client_projects_apis_created_at ON public.test_org_api_1755170775829_client_projects_apis USING btree (created_at);


--
-- Name: idx_user_org_a_1755171371820_user_isolated_recordss_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_org_a_1755171371820_user_isolated_recordss_created_at ON public.user_org_a_1755171371820_user_isolated_recordss USING btree (created_at);


--
-- Name: idx_user_org_b_1755171371820_user_isolated_recordss_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_org_b_1755171371820_user_isolated_recordss_created_at ON public.user_org_b_1755171371820_user_isolated_recordss USING btree (created_at);


--
-- Name: idx_validation_org_1755170780558_comprehensive_tests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_validation_org_1755170780558_comprehensive_tests_created_at ON public.validation_org_1755170780558_comprehensive_tests USING btree (created_at);


--
-- Name: session_userid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX session_userid_idx ON public.session USING btree ("userId");


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: container_permission container_permission_granted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.container_permission
    ADD CONSTRAINT container_permission_granted_by_id_fkey FOREIGN KEY (granted_by_id) REFERENCES public."user"(id);


--
-- Name: container_permission container_permission_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.container_permission
    ADD CONSTRAINT container_permission_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES public."user"(id);


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: change_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.change_history ENABLE ROW LEVEL SECURITY;

--
-- Name: change_history change_history_org_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY change_history_org_isolation ON public.change_history USING (((current_setting('app.system_mode'::text, true) = 'true'::text) OR (organization_id = (current_setting('app.current_organization_id'::text, true))::uuid)));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO vibestack_app;
GRANT USAGE ON SCHEMA public TO rls_test_user;
GRANT USAGE ON SCHEMA public TO vibestack_app_user;


--
-- Name: FUNCTION set_config(text, text, boolean); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.set_config(text, text, boolean) TO test_user;


--
-- Name: FUNCTION clear_rls_context(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.clear_rls_context() TO vibestack_app;


--
-- Name: FUNCTION disable_system_mode(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.disable_system_mode() TO rls_test_user;
GRANT ALL ON FUNCTION public.disable_system_mode() TO vibestack_app_user;


--
-- Name: FUNCTION enable_system_mode(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.enable_system_mode() TO rls_test_user;
GRANT ALL ON FUNCTION public.enable_system_mode() TO vibestack_app_user;


--
-- Name: FUNCTION get_current_organization_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_current_organization_id() TO vibestack_app;
GRANT ALL ON FUNCTION public.get_current_organization_id() TO rls_test_user;


--
-- Name: FUNCTION get_current_user_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_current_user_id() TO vibestack_app;


--
-- Name: FUNCTION get_current_user_role(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_current_user_role() TO vibestack_app;


--
-- Name: FUNCTION is_organization_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_organization_admin() TO vibestack_app;


--
-- Name: FUNCTION set_current_organization_id(org_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_current_organization_id(org_id uuid) TO rls_test_user;
GRANT ALL ON FUNCTION public.set_current_organization_id(org_id uuid) TO vibestack_app_user;


--
-- Name: FUNCTION set_rls_context(p_organization_id uuid, p_user_id text, p_user_role text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_rls_context(p_organization_id uuid, p_user_id text, p_user_role text) TO vibestack_app;


--
-- Name: FUNCTION validate_rls_context(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.validate_rls_context() TO vibestack_app;


--
-- Name: TABLE account; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account TO vibestack_app;
GRANT SELECT ON TABLE public.account TO test_user;


--
-- Name: TABLE anon_test_org_1755171376923_anonymous_tests; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.anon_test_org_1755171376923_anonymous_tests TO vibestack_app;
GRANT SELECT ON TABLE public.anon_test_org_1755171376923_anonymous_tests TO test_user;


--
-- Name: TABLE audit_org_1755171369652_audit_test_taskss; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_org_1755171369652_audit_test_taskss TO vibestack_app;
GRANT SELECT ON TABLE public.audit_org_1755171369652_audit_test_taskss TO test_user;


--
-- Name: TABLE auth_test_org_1755171367708_auth_tracked_projectss; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.auth_test_org_1755171367708_auth_tracked_projectss TO vibestack_app;
GRANT SELECT ON TABLE public.auth_test_org_1755171367708_auth_tracked_projectss TO test_user;


--
-- Name: TABLE auth_test_org_auth_test_projectss; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.auth_test_org_auth_test_projectss TO vibestack_app;
GRANT SELECT ON TABLE public.auth_test_org_auth_test_projectss TO test_user;


--
-- Name: TABLE change_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.change_history TO rls_test_user;
GRANT SELECT ON TABLE public.change_history TO test_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.change_history TO vibestack_app_user;


--
-- Name: TABLE container_permission; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.container_permission TO vibestack_app;
GRANT SELECT ON TABLE public.container_permission TO test_user;


--
-- Name: TABLE entity_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.entity_roles TO vibestack_app;
GRANT SELECT ON TABLE public.entity_roles TO test_user;


--
-- Name: TABLE error_test_org_1755170779580_test_tables; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.error_test_org_1755170779580_test_tables TO vibestack_app;
GRANT SELECT ON TABLE public.error_test_org_1755170779580_test_tables TO test_user;


--
-- Name: TABLE invitation; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.invitation TO vibestack_app;
GRANT SELECT ON TABLE public.invitation TO test_user;


--
-- Name: TABLE isolation_org_a_1755170777829_shared_table_names; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.isolation_org_a_1755170777829_shared_table_names TO vibestack_app;
GRANT SELECT ON TABLE public.isolation_org_a_1755170777829_shared_table_names TO test_user;


--
-- Name: TABLE isolation_org_b_1755170777829_shared_table_names; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.isolation_org_b_1755170777829_shared_table_names TO vibestack_app;
GRANT SELECT ON TABLE public.isolation_org_b_1755170777829_shared_table_names TO test_user;


--
-- Name: TABLE member; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.member TO vibestack_app;
GRANT SELECT ON TABLE public.member TO test_user;


--
-- Name: TABLE session; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.session TO vibestack_app;
GRANT SELECT ON TABLE public.session TO test_user;


--
-- Name: TABLE subscription_limits; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.subscription_limits TO vibestack_app;
GRANT SELECT ON TABLE public.subscription_limits TO test_user;


--
-- Name: TABLE task_org_api_1755170776840_development_tasks_apis; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_org_api_1755170776840_development_tasks_apis TO vibestack_app;
GRANT SELECT ON TABLE public.task_org_api_1755170776840_development_tasks_apis TO test_user;


--
-- Name: TABLE test_crud_final_final_crud_tests; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.test_crud_final_final_crud_tests TO vibestack_app;
GRANT SELECT ON TABLE public.test_crud_final_final_crud_tests TO test_user;


--
-- Name: TABLE test_crud_org_crud_test_projectss; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.test_crud_org_crud_test_projectss TO vibestack_app;
GRANT SELECT ON TABLE public.test_crud_org_crud_test_projectss TO test_user;


--
-- Name: TABLE test_crud_org_v2_crud_test_v2s; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.test_crud_org_v2_crud_test_v2s TO vibestack_app;
GRANT SELECT ON TABLE public.test_crud_org_v2_crud_test_v2s TO test_user;


--
-- Name: TABLE test_manual_org_manual_test_projectss; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.test_manual_org_manual_test_projectss TO vibestack_app;
GRANT SELECT ON TABLE public.test_manual_org_manual_test_projectss TO test_user;


--
-- Name: TABLE test_org_api_1755170768084_client_projects_apis; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.test_org_api_1755170768084_client_projects_apis TO vibestack_app;
GRANT SELECT ON TABLE public.test_org_api_1755170768084_client_projects_apis TO test_user;


--
-- Name: TABLE test_org_api_1755170775829_client_projects_apis; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.test_org_api_1755170775829_client_projects_apis TO vibestack_app;
GRANT SELECT ON TABLE public.test_org_api_1755170775829_client_projects_apis TO test_user;


--
-- Name: TABLE universal_entity_registry; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.universal_entity_registry TO vibestack_app;
GRANT SELECT ON TABLE public.universal_entity_registry TO test_user;


--
-- Name: TABLE "user"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public."user" TO vibestack_app;
GRANT SELECT ON TABLE public."user" TO test_user;


--
-- Name: TABLE user_org_a_1755171371820_user_isolated_recordss; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_org_a_1755171371820_user_isolated_recordss TO vibestack_app;
GRANT SELECT ON TABLE public.user_org_a_1755171371820_user_isolated_recordss TO test_user;


--
-- Name: TABLE user_org_b_1755171371820_user_isolated_recordss; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_org_b_1755171371820_user_isolated_recordss TO vibestack_app;
GRANT SELECT ON TABLE public.user_org_b_1755171371820_user_isolated_recordss TO test_user;


--
-- Name: TABLE validation_org_1755170780558_comprehensive_tests; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.validation_org_1755170780558_comprehensive_tests TO vibestack_app;
GRANT SELECT ON TABLE public.validation_org_1755170780558_comprehensive_tests TO test_user;


--
-- Name: TABLE verification; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.verification TO vibestack_app;
GRANT SELECT ON TABLE public.verification TO test_user;


--
-- PostgreSQL database dump complete
--

