--
-- PostgreSQL database dump
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
-- Data for Name: endpoints; Type: TABLE DATA; Schema: neon_control_plane; Owner: postgres
--

COPY neon_control_plane.endpoints (endpoint_id, allowed_ips) FROM stdin;
\.


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", scope, password, "createdAt", "updatedAt") FROM stdin;
0198aed6-cf7c-78ce-917f-87cb0475eb67	0198aed6-cc0b-783b-b414-c5fb8a81f227	credential	0198aed6-cc0b-783b-b414-c5fb8a81f227	\N	\N	\N	\N	\N	\N	$2b$12$UkgwO6dP5ESpW4LcTIneguT5qCkwGzl4vPEuLxlhJsym0cUL6Jfza	2025-08-15 13:46:10.17	2025-08-17 12:41:50.516602
0198b046-d417-7959-b179-e182de5ea58c	0198b046-d127-769d-9bc2-8e5824b71b3a	credential	0198b046-d127-769d-9bc2-8e5824b71b3a	\N	\N	\N	\N	\N	\N	132c624bc16310d13c18137e9e07a6c1:5f03f8d47d52faf071a0c871d191ae59d9ebabe36a66cd9f48c8766f1db6ed12194f0d7ccf45d2197ae6bd5586d832ba5cad119be3f69f23e2599d44c6d3891f	2025-08-15 20:28:08.598	2025-08-17 12:55:09.422639
0198b2d6-f2ab-729d-8009-e5eda40674ba	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	credential	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	\N	\N	\N	\N	\N	\N	88eba63d13a9d903593ab5b0fa23be53:984fd32fecb6c8270cfa9ba42e71e2c519b0ec520e4cb16814f984e64eacfea84375e817ad674521485332f93bdbce615d18cfc0e2e5f739485cb0d54bb94bd4	2025-08-16 08:24:48.043	2025-08-16 08:24:48.043
0198b046-e3c4-7d30-b229-4c331594aff2	0198b046-e16b-7b46-a15e-baa49fd29990	credential	0198b046-e16b-7b46-a15e-baa49fd29990	\N	\N	\N	\N	\N	\N	$2b$12$68H96svCejJIiTnncWJO/.KGreKFVgVylSL7TAiBxwFx5KZoUB3/O	2025-08-15 20:28:12.612	2025-08-17 12:55:10.186406
0198b046-eb49-7a71-b01f-e90e09b6d1f3	0198b046-e873-7739-bac2-10db9440486b	credential	0198b046-e873-7739-bac2-10db9440486b	\N	\N	\N	\N	\N	\N	$2b$12$mALd9lLsH5p5TzERnvAmSOgaG6GD/CzdPemEkd2UII8pODiPn7iKe	2025-08-15 20:28:14.537	2025-08-17 12:55:10.609352
0198b046-f2ae-7c59-8714-f327c6626a5c	0198b046-f056-7735-a3aa-60e8a329dd23	credential	0198b046-f056-7735-a3aa-60e8a329dd23	\N	\N	\N	\N	\N	\N	$2b$12$CKAeG/Wme8JtNsQaDnnBkuTY9a898Me3/fDsPJ7Ym9k8wCE8njn4O	2025-08-15 20:28:16.43	2025-08-17 12:55:11.082967
0198b046-f958-782b-af9c-707c2a3a22a5	0198b046-f71e-7bec-a853-294d7cbcbda5	credential	0198b046-f71e-7bec-a853-294d7cbcbda5	\N	\N	\N	\N	\N	\N	$2b$12$VdwNBJWrtU2GynBWVd3xjeYrvdkRQudkKntGOyH6PAhbkOLfXZ4FW	2025-08-15 20:28:18.136	2025-08-17 12:55:11.605335
0198b047-0117-7052-b246-a59076c5eb4d	0198b046-fe7a-7855-b4d8-4408253dc9c5	credential	0198b046-fe7a-7855-b4d8-4408253dc9c5	\N	\N	\N	\N	\N	\N	$2b$12$.e0lFAaKpiSYmrHFk9AgseXwDrGtPipiPBR78qwLBcX3gD87vknm.	2025-08-15 20:28:20.118	2025-08-17 12:55:12.018692
0198b046-cbe0-7f68-a1ed-361fb868f90d	0198b046-c453-72d9-b71a-092e1f75601a	credential	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	\N	\N	\N	\N	1e6ae2822930932a48ac98d40244c50e:959b5fe47cd091564b4f4cefa2dfa6badfc139a58b0c12641a16616d37ce86db7b328b2c30884ac77a8bd0fb589b2491d6a3e19dad418911beec9c41bd6b47b9	2025-08-15 20:28:06.496	2025-08-17 12:55:09.026104
0198b046-dcaa-79d6-b752-2500ac8a70a0	0198b046-d931-7772-a1e8-b63c68c7f43d	credential	0198b046-d931-7772-a1e8-b63c68c7f43d	\N	\N	\N	\N	\N	\N	ef938dff1c3f0f0632a550fcd129f7e9:e80c65faa89d32ca856122c1e5209cce10c99b9d6b4b2b5ab5942d1e517300dfce5e15e2c78eab568336370944c3bf5e5fe14ecbf74676bd40ac1c5cc0d84c29	2025-08-15 20:28:10.793	2025-08-17 12:55:09.828288
\.


--
-- Data for Name: anon_test_org_1755171376923_anonymous_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.anon_test_org_1755171376923_anonymous_tests (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, anonymous_field) FROM stdin;
\.


--
-- Data for Name: audit_org_1755171369652_audit_test_taskss; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_org_1755171369652_audit_test_taskss (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, project_id, description, priority, start_date, due_date, completed_date, assignee_id, assignee) FROM stdin;
\.


--
-- Data for Name: auth_test_org_1755171367708_auth_tracked_projectss; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auth_test_org_1755171367708_auth_tracked_projectss (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, project_owner, auth_test_field) FROM stdin;
\.


--
-- Data for Name: auth_test_org_auth_test_projectss; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auth_test_org_auth_test_projectss (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, client_name, budget) FROM stdin;
\.


--
-- Data for Name: change_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.change_history (id, lsn, organization_id, table_name, operation, data, client_id, created_at) FROM stdin;
3fc2f68d-f498-4b44-bcff-4f56a5e224dd	0/2000001	123e4567-e89b-12d3-a456-426614174000	test_stats	insert	{"test": "data"}	\N	2025-08-14 23:47:08.115281
2f909fd9-59ec-43ea-bbce-a98f568d1acc	0/1000001	123e4567-e89b-12d3-a456-426614174000	org_projects	insert	{"id": "proj-1", "name": "Org 1 Project"}	\N	2025-08-15 01:08:15.728444
80575c13-dfea-4362-86dc-3a2b69e1989c	0/1000002	987fcdeb-51a2-43d7-8293-123456789abc	org_tasks	insert	{"id": "task-1", "title": "Org 2 Task"}	\N	2025-08-15 01:08:15.728444
57a9061e-d568-4dda-9251-ce0523b949d2	0/1000003	123e4567-e89b-12d3-a456-426614174000	webhooks_table	update	{"id": "webhook-1", "status": "processed"}	\N	2025-08-15 01:08:15.728444
0b708377-53da-43c0-8b27-8d08d7ea24c9	0/FF000000	550e8400-e29b-41d4-a716-446655440001	org_550e8400_e29b_41d4_a716_446655440001_project	insert	{"id": "test-project", "name": "Test Organization-Aware Project"}	test-client-123	2025-08-15 02:28:34.484757
261ef98d-1361-4157-b67a-72b79c083f5e	0/16B2C48	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "01234567-1111-7777-8888-123456789abc", "name": "TechFlow Project Alpha", "description": "Secret project for TechFlow only", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-client-1	2025-08-15 19:10:48.205735
96494010-3906-490a-9573-aef06befb2b4	0/16B2C49	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "01234567-2222-7777-8888-123456789abc", "title": "TechFlow Task Alpha", "description": "Confidential task for TechFlow team", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-client-1	2025-08-15 19:10:48.209945
0f4b048a-f0d8-4b82-98b6-d144d38d41c2	0/16B2C50	01234567-89ab-cdef-0123-456789abcdef	projects	insert	{"id": "01234567-3333-7777-8888-123456789abc", "name": "Isolation Test Project", "description": "This should NOT be visible to TechFlow", "organization_id": "01234567-89ab-cdef-0123-456789abcdef"}	isolation-client-1	2025-08-15 19:10:48.212595
ea8c1899-2797-45a9-a742-cb150e639703	0/16B2C51	01234567-89ab-cdef-0123-456789abcdef	tasks	insert	{"id": "01234567-4444-7777-8888-123456789abc", "title": "Isolation Test Task", "description": "This should NOT be visible to TechFlow either", "organization_id": "01234567-89ab-cdef-0123-456789abcdef"}	isolation-client-1	2025-08-15 19:10:48.215454
700e3564-6269-4830-9aa7-7728295dfa8a	0/16B2C52	934fd0a8-f306-4f13-a544-094282f047eb	tasks	update	{"id": "01234567-2222-7777-8888-123456789abc", "title": "TechFlow Task Alpha - Updated", "status": "in_progress", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-client-2	2025-08-15 19:10:48.217713
bac313e3-c1ea-461c-837e-c2e27ac52efd	0/16B2C48	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "abc03c39-f53f-4d8d-990b-1a5a955c7696", "name": "TechFlow Project - Should be visible", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-test	2025-08-15 19:17:28.853959
fb032c9a-7ec1-457e-a1ad-297176b36356	0/16B2C48	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "e03c2f30-93c1-4c7a-8c40-adf03daf4f35", "name": "TechFlow Project - Should be visible", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-test	2025-08-15 19:17:49.469012
006be6d4-9d88-4134-ad36-c3b1eb14494a	0/16B2C49	11111111-2222-3333-4444-555555555555	projects	insert	{"id": "9ec114de-b0f3-4c98-a67b-ee6772d57afe", "name": "Other Org Project - Should NOT be visible", "organization_id": "11111111-2222-3333-4444-555555555555"}	other-test	2025-08-15 19:17:49.472838
96ec0e89-1f70-4dd8-99dd-8d0ef5ba6fe9	0/16B2C60	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "3377394f-b1b7-4892-b125-047021fa95c8", "title": "TechFlow Sync Test Task", "description": "This should be visible to TechFlow sync", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-sync-test	2025-08-15 19:39:53.22383
3f7e8a02-619a-4efd-8dfa-836cae8bf9c6	0/16B2C61	11111111-2222-3333-4444-555555555555	tasks	insert	{"id": "c6a491b3-5c81-4d14-bf77-3083b54f61c4", "title": "Other Org Sync Test Task", "description": "This should NOT be visible to TechFlow sync", "organization_id": "11111111-2222-3333-4444-555555555555"}	other-sync-test	2025-08-15 19:39:53.23248
bcd16699-4d0e-4c03-bcf0-23202df06a04	0/16B2C62	934fd0a8-f306-4f13-a544-094282f047eb	projects	update	{"id": "908ff3d1-0a23-4770-a532-25837fe6a852", "name": "TechFlow Updated Project", "status": "in_progress", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-sync-test	2025-08-15 19:39:53.235188
d372606c-05ef-418f-811f-3015d352e778	0/16B2D01	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "55483241-3bbb-48ee-9d4e-0d900859f0ce", "name": "TechFlow Secret Project Alpha", "budget": 150000, "description": "CONFIDENTIAL: This should only be visible to TechFlow", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 19:47:56.441988
8474c9ea-8eda-40df-ae2b-36b39cf41c99	0/16B2D02	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "d8f3a37c-ae11-4656-af53-abfd36990db3", "title": "TechFlow Internal Task", "description": "Internal task - should not leak to other orgs", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 19:47:56.460062
632a7c62-d75b-47d2-b087-e5fe17a0c39e	0/16B2D03	11111111-2222-3333-4444-555555555555	projects	insert	{"id": "02858881-f761-41f1-bbdf-1f6fefc55028", "name": "COMPETITOR SECRET PROJECT", "budget": 200000, "description": "This should NEVER be visible to TechFlow!", "organization_id": "11111111-2222-3333-4444-555555555555"}	payload-test-competitor	2025-08-15 19:47:56.465474
7b7bf788-38dc-44c1-affc-3f71f1c61950	0/16B2D01	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "5934a245-fcc1-404f-9717-cc37a4d7e756", "name": "TechFlow Secret Project Alpha", "budget": 150000, "description": "CONFIDENTIAL: This should only be visible to TechFlow", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 19:55:33.816187
f188cde2-910b-4cda-af88-a18944f3ad53	0/16B2D02	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "f6bcde26-77ee-4fab-97a9-d7b7c63904d4", "title": "TechFlow Internal Task", "description": "Internal task - should not leak to other orgs", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 19:55:33.823465
473ccd98-e3a3-49b4-8c3d-c23067da7bd6	0/16B2D03	11111111-2222-3333-4444-555555555555	projects	insert	{"id": "6b8b9fd5-b55b-4db2-91b5-b59532357f6e", "name": "COMPETITOR SECRET PROJECT", "budget": 200000, "description": "This should NEVER be visible to TechFlow!", "organization_id": "11111111-2222-3333-4444-555555555555"}	payload-test-competitor	2025-08-15 19:55:33.825596
0f805e39-7cce-4db7-b454-53eea9400b6f	0/16B2D01	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "cd7ba359-b86e-43fc-9920-c421018041c4", "name": "TechFlow Secret Project Alpha", "budget": 150000, "description": "CONFIDENTIAL: This should only be visible to TechFlow", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 20:00:24.375541
526f0fd9-bdcd-4fb2-95ae-04664de838bf	0/16B2D02	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "6962f173-59fa-4841-a740-8a5f54d1169f", "title": "TechFlow Internal Task", "description": "Internal task - should not leak to other orgs", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 20:00:24.380905
40638ca5-6274-4b6a-a6c6-21e1c0d1ba02	0/16B2D03	11111111-2222-3333-4444-555555555555	projects	insert	{"id": "28a2ec89-620f-4b71-8cba-16ad3fa5adf0", "name": "COMPETITOR SECRET PROJECT", "budget": 200000, "description": "This should NEVER be visible to TechFlow!", "organization_id": "11111111-2222-3333-4444-555555555555"}	payload-test-competitor	2025-08-15 20:00:24.382951
467b8e94-e11d-4a9d-95ce-cfbdece78302	0/25CF490	01234567-89ab-cdef-0123-456789abcdef	organizations	insert	{"id": "01234567-89ab-cdef-0123-456789abcdef", "name": "Isolation Test Organization", "slug": "isolation-test-org", "country": "", "logoUrl": "", "industry": "", "maxUsers": 5, "settings": [], "timezone": "UTC", "createdAt": "2025-08-15 19:10:48.199738+00", "deletedAt": "", "updatedAt": "2025-08-15 19:10:48.199738+00", "ssoEnabled": "", "websiteUrl": "", "companySize": "", "description": "Organization for testing data isolation", "enforce_2fa": "", "maxProjects": 3, "trialEndsAt": "", "apiRateLimit": 1000, "billingCycle": "monthly", "billingEmail": "", "allowedDomains": "", "storageLimitGb": 1, "trialStartedAt": "2025-08-15 19:10:48.199738", "billingSettings": [], "nextBillingDate": "", "polarCustomerId": "", "subscriptionTier": "trial", "subscriptionSeats": 5, "subscriptionStatus": "active", "subscriptionExpiresAt": ""}	\N	2025-08-15 16:17:14.507
5b2e2157-de06-4e4f-a36d-e278f193673c	0/25D87D0	11111111-2222-3333-4444-555555555555	organizations	insert	{"id": "11111111-2222-3333-4444-555555555555", "name": "Test Organization 2", "slug": "test-org-isolation-1755285469460", "country": "", "logoUrl": "", "industry": "", "maxUsers": 5, "settings": [], "timezone": "UTC", "createdAt": "2025-08-15 19:17:49.463226+00", "deletedAt": "", "updatedAt": "2025-08-15 19:17:49.463226+00", "ssoEnabled": "", "websiteUrl": "", "companySize": "", "description": "Second organization for isolation testing", "enforce_2fa": "", "maxProjects": 3, "trialEndsAt": "", "apiRateLimit": 1000, "billingCycle": "monthly", "billingEmail": "", "allowedDomains": "", "storageLimitGb": 1, "trialStartedAt": "2025-08-15 19:17:49.463226", "billingSettings": [], "nextBillingDate": "", "polarCustomerId": "", "subscriptionTier": "trial", "subscriptionSeats": 5, "subscriptionStatus": "active", "subscriptionExpiresAt": ""}	\N	2025-08-15 16:17:14.507
f85e2204-1816-42ba-b323-303664cb45a3	0/2650000	108b0ac2-487f-4951-b295-b1924288daad	projects	insert	{"id": "237e6163-da82-4cc9-b410-e7e8214e153c", "name": "TechFlow Website Redesign", "status": "active", "description": "Complete redesign of the TechFlow Solutions website", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.7256
c69635d8-5c59-4564-8164-2000730b2ff0	0/2650000	108b0ac2-487f-4951-b295-b1924288daad	projects	insert	{"id": "30398218-1832-4253-8f86-27d6210b7528", "name": "Client Portal Development", "status": "planning", "description": "Building a client portal for TechFlow customers", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.744744
09b0b9ea-cec9-41df-9dcd-ca30e7fe69cd	0/2650000	108b0ac2-487f-4951-b295-b1924288daad	projects	insert	{"id": "294d04b5-e040-45c0-aa6d-2bb397db96fc", "name": "Mobile App MVP", "status": "active", "description": "TechFlow mobile application minimum viable product", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.754791
09b948cb-1b04-4530-86b6-83b39eb4690f	0/2651000	108b0ac2-487f-4951-b295-b1924288daad	tasks	insert	{"id": "9a9eb4ba-e043-4476-94b1-fa6977501c66", "title": "Design new homepage layout", "status": "in_progress", "priority": "high", "project_id": "237e6163-da82-4cc9-b410-e7e8214e153c", "description": "Create wireframes and mockups for the new homepage", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.7619
3fde51be-5d92-458f-8526-e1bc5528d267	0/2651000	108b0ac2-487f-4951-b295-b1924288daad	tasks	insert	{"id": "1ee1d678-faec-4de2-acb2-626dbdc79e60", "title": "Implement responsive navigation", "status": "todo", "priority": "medium", "project_id": "237e6163-da82-4cc9-b410-e7e8214e153c", "description": "Build mobile-friendly navigation menu", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.767356
3722214c-cd68-414c-b065-3849d6bd9c37	0/2651000	108b0ac2-487f-4951-b295-b1924288daad	tasks	insert	{"id": "2109d447-f915-4136-8c97-7f8d1f2bcbed", "title": "Setup authentication system", "status": "in_progress", "priority": "high", "project_id": "30398218-1832-4253-8f86-27d6210b7528", "description": "Implement user login and registration", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.775909
74369451-4c48-477b-b78f-e5e2ad434262	0/2652000	01234567-89ab-cdef-0123-456789abcdef	projects	insert	{"id": "3f2de8ca-bd97-4b6f-94df-02058b4fbab7", "name": "Competitor Secret Project", "status": "confidential", "description": "This should NOT appear in TechFlow sync", "organization_id": "01234567-89ab-cdef-0123-456789abcdef"}	competitor-seeder	2025-08-15 20:21:02.782472
18c1adc2-35b9-4ddd-b022-fa1cc63fc993	0/2652000	01234567-89ab-cdef-0123-456789abcdef	projects	insert	{"id": "384dc651-bda5-4fd5-8552-1b020ee97a5d", "name": "Rival Product Launch", "status": "stealth", "description": "Competitor product that TechFlow should not see", "organization_id": "01234567-89ab-cdef-0123-456789abcdef"}	competitor-seeder	2025-08-15 20:21:02.787157
7a9bc7f4-4d71-47a6-b8c1-7927a95f1f21	0/2653000	108b0ac2-487f-4951-b295-b1924288daad	time_entries	insert	{"id": "ea5ad0f8-d397-4c7a-8ff1-50efa3dccf43", "date": "2025-08-15", "hours": 3.5, "task_id": "9a9eb4ba-e043-4476-94b1-fa6977501c66", "user_id": "0198aed6-cc0b-783b-b414-c5fb8a81f227", "description": "Working on homepage design mockups", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	time-tracker	2025-08-15 20:21:02.794204
05d4d860-2ee7-4866-8bcc-b22d9d1c55c7	0/2653000	108b0ac2-487f-4951-b295-b1924288daad	time_entries	insert	{"id": "c9e04350-13ff-4333-ab29-475d1d473d46", "date": "2025-08-15", "hours": 2, "task_id": "2109d447-f915-4136-8c97-7f8d1f2bcbed", "user_id": "0198aed6-cc0b-783b-b414-c5fb8a81f227", "description": "Setting up OAuth integration", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	time-tracker	2025-08-15 20:21:02.79948
\.


--
-- Data for Name: container_permission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.container_permission (id, user_id, permission_container_type, permission_container_id, role, granted_at, granted_by_id, expires_at, restrictions, status, created_at, updated_at) FROM stdin;
a808f1b4-83a3-4df5-be20-c45cdc084b7c	0198b046-c453-72d9-b71a-092e1f75601a	organization	01920000-1000-7000-8000-000000000001	owner	2025-08-16 00:28:20.626573+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.626573+00	2025-08-16 00:28:20.626573+00
c5450264-0503-4562-9937-41d00246ccbb	0198b046-d127-769d-9bc2-8e5824b71b3a	organization	01920000-1000-7000-8000-000000000001	admin	2025-08-16 00:28:20.628806+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.628806+00	2025-08-16 00:28:20.628806+00
f6c6a74c-2ac2-45ef-bdaa-3189e0c59be9	0198b046-d931-7772-a1e8-b63c68c7f43d	organization	01920000-1000-7000-8000-000000000001	manager	2025-08-16 00:28:20.630663+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.630663+00	2025-08-16 00:28:20.630663+00
645a3ab6-da28-4797-b88a-b0267b5aa83e	0198b046-e16b-7b46-a15e-baa49fd29990	organization	01920000-1000-7000-8000-000000000001	manager	2025-08-16 00:28:20.632425+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.632425+00	2025-08-16 00:28:20.632425+00
f2758a5e-b37b-40e9-b2f5-d77912418fc1	0198b046-e873-7739-bac2-10db9440486b	organization	01920000-1000-7000-8000-000000000001	member	2025-08-16 00:28:20.634086+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.634086+00	2025-08-16 00:28:20.634086+00
e323d8d1-2e35-4ddf-96b3-9d422f7310da	0198b046-f056-7735-a3aa-60e8a329dd23	organization	01920000-1000-7000-8000-000000000001	member	2025-08-16 00:28:20.635645+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.635645+00	2025-08-16 00:28:20.635645+00
ebf1accb-6550-4870-b161-ffe89445f5ea	0198b046-f71e-7bec-a853-294d7cbcbda5	organization	01920000-1000-7000-8000-000000000001	contributor	2025-08-16 00:28:20.638277+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.638277+00	2025-08-16 00:28:20.638277+00
c2bdc82f-b821-4b62-a5f2-cb9299710883	0198b046-fe7a-7855-b4d8-4408253dc9c5	organization	01920000-1000-7000-8000-000000000001	viewer	2025-08-16 00:28:20.640171+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.640171+00	2025-08-16 00:28:20.640171+00
b923088f-fbbb-4956-8fe5-57958b335bc1	0198b046-f71e-7bec-a853-294d7cbcbda5	project	75972222-1a82-425e-8ad4-bff95105df92	manager	2025-08-16 00:28:20.642009+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	{"canEditBudget": true, "canManageTeam": true}	active	2025-08-16 00:28:20.642009+00	2025-08-16 00:28:20.642009+00
b3c2c5e8-a694-4bac-ba5e-74bc0ad19823	0198b059-5419-7165-b2c3-937a66b94865	organization	01920000-2000-7000-8000-000000000002	owner	2025-08-16 00:48:25.940805+00	0198b059-5419-7165-b2c3-937a66b94865	\N	\N	active	2025-08-16 00:48:25.940805+00	2025-08-16 00:48:25.940805+00
2c456f76-53cb-453d-903a-45eba13a9456	0198b059-5999-7f84-8217-0506a838e0da	organization	01920000-2000-7000-8000-000000000002	admin	2025-08-16 00:48:25.943353+00	0198b059-5419-7165-b2c3-937a66b94865	\N	\N	active	2025-08-16 00:48:25.943353+00	2025-08-16 00:48:25.943353+00
745b49c9-fe6d-45c1-a256-da67d47538b6	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	organization	01920000-2000-7000-8000-000000000002	member	2025-08-16 00:48:25.945278+00	0198b059-5419-7165-b2c3-937a66b94865	\N	\N	active	2025-08-16 00:48:25.945278+00	2025-08-16 00:48:25.945278+00
7b2d63ed-c167-4ae5-859a-b90a0ec3ca9b	0198b059-64c9-7c4f-87be-5b1a3704f1c3	organization	01920000-2000-7000-8000-000000000002	viewer	2025-08-16 00:48:25.94719+00	0198b059-5419-7165-b2c3-937a66b94865	\N	\N	active	2025-08-16 00:48:25.94719+00	2025-08-16 00:48:25.94719+00
b413ecac-a118-4af0-b84e-500a506a3429	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	entity_type	ticket	manager	2025-08-16 00:48:25.949416+00	0198b059-5419-7165-b2c3-937a66b94865	\N	{"system_options": {"can_modify_priority": true}, "polymorphic_access": ["comment", "attachment", "activity"], "custom_field_access": ["Resolution Time"]}	active	2025-08-16 00:48:25.949416+00	2025-08-16 00:48:25.949416+00
fdb25983-b942-46b5-9d9e-2cd3b3aa0fed	0198b059-5999-7f84-8217-0506a838e0da	entity_type	deal	owner	2025-08-16 00:48:25.951413+00	0198b059-5419-7165-b2c3-937a66b94865	\N	{"system_options": {"can_modify_stage": true, "can_view_all_deals": true}, "polymorphic_access": ["comment", "attachment", "activity"], "custom_field_access": ["Source"]}	active	2025-08-16 00:48:25.951413+00	2025-08-16 00:48:25.951413+00
\.


--
-- Data for Name: entity_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entity_roles (id, entity_type, entity_id, user_id, role, permissions, granted_by, granted_at, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: error_test_org_1755170779580_test_tables; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.error_test_org_1755170779580_test_tables (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invitation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invitation (id, "organizationId", email, role, status, "expiresAt", "inviterId") FROM stdin;
\.


--
-- Data for Name: isolation_org_a_1755170777829_shared_table_names; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.isolation_org_a_1755170777829_shared_table_names (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, org_specific_field) FROM stdin;
\.


--
-- Data for Name: isolation_org_b_1755170777829_shared_table_names; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.isolation_org_b_1755170777829_shared_table_names (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, org_specific_field) FROM stdin;
\.


--
-- Data for Name: member; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member (id, "organizationId", "userId", role, "createdAt") FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_certification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_certification (id, organization_id, user_id, name, issuer, issue_date, expiry_date, credential_id, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_client; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_client (id, organization_id, name, industry, contact_email, contract_value, status, created_by, assigned_to, created_at, updated_at) FROM stdin;
35f41de8611004890b88f24b778ad699	01920000-1000-7000-8000-000000000001	MegaCorp Industries	Manufacturing	cto@megacorp.com	350000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f5c256c65bbd4f3807713d1f36504e2f	01920000-1000-7000-8000-000000000001	Global Finance Ltd	Financial Services	tech@globalfinance.com	280000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
47231270424f14a9e574f23928ba8d4d	01920000-1000-7000-8000-000000000001	Healthcare Networks	Healthcare	it@healthnetworks.com	190000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
35018961269dc8b6c4e742edcee3fca7	01920000-1000-7000-8000-000000000001	AI Startup Alpha	Artificial Intelligence	dev@aistartup.com	120000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
58290a93f8446b00a0f375cbe4b8a15a	01920000-1000-7000-8000-000000000001	FinTech Innovate	Financial Technology	engineering@fintechinnovate.com	95000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c38010f786bc2540c13cbbdd0bb5f0d1	01920000-1000-7000-8000-000000000001	GreenTech Solutions	Clean Energy	product@greentech.com	85000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
083eba3c526b28b4c9ae5ca96e3ba57b	01920000-1000-7000-8000-000000000001	EdTech Pioneer	Education Technology	platform@edtechpioneer.com	75000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c742a89d75633c42ae30c6538c7f4155	01920000-1000-7000-8000-000000000001	HealthTech Start	Health Technology	backend@healthtechstart.com	65000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
88c720925a52c0beb99cb9e3e928f75c	01920000-1000-7000-8000-000000000001	LogisTech Co	Logistics	systems@logistech.com	55000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f5fd444b0e842bea69b69fb89bb94154	01920000-1000-7000-8000-000000000001	Local Restaurant Chain	Food & Beverage	manager@localrestaurants.com	35000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9a41b30b8a0f383b7d8957ff86dd7370	01920000-1000-7000-8000-000000000001	Legal Practice Group	Legal Services	admin@legalpractice.com	30000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
aeff172e77800f3fc80811275bb67f45	01920000-1000-7000-8000-000000000001	Nonprofit Foundation	Nonprofit	tech@nonprofitfoundation.org	25000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
70995dd22d6752086d6ec9d7245f37ca	01920000-1000-7000-8000-000000000001	Architecture Firm	Architecture	digital@architecturefirm.com	20000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
05e085949bc35b0a94f58d5bf84aae7f	01920000-1000-7000-8000-000000000001	Marketing Agency	Marketing	ops@marketingagency.com	18000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
bf7333b4a7dd00168309a8b55b712e27	01920000-1000-7000-8000-000000000001	Consulting Services	Business Consulting	systems@consultingservices.com	15000.00	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_contract; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_contract (id, organization_id, client_id, project_id, contract_number, value, signed_date, start_date, end_date, status, created_by, assigned_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_document; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_document (id, organization_id, project_id, title, description, file_url, file_size, file_type, version, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_expense; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_expense (id, organization_id, project_id, user_id, category, amount, description, receipt_url, date, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_invoice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_invoice (id, organization_id, client_id, project_id, invoice_number, amount, due_date, status, created_by, assigned_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_meeting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_meeting (id, organization_id, project_id, title, description, meeting_date, duration, location, meeting_type, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_project; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_project (id, organization_id, client_id, name, description, project_type, budget, start_date, end_date, status, created_by, assigned_to, created_at, updated_at) FROM stdin;
bb59b55b796395db967a060d11cd542a	01920000-1000-7000-8000-000000000001	35f41de8611004890b88f24b778ad699	MegaCorp ERP Migration (Phase 3)	Large-scale ERP system migration and integration with legacy systems	Enterprise Integration	180000.00	2024-11-09	2025-11-09	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7fb2191c7cd5dfaf6ea2b2bbfa52822d	01920000-1000-7000-8000-000000000001	f5c256c65bbd4f3807713d1f36504e2f	Global Finance Trading Dashboard	Real-time trading dashboard with advanced analytics and risk management	Financial Platform	150000.00	2024-11-13	2025-09-13	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0170c55f1f5e97a4eae271c68db648f8	01920000-1000-7000-8000-000000000001	47231270424f14a9e574f23928ba8d4d	Healthcare Patient Portal V2	Next-generation patient portal with telemedicine capabilities	Healthcare Platform	120000.00	2024-11-09	2025-07-09	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a56c54fdc98be0028beb4234bda646e4	01920000-1000-7000-8000-000000000001	35018961269dc8b6c4e742edcee3fca7	AI Platform Core Development	Machine learning platform with automated model training pipeline	AI/ML Platform	85000.00	2024-07-21	2025-01-21	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
cb21bbf2d5fe1448c683c3a2713485a4	01920000-1000-7000-8000-000000000001	58290a93f8446b00a0f375cbe4b8a15a	FinTech Payment Gateway	Secure payment processing system with fraud detection	Payment System	70000.00	2024-09-25	2025-02-25	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ff7f15243c2a2ef403e1088513eb71d9	01920000-1000-7000-8000-000000000001	c38010f786bc2540c13cbbdd0bb5f0d1	GreenTech Mobile App MVP	Mobile application for carbon footprint tracking and reduction	Mobile Application	60000.00	2024-10-30	2025-03-02	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
091a1d87dd9d95ec4c415f6f8843730e	01920000-1000-7000-8000-000000000001	083eba3c526b28b4c9ae5ca96e3ba57b	EdTech Learning Management	Comprehensive learning management system with assessment tools	Educational Platform	55000.00	2024-06-24	2024-11-24	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4b2d891b05771aedd1296fa822ced7fa	01920000-1000-7000-8000-000000000001	c742a89d75633c42ae30c6538c7f4155	HealthTech Telemedicine Platform	Video consultation platform with patient record integration	Telemedicine	50000.00	2024-06-07	2024-10-07	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ae3e93bcaf2e9bdf320d1a3aae1d9d69	01920000-1000-7000-8000-000000000001	88c720925a52c0beb99cb9e3e928f75c	LogisTech Supply Chain Tool	Supply chain optimization tool with real-time tracking	Supply Chain	45000.00	2024-06-09	2024-10-09	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f9d00c14e7683ae270887ed0b35e3fe5	01920000-1000-7000-8000-000000000001	f5fd444b0e842bea69b69fb89bb94154	Restaurant Mobile Ordering	Mobile app for food ordering with loyalty program integration	Mobile App	25000.00	2024-08-18	2024-11-18	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e3ddf36da7654769f61086fb521e8e54	01920000-1000-7000-8000-000000000001	9a41b30b8a0f383b7d8957ff86dd7370	Legal CRM Enhancement	Case management system enhancements and client portal	CRM System	20000.00	2024-08-27	2024-10-27	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a5019ebc89c97160e0f23b59ae5ab338	01920000-1000-7000-8000-000000000001	aeff172e77800f3fc80811275bb67f45	Nonprofit Donation Widget	Online donation platform with recurring payment options	Donation Platform	15000.00	2024-09-18	2024-11-18	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8bd7f019f7b6ea7ab455219205c24f43	01920000-1000-7000-8000-000000000001	70995dd22d6752086d6ec9d7245f37ca	Architecture Portfolio Redesign	Modern portfolio website with project showcase capabilities	Website	12000.00	2024-07-14	2024-08-14	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
42823093ab2bd54789ad79fc720431f4	01920000-1000-7000-8000-000000000001	05e085949bc35b0a94f58d5bf84aae7f	Marketing Agency Dashboard	Campaign performance dashboard with client reporting tools	Analytics Dashboard	10000.00	2024-08-27	2024-09-27	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8175c2fa40f272d4bd8d20dcd7ecf814	01920000-1000-7000-8000-000000000001	bf7333b4a7dd00168309a8b55b712e27	Consulting Business Portal	Client portal for document sharing and project collaboration	Business Portal	8000.00	2024-06-09	2024-07-09	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5832e45fe14cac430d1f36e607eb2509	01920000-1000-7000-8000-000000000001	35f41de8611004890b88f24b778ad699	MegaCorp System Maintenance	Ongoing system maintenance and support for ERP platform	Maintenance	60000.00	2024-10-26	2025-10-26	active	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0681fd000800616b6c3e2de154331ebd	01920000-1000-7000-8000-000000000001	f5c256c65bbd4f3807713d1f36504e2f	Global Finance Security Updates	Monthly security patches and performance optimization	Security & Maintenance	48000.00	2024-07-31	2025-07-31	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6e23636e09fb644b140fd799f78f8a68	01920000-1000-7000-8000-000000000001	35018961269dc8b6c4e742edcee3fca7	AI Platform Bug Fixes	Ongoing bug fixes and feature enhancements	Support	36000.00	2024-08-03	2025-08-03	complete	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
test-mutation-1755446137	01920000-1000-7000-8000-000000000001	\N	LiveStore Mutation Test Project	This project was created to test LiveStore mutation tracking at Sun 17 Aug 2025 11:55:37 AM EDT	\N	\N	\N	\N	active	\N	\N	2025-08-17 15:55:37.326852+00	2025-08-17 15:55:37.326852+00
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_proposal; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_proposal (id, organization_id, client_id, title, description, estimated_value, estimated_duration, status, submitted_date, created_by, assigned_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_resource; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_resource (id, organization_id, name, type, description, availability_status, hourly_rate, created_by, assigned_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_skill; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_skill (id, organization_id, name, category, description, level, created_by, created_at, updated_at) FROM stdin;
58e8c0d996204735b1cc71ce599a83cc	01920000-1000-7000-8000-000000000001	React	Frontend	Modern React development with hooks and context	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d5536dffcc660ef4b158fa7ba5b4f65c	01920000-1000-7000-8000-000000000001	Vue.js	Frontend	Vue.js framework for progressive web applications	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
90545231e1299af24fd19d12db46cc0c	01920000-1000-7000-8000-000000000001	Angular	Frontend	Enterprise Angular applications and TypeScript	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
01d63d4db3045b855a2b776e6a94c95b	01920000-1000-7000-8000-000000000001	TypeScript	Frontend	Strongly typed JavaScript development	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1942af724b0f6f5620ccab99e53a35bd	01920000-1000-7000-8000-000000000001	CSS/SCSS	Frontend	Advanced styling and responsive design	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a760fc17a5e575dee6537f79efc12f35	01920000-1000-7000-8000-000000000001	Node.js	Backend	Server-side JavaScript with Express and Fastify	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2f5429126ca35935955141cb778dfe34	01920000-1000-7000-8000-000000000001	Python	Backend	Python web development with Django and FastAPI	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a632f7585a0df3c885b1aafefa9f4bd7	01920000-1000-7000-8000-000000000001	PostgreSQL	Database	Advanced PostgreSQL optimization and administration	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
110f6793eb8c6fbe44d788776dd98a63	01920000-1000-7000-8000-000000000001	Redis	Database	In-memory caching and session management	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4d47a337c5052564ed7e6996ca0fdd55	01920000-1000-7000-8000-000000000001	GraphQL	API	GraphQL schema design and performance optimization	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0f41bad407ea041e7e2d23a8252b572b	01920000-1000-7000-8000-000000000001	React Native	Mobile	Cross-platform mobile development with React Native	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
95ba0da3fcbdcac88dd87061c155a250	01920000-1000-7000-8000-000000000001	Flutter	Mobile	Dart-based mobile app development	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c627f7e37cbf1d0d3f2e54d01170aa29	01920000-1000-7000-8000-000000000001	iOS Development	Mobile	Native iOS development with Swift	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
140845c0c3eb12df81e4e32f76f5847c	01920000-1000-7000-8000-000000000001	Android Development	Mobile	Native Android development with Kotlin	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2410d0e0de991fb9753c4c08d532971a	01920000-1000-7000-8000-000000000001	AWS	DevOps	AWS cloud infrastructure and serverless architecture	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
61cc66bf139d5046a8d21a66898d4cce	01920000-1000-7000-8000-000000000001	Docker	DevOps	Containerization and orchestration	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c074fbeb10c5e7571326dbb3e87f8079	01920000-1000-7000-8000-000000000001	Kubernetes	DevOps	Container orchestration and scaling	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b9fddf31568f6aaabae8d005ca566959	01920000-1000-7000-8000-000000000001	CI/CD	DevOps	Automated testing and deployment pipelines	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f2e16b1a78734dbf27287e9e43f009ba	01920000-1000-7000-8000-000000000001	Terraform	DevOps	Infrastructure as code management	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
20299b0f46c53d6851cac4b579eb7524	01920000-1000-7000-8000-000000000001	Figma	Design	UI/UX design and collaborative prototyping	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0af584e2abcf258ab57418cf785ee4c5	01920000-1000-7000-8000-000000000001	Adobe Creative Suite	Design	Professional graphic design and media production	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
46224125913423aa59efcfb13d9e9711	01920000-1000-7000-8000-000000000001	Prototyping	Design	Interactive prototyping and user testing	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9969f0db8b85d58559bc7004ffef440b	01920000-1000-7000-8000-000000000001	UX Research	Design	User research and usability testing	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3faba61a29cb37cb7744eb57cd18d705	01920000-1000-7000-8000-000000000001	Agile/Scrum	Management	Agile methodologies and sprint management	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
be6b7092ad5489426e27870feb01f31a	01920000-1000-7000-8000-000000000001	Project Planning	Management	Resource allocation and timeline management	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b253311f610b15d51957f058e26f408f	01920000-1000-7000-8000-000000000001	Risk Management	Management	Project risk assessment and mitigation	Intermediate	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
086ed3ac1d54a0091b56713801c66823	01920000-1000-7000-8000-000000000001	Client Communication	Management	Stakeholder management and client relations	Advanced	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_timesheet; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_timesheet (id, organization_id, project_id, user_id, date, hours, description, billable, rate, status, created_by, created_at, updated_at) FROM stdin;
7ddff6b2df328b0a58e87846b73be6da	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-10-29	4.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0c1334b29e1d658b4625a53f32ad3412	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-10-29	8.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ec116deb6619a2ee60a8e7fadaf8ecdb	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-10-29	2.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b2528918e131c2d28c90a4fbbf896f46	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-10-29	4.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d1a636070e4241fb3790ec0d93f03ff6	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-10-29	5.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
869aab4c41ebd5d4546373a8a995d7c8	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-10-29	5.25	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d0a8f3f46d99488bdbc7c87fa2e4ec32	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-10-30	9.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1837c47ed0fe355d598e0d063cc1a9e4	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-10-30	7.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
50363aff5f6ccd684ca055f2c53ea6e2	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-10-30	7.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8548b04e2a11aef53b54caa50b630cca	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-10-30	5.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4e10b03822ca4cfcf23ad087242ff291	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-10-30	5.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5edc69452cdd04da4d149de7ac4865e7	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-10-30	6.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8239cc5751e34b6fc7e656ce12faff9c	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-10-31	4.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c4e6189ab24a6f3c84cc5377a15da4f9	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-10-31	4.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c037af7c63c43f22d3ea088b7e4e6a13	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-10-31	4.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
671f108c02c66302b40fb38064db1e69	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-10-31	6.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
294b7355111dd000d275715b210155cb	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-10-31	4.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0700bde6489cfb5ec61578eb2a1412dc	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-10-31	4.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1edba0776843322715e97d8b1717309d	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-01	6.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2d08189a99f2c71592ba925e4658b618	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-01	8.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
770fcbb24bbeb51353f9603c1d043217	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-01	3.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7a5199c6f90aeaa31660b9b942f53a71	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-01	8.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7576546f15b7bbbdfecd04c53dd9add7	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-01	3.25	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
febc9bcb70d382b59688d7522380fd79	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-01	4.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
910db209e62197a426d9bb74a12671c6	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-02	9.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5b7fa44314e829664cc53ffbe207aeeb	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-02	4.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
20fb46de21679fef65b3ca88eade11c5	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-02	6.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
14f2da46fb37e51f29bead4717d2aceb	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-02	5.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6b4eed268b81c82dc65bd45687d056a2	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-02	5.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6be388da50397b009fb9da39e1ce73f8	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-02	4.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ce7759958d6f672ed2e191b9a5faf31c	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-05	4.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9ebc0450773212ec71c3bddec7fddca6	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-05	7.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b65f4690e1e1cc58e65c296e99f46e4c	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-05	4.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0ef9c5978e814f9c7484fca30af52d06	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-05	2.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
eaf83d698dfaffd791e8a4e54f896af2	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-05	4.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b8f5c4c380e096a2b65f107ec95e7ab4	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-05	7.75	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
82f31169aba91e1175d16b996fe8b3ca	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-06	8.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
83c8fa26b099125017e4094c3863b389	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-06	4.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
60fdd29324ad9cee04ba62b0ef2297ed	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-06	7.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b43b95ffe45402663f2aa5e6733350b8	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-06	5.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
fcd0470c424c7c9a93b726ccd1d36910	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-06	4.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
377ae8006b6a678a08c671c0b26fa89c	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-06	7.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
dbc91a36a3795584318d9450004e0d15	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-07	6.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
38330c781b9e413ab311f39a9715fc8e	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-07	5.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b1e0c7e1897777227fd6a9d2bdc6546b	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-07	5.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c0071f90ef20aebdf1d89f459309a97b	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-07	4.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e795cd93ca8778befd9bc3993fcb3928	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-07	5.25	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a29e630b3d7f165f13d40f42c9252de2	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-07	5.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1e5b34ce88b3f9d625babc1e3cf7bc5e	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-08	7.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a1bbb85af5e394118fc82651f03d34eb	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-08	4.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
264ee2af4a6430c844e405b5f2b83f71	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-08	3.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
057acc64031fdd3352c4ffd8783386c6	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-08	3.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
26a90f6d03b50422bffe258b3885c0e6	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-08	3.50	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
36df06ff84b1844cb3f95d09adf0174d	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-08	3.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7ff24c2562c76de49b411a382a497e16	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-09	7.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
dcea36216a508721c1c9f6674916dad5	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-09	5.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0a4a5ab952deb19165f5bf9a480599ce	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-09	4.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1fcdbfa72ae3ab9c970c3bf77b384eb5	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-09	4.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ad2c6d2e62983f51223fcaae75b63d57	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-09	5.00	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b7b0bf8fef97788a29c800e7eab850d2	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-09	3.25	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
734e2cb219d776454d70c4b3fc1dc98a	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-12	8.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4ddcf835191fde2418f956d22d2dbb66	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-12	8.25	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3b2ccdff98d1399b92b7b796dec4c97d	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-12	4.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
867084b9d5b61cc585ecf482dda81b7a	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-12	6.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e3544ee4bb8fb05aa719a71511faffbf	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-12	5.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a4d14771c519f51c3de278e9b1a7b732	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-12	4.25	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b45b41e4367c7269a06b6d1f8667409a	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-12	2.25	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9c1c5372b072aeab2ff057e086c22c1a	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-12	4.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0669c9e4c0344a38291e93e108299f39	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-13	9.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c7fdf7da94077cd963b06ac815fc2197	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-13	7.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a65ba05a46c1733d181128dabc5b99ae	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-13	5.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1a52e82451623fcbe700d03fea67c3da	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-13	2.50	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
58389ebfc506dc86ede85d797d877331	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-13	7.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d931ae5cd9a428f1abaf189aa3bc7691	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-13	5.00	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8d3290f75cf6d393e7ce06ff8eaa0a1b	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-13	4.75	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
47c305fc4f734500de4e50f0cc4020d1	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-13	3.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e1d77dc671b695d904adba45890849c2	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-11-14	9.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
14aa8e0c20e594b63b30149edb820527	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-14	4.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4dc88a9f5e6dfeae199d42f3b202efa2	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-14	7.75	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
270bbe7e7744c113b1affadfc65d12dc	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-14	7.25	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4121572f6671f2353a9cd54533a49c22	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-14	3.50	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2067433f0fcba1badd9a39c9a71164a7	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-14	2.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e2d05b76fd653e813407cc8abc8ed9ac	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-14	6.25	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6f2a4dd557914d6b6a819dcada2b79ff	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-11-15	5.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
13f8bef3244cd7df4634b79378c67c4b	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-11-15	6.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
22b5555c40c49b90072e876a09a963f8	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-15	6.75	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3a9ec2ee9e6fedff7b63eb0547dca310	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-15	7.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d80fc7d23e9304dd27112ecc5cbeca89	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-15	3.50	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
de91373d0630b2fd85f0df65c4c92ad9	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-15	3.50	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6581070a2fc77e7f8588ad10c8ffd3c9	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-15	7.25	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
092838b15c4205a854227afefe4b9ccc	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-15	7.25	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
94ca9849287bd2ff81acd5428177f989	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-15	4.00	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4182e314995a2aba1266ebecec985b78	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-15	3.75	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d7112a4e29ac86fc5e3a40813bd35f20	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-15	3.50	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ce302aeeb9604dc8895cd5b565a87e08	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-16	5.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4397911cb28d25f3fd968b73fada042b	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-16	7.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7b2983f434ccb833842f8a78b4d737a0	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-16	3.50	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e882f27603b72930d215821cb156a376	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-16	4.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
92a37fb48b77c1ef2bc27e6695601b02	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-16	4.25	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b37dc3136da438cc357655c6949e7590	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-16	2.75	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8d38829d37ad6b309564dd035259ce5e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-16	2.25	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0795f3567666fe21fc8845e2c77fdb3a	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-16	5.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f13c8166b2bcb63c43dbd35b4e452b83	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-16	6.75	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2a3b078cd8686449474da1a230846611	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-19	8.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0db3b69147d699dd51b8a6eb887fc13a	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-19	4.75	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
10189e59671e1cd89755e3a1b9df9455	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-19	6.75	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a8d297103aef995d720be2e595d07218	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-19	6.50	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3c366c60608b918ffb345c8a11354f89	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-19	4.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c72402067008e20174820cee8cc1e81d	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-19	2.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a18f80dd94a272af17ad311867dafa43	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-19	4.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
29dbc561c395204ceea630c15b0728d3	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-11-20	6.75	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
33d0eef7cec150182cc61e01aa5bfdbf	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-20	8.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a2d8333d947abd1c6facd7e074cb54f3	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-20	3.25	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
48c72656d7f29f4cd7e89a3b156ad882	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-20	6.75	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8135d502eebd21b801f56daafaf6997a	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-20	6.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
65bd349091be3efe5c33f0268eafdf3b	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-20	4.25	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
dbb79169b5e3b7b6546f8d8dc52e53cc	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-20	4.00	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
809dfc50db6ae555d20b8609cc5f3b95	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-11-21	4.25	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d449416cd44860d364f2448208f4b621	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-21	6.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
16b6fdab55fdba911172bbf3f0d5cd53	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-21	5.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9423358e66d9e67e6fbf6c7b499525df	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-21	6.25	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4f5e2d7c85d47d0a346f970193368351	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-21	3.75	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
43cc85294f9fccec335dba1a2c2f17d8	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-21	4.00	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
80b2ac50a7df232e2da34b4a7ef314a3	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-21	3.00	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ba9c0b87896dde130b5c36e477b64cdf	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-21	4.25	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
310f4ae126948102585eb7abac3c37f0	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-21	3.25	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7b111a1567ca38fe84d5d6c9b6a23d0c	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-22	5.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
87b7a0d9f16b5c51ed0305c8878929ce	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-22	9.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f233ce9501ca595466b3efff6b6b0870	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-22	5.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ecdbad4217e3bbfe706b2217fe43d48e	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-22	4.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
cfa54847354edb949403e8e67d92a8d6	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-22	7.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5a34a73e66d6e8442a0730132c5009b3	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-22	2.00	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
67b87d2197cc95b04ece35d2d37e89da	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-22	2.50	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c094be1067337188d0ac6227d8b06b33	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-22	7.25	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6e85bb96d9e2788e8f5e695ec0bb8d2e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-22	7.50	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
90b333af98c16a6fa709aebbb31cfe52	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-11-23	9.50	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
621616240ced21cb68f42dbe31b8617a	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-23	7.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4d8b41cea7b620733dbc9211094dc105	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-23	6.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
fc6eb90321a012d0438976f19e4f28b8	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-23	6.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8de25804ea203435d2f8fba327fdf4b9	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-23	5.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
96e16b7ee2e8a0cb3d3a77bd0045f259	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-23	4.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9a2cd80e000cbe549175f85c736c848d	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-23	5.25	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
67c607bc7f91a261ac1f92607c775477	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-23	6.50	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
47fec5faf33a4a5772473f8e867902d3	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-23	5.25	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
64ae421143325cd68ffa6797f5fbf694	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-26	4.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
10aa8075d08e0c110f3084282808cbd2	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-26	7.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e5cf02d7f45341bce3532c38e05afc69	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-26	7.50	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
cef1330fe5473f5e580ed337ef1684ab	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-26	7.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
bb97640014e1bb125fa1343b87977a09	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-26	3.50	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2bf19c8e2edbec0df2e72fcacf5af86b	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-26	6.50	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4e901b42173fb8f5272ab3193232541f	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-26	5.25	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1f681f56247d1b5945b97d94cd100f72	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-26	5.00	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d823b07975b00c743784c7305ea4b9a7	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-26	5.25	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
81690ad09df33305fa5855ac365857ac	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-11-27	4.50	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4f81d636a8940e4ed169e3e56e4f9036	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-27	8.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d7e9e3e7f02a9eeb60993511ceeeafe7	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-27	6.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c088fcac201bb60ac14a53487e9a08af	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-27	5.25	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
192b6e2dcd60dc3b4f9a8c04c6c2e95c	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-27	7.50	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4807d89e871207a6fe2692b45fce2c9e	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-27	7.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e0bcd615555f67369641d37881963443	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-27	4.25	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4fad4f696aab219e849e6698f6943ec8	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-27	4.00	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a8fa34108becddd62142597acdb39fe0	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-27	6.75	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
96b0cf88ba272818c575dc577bd1bad1	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-27	5.50	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1ff801f0246637f040bc2e752ff33bb4	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-11-28	4.75	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3b153c591e4a54aff9a327fa1b5740c8	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-11-28	4.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c16e81abf70e8dc490b2888619cb5dc6	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-28	9.75	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8ecc5b633f531844a43b457ea0ac6e83	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-28	7.25	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f93bdc9273ddd141053874016f755084	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-28	5.25	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
07ff5519957c641f7f3a11b1d8baeb75	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-28	5.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
996172985368010cd8905aacb0a90ee6	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-28	3.75	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2f9ac8238e44072ffc50bd9c8e37a26a	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-28	7.50	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
255ac493be3d49140f83b093ca1d9f93	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-11-29	4.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
effa1d695f3928cab7ae27dcad83da2e	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-29	6.50	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
fd2078e21cbc97dcf5ed8b7f0aadfc2e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-29	6.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e04aaef5076c3a756a0b0d83e4bb4af3	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-29	5.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ec9f85ff1cb7d640fd5adb86d5eea8c8	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-29	4.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
da5ac14f4c9c44a2efca3615b3b62e98	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-29	6.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
22a09525bcc07934e3a370d88e1743a3	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-29	4.00	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1b42a539082c6de3a0cf0690a4d0e7eb	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-29	6.25	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5f6d1ba6f31b738d7e1aeb024ab3298e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-29	4.75	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
483d84ad0cf0721ec9ff59a64022366c	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-11-30	6.25	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f1fdb84cdabd88ab436a99a445cc71b1	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-11-30	9.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0d5acd3e1a763c4a8c1ee41acaca1bc6	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-11-30	7.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
963dfb014235a36ed12dcb996f6af7ed	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-11-30	3.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0581ced026f613c9cfbac2a598c110b6	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-11-30	2.00	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
dd3d86fb5a61fed9b25eb51b75a360a6	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-11-30	4.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4738da4811d43e38e5c46232c1f87b92	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-03	9.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
161718f59e0ce885288e2eee3c276e0f	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-03	9.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b772c6c17d37ae9d7121e1d1b25a49fa	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-03	8.75	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6ede5d8bf74d83454fd91258bb00be54	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-03	7.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7781acd0a22d5931abffd514405c6d9b	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-03	5.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ad7333a3947401783fc94d622503026a	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-03	3.00	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3f4b69794331eb2bcb15b04e58f2f40a	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-03	5.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
52d17460acecb060fa9e2dec1411bf29	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-04	7.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2a38410b33e7dbfc8d7dda99c321f891	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-04	4.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
fb13aa40edd1e078c0cb4779ceb6ba62	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-04	8.75	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f6349f1224bea158908a04033dee991d	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-04	5.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ad47effb4df55fa2a434943640376678	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-04	6.25	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c7366b22f4326948afc897331c5b1861	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-04	2.50	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8b74edb27e333cc150a390780f79d19d	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-04	5.75	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
05c4882f991556271f9caaf5b82c45bd	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-04	3.75	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
bf8b59a8ac38420c8c0c7885ad928c39	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-04	5.75	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e5e874832b70f80d6669a1f419ff38de	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-05	4.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
bcbf00c18fdaf3ce449997450519f3bd	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-05	9.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c1ac6e8509846494bb9cbf89e886634e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-05	8.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7f2c71535310b332c247e3c8ced718a5	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-05	6.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3511dc014ebb73fc89cd6decbf360802	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-05	6.50	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ed687e51c69d2f291f4a6ba236e1bc7c	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-05	2.75	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
14b12a11a43caf9b29ff8cb6b0129442	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-05	2.25	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2017d066d8e5cde1bdb0c292e3136286	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-05	4.25	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
fcac25084565712f058b428922e8333b	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-12-06	8.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4d636127ef33c1e2df0e2a35f981041c	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-06	5.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b4cb69b9a532d15c3f41fc4d4d533834	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-06	4.25	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0ee032b521b3be28a7b140b33c651532	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-06	2.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
18a60d203fce7e6eb61d7c575d07d482	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-06	2.75	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3cefa5e41b8c377d42f167264e5ea2e1	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-06	4.25	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ffbb7a08053ef0d530bb4c7b8c586614	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-06	2.50	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
24ee58f27659be72a7fd9faa352cac4e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-06	4.25	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ca718dfee3b81c366a7006b26980ecf2	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-06	7.25	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
bb06274a3f7896826eb019f11b0cd328	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-07	6.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b3227840047e531f71e36a3a7847e91c	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-07	8.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9ee8adb2c0c82ec8e8261db3ca1102c1	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-07	6.25	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6c6a105bdd9112c96399b6641cfb8f77	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-07	4.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e57915c0d4446d9705b52ed3ee0f86bb	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-07	5.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
de2b4fa77bb9cb86a2b97b36d9ab0939	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-07	4.25	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5f6d07273da262dbce77cad537d4b7c4	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-07	4.00	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8357617986b96ab0fbe6ecb5e9d3292f	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-07	7.75	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c30975118b9836c5833f4bb8c3b67e89	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-12-10	9.75	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1a29c94a335bc13e2bc1b9aa5639e744	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-10	4.75	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
856fd558a4abcffe400907489f0a4021	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-10	5.75	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
644ab4a1e247ba7543b461e6e5060d8d	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-10	3.25	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
bc1fbc50579f233902cd847e3590811a	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-10	5.75	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
57bb0d7875dcb781fababb731bfa1bb1	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-10	6.75	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
afc5cdba6d4abf409e334d8c8a6e2f90	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-10	7.25	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9b402a3feec7df0175f6e60f3fa7ddf0	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-11	5.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
d9b79166317ce80725f36bc975117075	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-11	5.25	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7d2f37f07efc2f3e9e0771e53ddb6750	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-11	4.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ca2040086c42ef10fc95e60a89292cb4	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-11	4.50	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
98c1c28d2af5fd9c5423618ee3118ae3	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-11	3.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
88c8a2b3460d0f19e63d1f8e1ada433a	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-11	2.50	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e01c1faededd706cfd0b46b776e20473	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-11	2.75	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
045e13da7cdb9499f4cf18ccb0e53936	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-11	7.75	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a351a292d2deb1936596a23b3e07039c	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-11	5.25	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
042eb4f253ddb94bde6a6d093db67fdb	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-12	4.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
fe86e4a04bc4186e26290802a4d41250	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-12	7.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0fe0a0fe91dd017131c6e4f1f408957b	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-12	4.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
528c07750876d06e4dd68ee4e2c5523e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-12	7.75	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3bc459bf3a763ed375630b82c4238ea4	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-12	6.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4cbef9d46473dee261c0ba724be7b3e9	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-12	7.75	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
fec7cdab5c213b0ed0858bbc0278715d	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-12	3.50	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a9d5e510e78d1ce467d8f135d7fca3a5	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-12	5.50	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b5bf287964b02428a04e9fd807ef45b8	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-12	6.50	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c4456b31b09d10793c499434bc8034f8	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-12	4.25	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
73bd908f373f83272c9d9157e04afe39	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-13	8.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e622a9bce65063a93e315893410abc48	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-13	5.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a31e629246f814f14c224027ba44db11	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-13	6.75	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7163b3d76c853b65b2770d45d4382a90	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-13	6.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0db98fb2dadf01dc0882b60c34279a12	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-13	4.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b7979f2cbfcaac1b0b94295f019b8815	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-13	5.50	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
668885f3566de65f23cefcc068bb63fd	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-13	5.25	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3efe805bc3be4c737858ab56d4f814ba	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-13	7.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5f7e992da9bc13a974359cdfcebcf137	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-13	5.00	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
fa2c2ac9a40c2c08251fdae50d60206a	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-12-14	6.25	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c6d2e56e1e715cb2c518141a0ed7ec59	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-14	6.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
473db93316fbd6af679776fc4c0a52c3	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-14	7.50	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0a5744a556ad1c009672b6ecc0feb260	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-14	2.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
4e1a9dbfa9689802b7e71536194f12dc	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-14	4.75	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3b449cf35766b99c76a219a3a04ac2b2	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-14	3.00	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ee2de798020f8a706f9675c0fbfcd3d0	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-14	5.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ab019cc7f96e1b5009450b401fe5d79c	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-12-17	5.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
dd9b26b6a2fc0a0032e4c2fe46a8d6d5	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-17	9.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a2813c5494eb1b1d4c81b27fcbe7934c	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-17	5.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a971b482e67ead323ae2f11bf22d5576	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-17	8.00	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6155c7eae54b3fce16f8afee3524c554	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-17	2.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c18ae57762b2439b145f13b2a4452d65	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-17	3.50	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
bc9d088c4feee846e99e16018f00021e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-17	2.75	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
550103b73bfc7f41a2b52bb6bbfe3e7b	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-17	6.50	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c7786bb5581a4a692676a2d96279ae7f	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-17	4.75	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9444d5235640e5f258a17a5ba285a848	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-18	7.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3a50377a54eaf90e96622b50ce08a01c	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-18	9.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
790fa7b3b2f1dfed4ecf1c6336aa36b4	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-18	6.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
df049682063cae7b7c630286b64fe8d1	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-18	6.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e8d1154072c58d60e437eea9c385df9a	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-18	2.50	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1e53e306cee77556a4831d733cda699c	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-18	7.25	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
cd44af9b22751a36f16a0857f53d7dae	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-18	5.75	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
de0b48c91e8390c231a9172822a0b395	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-12-19	6.50	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7568eeecc775f5d1d7ccd779a3df6ba3	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-19	7.50	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
39db661a7712b2ec9502060e442bc017	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-19	7.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7c5152e34db3c2f4c20143d3af376b01	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-19	2.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
25f8099ab70d2930fcbee3f1a06d79e4	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-19	5.00	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a47578f51cec6bdf57365b932c96ef32	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-19	4.75	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
624857306331b642579ddc501ce19491	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-19	6.75	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
336c51cec720ca5fb710fa378c88f238	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-19	3.00	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
794feef6301289356c75d23003e56935	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-20	7.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2499b797c613403950dcb2b7bfe4be0b	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-20	4.75	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2fced83ec83d23bcd96eb487973ab66e	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-20	8.50	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e5a8372030750536f0fbdec07cf0c88f	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-20	2.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5f8d70a3f6f987cbd1f533666d57a457	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-20	5.50	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6190c359a14e98a7b6a1750102d5a8e0	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-20	3.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9cd0ca9c02f7a9b932c5781421cf5333	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-20	5.00	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
07778f82391beab87c60a2bad3e4c446	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-20	6.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
19f95d086f5428ba087e5a1022372f48	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-21	6.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
803da2ad52d5127b25efce9941dc9f12	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e873-7739-bac2-10db9440486b	2024-12-21	4.75	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7f987fc137522dad4ad31491c71f6a4b	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-21	8.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
68e3d0e4ce7f97c5b4b22d27810a8876	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-21	4.50	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9b00b6b2faf0a49761e331d167fd8c9b	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-21	7.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b053e79189658710550d737beee3b25e	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-21	4.50	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c2ab5d3c38bebfa212152fff7e76eac5	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-21	5.25	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2dcbc6797e19473a18d69312f45a5d56	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-21	7.75	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
45690bf5f585f5cc1bc3ded06a10c605	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-24	7.50	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7111b3d11625cc45929b1899318e6f99	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-24	6.25	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
6b28811a40481753b5f4761e66db4b16	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-24	9.25	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
9c3ed06ef4af087ffe78f79ba6a42025	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-24	5.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b2a51a5a43fa22e04a81547a58c2950a	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-24	6.50	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
b07d78b2ee0d2f60cc7b731ab637ebb4	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-24	6.00	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
52ec32a3048d80f3d6db0d9b99840ec5	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-24	5.50	Work on MegaCorp System Maintenance	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5956d137135251d631a0abb14a32b344	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-24	6.00	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
ec9816703f7c60b7df87a286e9a46960	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-24	7.00	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f3d4e536691126d863c0f3cdd460fcfa	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-25	4.50	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3437e0bbe6b0509db251627c91817222	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-25	4.00	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2babaa787534b6d19b013d53f475a9fa	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-25	2.50	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3ad9832296f507d48f65459e32daccf7	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-25	3.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
38dc17f86011bb67785ee145b5f30328	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-25	4.50	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c0a62308cc1c419a422729493361228a	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-25	4.25	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
33a774b4274892d1d0ccdefb661bd0d1	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-26	5.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e9d10b5843a612983f2336e44f8823ea	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-26	5.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c6c36dfc8921ab879a2edc5bd569db62	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-26	6.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
88b2c14181e91485be568fae9f0fd85e	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-26	7.00	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
212ac88c1612e9e61a2b53460548bafe	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-26	2.00	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8b3fc98f1d177cba08cffe3580899880	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-26	6.25	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
17feba8cab7dec2a428206299bbe38f5	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-27	7.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
7204238d96c6d52d7b58e927fad4f7ce	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-27	9.00	Work on MegaCorp ERP Migration (Phase 3)	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
5f61fcd59eb672b6ef93d92438bfdfa0	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-27	5.75	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
36dafbcf25ab356ac408b601bc3d47c0	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-27	7.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c94965354970380329ab25990005deb0	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-27	7.75	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
654d3594013a5ea4071ecc5ad90ca091	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-27	4.00	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
1d4d8360f5cfa865d4f387291b04b942	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-27	3.50	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3d418ad0b5a3a1439f02e10174df1093	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-27	3.75	Work on MegaCorp ERP Migration (Phase 3)	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
15b86104658d2d630d5e8e4c2cc26325	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-27	5.75	Work on Global Finance Trading Dashboard	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
77640ddf0d73c7a167fd4a0133f91347	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e873-7739-bac2-10db9440486b	2024-12-28	8.00	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
0f24e6631438bf36bfedc0c573fb114a	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e873-7739-bac2-10db9440486b	2024-12-28	8.25	Work on Global Finance Trading Dashboard	t	100.00	approved	0198b046-e873-7739-bac2-10db9440486b	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
2d47e398d68d99384cc8b3d975b5d7c0	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f056-7735-a3aa-60e8a329dd23	2024-12-28	4.25	Work on MegaCorp System Maintenance	t	100.00	approved	0198b046-f056-7735-a3aa-60e8a329dd23	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
3b12030af81c9d82fe6bb450b2f1f59e	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d931-7772-a1e8-b63c68c7f43d	2024-12-28	5.75	Work on MegaCorp ERP Migration (Phase 3)	t	125.00	approved	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
8df1d90a1c65ad4671b280734eb749b3	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-28	6.25	Work on MegaCorp System Maintenance	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
f6e89196be25bf339bdb5758d3ce68e0	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-e16b-7b46-a15e-baa49fd29990	2024-12-28	6.75	Work on Global Finance Trading Dashboard	t	125.00	approved	0198b046-e16b-7b46-a15e-baa49fd29990	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
e1ad9f8d0988375788ee48ee87b1a840	01920000-1000-7000-8000-000000000001	bb59b55b796395db967a060d11cd542a	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-28	4.50	Work on MegaCorp ERP Migration (Phase 3)	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
c2409ade5f3d617c9fd894c202d350cb	01920000-1000-7000-8000-000000000001	7fb2191c7cd5dfaf6ea2b2bbfa52822d	0198b046-d127-769d-9bc2-8e5824b71b3a	2024-12-28	3.50	Work on Global Finance Trading Dashboard	t	150.00	approved	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
a383034746f8d39cbf2c245e76c85488	01920000-1000-7000-8000-000000000001	5832e45fe14cac430d1f36e607eb2509	0198b046-f71e-7bec-a853-294d7cbcbda5	2024-12-28	4.50	Work on MegaCorp System Maintenance	t	85.00	approved	0198b046-f71e-7bec-a853-294d7cbcbda5	2025-08-17 01:44:15.797887+00	2025-08-17 01:44:15.797887+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_activity (id, organization_id, subject_type, subject_id, activity_type, description, metadata, performed_by, created_at) FROM stdin;
d79281c7-2de1-4ff2-8523-441f74b33c6f	01920000-2000-7000-8000-000000000002	contact	bad4d81c-77b4-411d-98e0-6a1f8c32b185	email_sent	Sent welcome email	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.920925+00
d279a9de-86da-456b-9d2a-a6d15255d625	01920000-2000-7000-8000-000000000002	deal	57c41aa2-de0b-4ed0-b5c9-d6556dcf3daa	stage_changed	Moved to proposal stage	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.922649+00
20f85c7b-34b6-47dc-8006-05e402864c05	01920000-2000-7000-8000-000000000002	ticket	c0dfd6b6-8c06-4aa6-9925-42008d8f50b4	priority_changed	Priority changed to high	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.924264+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_attachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_attachment (id, organization_id, attachable_type, attachable_id, filename, file_url, file_size, mime_type, uploaded_by, created_at, updated_at) FROM stdin;
6a2f3ffb-c89f-4207-a64d-d16220f01c2c	01920000-2000-7000-8000-000000000002	deal	57c41aa2-de0b-4ed0-b5c9-d6556dcf3daa	proposal.pdf	\N	1024000	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.915578+00	2025-08-16 00:48:25.915578+00
7c550067-43f2-4486-9de1-aceca8ee5fb5	01920000-2000-7000-8000-000000000002	ticket	c0dfd6b6-8c06-4aa6-9925-42008d8f50b4	screenshot.png	\N	512000	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.917466+00	2025-08-16 00:48:25.917466+00
51033829-547a-4756-804c-c8250b5c38fc	01920000-2000-7000-8000-000000000002	contact	bad4d81c-77b4-411d-98e0-6a1f8c32b185	business_card.jpg	\N	256000	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.919205+00	2025-08-16 00:48:25.919205+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_comment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_comment (id, organization_id, commentable_type, commentable_id, content, author_id, is_internal, created_by, created_at, updated_at) FROM stdin;
c692653d-b411-460d-a808-e64f95a6d117	01920000-2000-7000-8000-000000000002	contact	bad4d81c-77b4-411d-98e0-6a1f8c32b185	Great lead, very interested in our enterprise solution	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.906096+00	2025-08-16 00:48:25.906096+00
b7f09c3a-e5dc-428e-91da-6e051a227aa2	01920000-2000-7000-8000-000000000002	contact	e3365112-b17f-423c-9493-6ea775e600e0	Startup looking for cost-effective options	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.90818+00	2025-08-16 00:48:25.90818+00
21a877f8-f203-4ead-8b5a-adc4ba1bb0e9	01920000-2000-7000-8000-000000000002	deal	57c41aa2-de0b-4ed0-b5c9-d6556dcf3daa	Need to schedule demo next week	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.909684+00	2025-08-16 00:48:25.909684+00
c58d22e1-07a8-441f-a741-954f19c182d8	01920000-2000-7000-8000-000000000002	deal	d5abde47-af13-41dd-b6ad-bdc05f2b9de7	Client wants to discuss timeline	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.911043+00	2025-08-16 00:48:25.911043+00
9bc8c477-0755-46f8-aaf0-174482e02cc0	01920000-2000-7000-8000-000000000002	ticket	c0dfd6b6-8c06-4aa6-9925-42008d8f50b4	Escalated to development team	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.912667+00	2025-08-16 00:48:25.912667+00
b54f99d0-48cc-463e-83a3-89f0bc02a70e	01920000-2000-7000-8000-000000000002	ticket	a9e18a8f-ece8-41ed-bbf7-9f644d8debd9	Added to product roadmap for Q2	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.914051+00	2025-08-16 00:48:25.914051+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_contact; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_contact (id, organization_id, first_name, last_name, email, phone, company, status, created_by, assigned_to, created_at, updated_at) FROM stdin;
bad4d81c-77b4-411d-98e0-6a1f8c32b185	01920000-2000-7000-8000-000000000002	John	Smith	john@techcorp.com	\N	Tech Corp	active	0198b059-5419-7165-b2c3-937a66b94865	0198b059-5999-7f84-8217-0506a838e0da	2025-08-16 00:48:25.894232+00	2025-08-16 00:48:25.894232+00
e3365112-b17f-423c-9493-6ea775e600e0	01920000-2000-7000-8000-000000000002	Jane	Doe	jane@startup.io	\N	Startup Inc	active	0198b059-5419-7165-b2c3-937a66b94865	0198b059-5999-7f84-8217-0506a838e0da	2025-08-16 00:48:25.896717+00	2025-08-16 00:48:25.896717+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_custom_field_definitio; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_custom_field_definitio (id, organization_id, entity_type, field_name, field_type, field_options, is_required, display_order, created_by, created_at, updated_at) FROM stdin;
03bf2a35-6412-4883-ab37-accd644db9ac	01920000-2000-7000-8000-000000000002	contact	Industry	select	["Technology", "Healthcare", "Finance"]	f	0	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.926+00	2025-08-16 00:48:25.926+00
856fe3c2-2600-42bc-beff-a168e95610f2	01920000-2000-7000-8000-000000000002	deal	Source	text	null	f	0	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.928373+00	2025-08-16 00:48:25.928373+00
baa48f7d-b36d-4083-ac18-ac9c085cbfd4	01920000-2000-7000-8000-000000000002	ticket	Resolution Time	number	null	f	0	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.930087+00	2025-08-16 00:48:25.930087+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_custom_field_value; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_custom_field_value (id, organization_id, field_definition_id, entity_type, entity_id, value_text, value_number, value_date, value_boolean, value_json, created_at, updated_at) FROM stdin;
6b8960eb-56f0-4aee-b9a7-e6737e382a87	01920000-2000-7000-8000-000000000002	03bf2a35-6412-4883-ab37-accd644db9ac	contact	bad4d81c-77b4-411d-98e0-6a1f8c32b185	Technology	\N	\N	\N	\N	2025-08-16 00:48:25.931848+00	2025-08-16 00:48:25.931848+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_deal; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_deal (id, organization_id, title, value, stage, probability, close_date, contact_id, created_by, assigned_to, created_at, updated_at) FROM stdin;
57c41aa2-de0b-4ed0-b5c9-d6556dcf3daa	01920000-2000-7000-8000-000000000002	Enterprise Software Deal	50000.00	proposal	50	\N	bad4d81c-77b4-411d-98e0-6a1f8c32b185	0198b059-5419-7165-b2c3-937a66b94865	0198b059-5999-7f84-8217-0506a838e0da	2025-08-16 00:48:25.898597+00	2025-08-16 00:48:25.898597+00
d5abde47-af13-41dd-b6ad-bdc05f2b9de7	01920000-2000-7000-8000-000000000002	Consulting Services	25000.00	negotiation	50	\N	e3365112-b17f-423c-9493-6ea775e600e0	0198b059-5419-7165-b2c3-937a66b94865	0198b059-5999-7f84-8217-0506a838e0da	2025-08-16 00:48:25.900477+00	2025-08-16 00:48:25.900477+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_sync_configuration; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_sync_configuration (id, organization_id, entity_type, sync_options, is_enabled, created_by, created_at, updated_at) FROM stdin;
3322602c-f48f-430a-a865-159207655165	01920000-2000-7000-8000-000000000002	contact	{"sync_mode": "full", "custom_filters": {"status": ["active"]}, "system_options": {"batch_size": 100, "enable_real_time": true}, "include_polymorphic": true, "polymorphic_relations": ["comment", "attachment", "activity"]}	t	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.93477+00	2025-08-16 00:48:25.93477+00
67187a74-4a55-467d-86b5-e03ff5d85149	01920000-2000-7000-8000-000000000002	deal	{"sync_mode": "incremental", "custom_filters": {"stage": ["proposal", "negotiation", "closed_won"]}, "system_options": {"batch_size": 50, "enable_real_time": false}, "include_polymorphic": true, "polymorphic_relations": ["comment", "attachment"]}	t	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.937386+00	2025-08-16 00:48:25.937386+00
62795f0f-ab57-47c4-a739-1df03cb66076	01920000-2000-7000-8000-000000000002	comment	{"sync_mode": "full", "custom_filters": {"is_internal": [false]}, "system_options": {"enable_real_time": true}, "polymorphic_parent_required": true}	t	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.939026+00	2025-08-16 00:48:25.939026+00
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_tag (id, organization_id, name, color, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_tagging; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_tagging (id, organization_id, tag_id, taggable_type, taggable_id, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_ticket; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_ticket (id, organization_id, subject, description, priority, status, contact_id, assigned_to, created_by, created_at, updated_at) FROM stdin;
c0dfd6b6-8c06-4aa6-9925-42008d8f50b4	01920000-2000-7000-8000-000000000002	Login Issues	Customer cannot access portal	high	open	bad4d81c-77b4-411d-98e0-6a1f8c32b185	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.90213+00	2025-08-16 00:48:25.90213+00
a9e18a8f-ece8-41ed-bbf7-9f644d8debd9	01920000-2000-7000-8000-000000000002	Feature Request	Need custom reporting	medium	open	e3365112-b17f-423c-9493-6ea775e600e0	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.904114+00	2025-08-16 00:48:25.904114+00
\.


--
-- Data for Name: organization_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_members (id, organization_id, user_id, role, created_at, updated_at) FROM stdin;
1720525c-182e-4432-b64d-02e1c89a432e	108b0ac2-487f-4951-b295-b1924288daad	0198aed6-cc0b-783b-b414-c5fb8a81f227	owner	2025-08-15 21:35:14.978262+00	2025-08-15 21:35:14.978262+00
d0a384fe-60e3-4836-addb-9e78cd396b28	01920000-2000-7000-8000-000000000002	0198b046-c453-72d9-b71a-092e1f75601a	owner	2025-08-16 00:49:05.699316+00	2025-08-16 00:50:31.197918+00
ade1bc51-6e6c-43d7-8631-3cb653fe44ca	01920000-2000-7000-8000-000000000002	0198b046-d127-769d-9bc2-8e5824b71b3a	admin	2025-08-16 00:49:05.699316+00	2025-08-16 00:50:31.197918+00
ae14c90c-af72-4bcc-849b-d595f655d2a1	01920000-2000-7000-8000-000000000002	0198b046-e873-7739-bac2-10db9440486b	member	2025-08-16 00:49:05.699316+00	2025-08-16 00:50:31.197918+00
29fe5e23-954f-417b-b2cd-a65714935eee	01920000-2000-7000-8000-000000000002	0198b046-fe7a-7855-b4d8-4408253dc9c5	viewer	2025-08-16 00:49:05.699316+00	2025-08-16 00:50:31.197918+00
0f1f732d-2aac-44e0-8dda-b942f5e7df56	0a1eaf20-5386-43e8-ad36-73fafefeb500	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	owner	2025-08-16 13:09:39.973285+00	2025-08-16 13:09:39.973285+00
01e53386-d61c-481f-b859-0ea976742fb9	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	owner	2025-08-16 00:28:07.222311+00	2025-08-16 00:28:07.222311+00
60fa17d6-cd84-4e4b-8e0d-54fedcbe852a	01920000-1000-7000-8000-000000000001	0198b046-d127-769d-9bc2-8e5824b71b3a	admin	2025-08-16 00:28:09.157583+00	2025-08-16 00:28:09.157583+00
3f754850-33da-4429-9a9d-e61af9a7647b	01920000-1000-7000-8000-000000000001	0198b046-d931-7772-a1e8-b63c68c7f43d	manager	2025-08-16 00:28:11.361111+00	2025-08-16 00:28:11.361111+00
4743269b-340f-4646-8dc3-2feb52b56f09	01920000-1000-7000-8000-000000000001	0198b046-e16b-7b46-a15e-baa49fd29990	manager	2025-08-16 00:28:13.09514+00	2025-08-16 00:28:13.09514+00
86b9c15e-a288-47ed-bc16-a8e2ce83df31	01920000-1000-7000-8000-000000000001	0198b046-e873-7739-bac2-10db9440486b	member	2025-08-16 00:28:15.056967+00	2025-08-16 00:28:15.056967+00
bb7bafa4-889d-411a-a570-ed116270fc65	01920000-1000-7000-8000-000000000001	0198b046-f056-7735-a3aa-60e8a329dd23	member	2025-08-16 00:28:16.977579+00	2025-08-16 00:28:16.977579+00
5a1542f2-91e8-4aa0-89c4-828f42e70b4f	01920000-1000-7000-8000-000000000001	0198b046-f71e-7bec-a853-294d7cbcbda5	contributor	2025-08-16 00:28:18.715016+00	2025-08-16 00:28:18.715016+00
57875fa2-47e5-4dfd-98b8-fedc4048a0d0	01920000-1000-7000-8000-000000000001	0198b046-fe7a-7855-b4d8-4408253dc9c5	viewer	2025-08-16 00:28:20.582832+00	2025-08-16 00:28:20.582832+00
c2316f1b-0d9d-4400-86fe-4f35d0cea98a	01920000-2000-7000-8000-000000000002	0198b059-5419-7165-b2c3-937a66b94865	owner	2025-08-16 00:48:21.716713+00	2025-08-16 00:48:21.716713+00
f8b9148a-b311-4062-b217-432589b2aff5	01920000-2000-7000-8000-000000000002	0198b059-5999-7f84-8217-0506a838e0da	admin	2025-08-16 00:48:23.214209+00	2025-08-16 00:48:23.214209+00
1ab6e5eb-d370-4051-855c-0fac8d71cecd	01920000-2000-7000-8000-000000000002	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	member	2025-08-16 00:48:24.619398+00	2025-08-16 00:48:24.619398+00
a4f15768-dd75-4d29-9e23-182e1c3ba64e	01920000-2000-7000-8000-000000000002	0198b059-64c9-7c4f-87be-5b1a3704f1c3	viewer	2025-08-16 00:48:25.887498+00	2025-08-16 00:48:25.887498+00
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, slug, created_at, updated_at, settings) FROM stdin;
108b0ac2-487f-4951-b295-b1924288daad	TechFlow Solutions	techflow-solutions	2025-08-15 21:35:08.904915+00	2025-08-15 21:35:08.904915+00	{}
01920000-1000-7000-8000-000000000001	Wide Corp Solutions	wide-corp	2025-08-16 00:28:03.818317+00	2025-08-16 00:28:03.818317+00	{"industry": "Software Consulting", "timezone": "America/New_York", "company_size": "11-50"}
01920000-2000-7000-8000-000000000002	Polymorphic Test CRM	polymorphic-test	2025-08-16 00:48:20.207914+00	2025-08-16 00:48:20.207914+00	{"industry": "SaaS", "timezone": "America/Los_Angeles", "company_size": "51-200", "sync_options": {"enable_polymorphic": true, "enable_system_options": true, "enable_custom_filtering": true}}
1c3ef67a-2051-46b4-b54a-dd0f2c0b6db4	Playwright Test Organization	playwright-test-organization	2025-08-16 13:05:46.993884+00	2025-08-16 13:05:46.993884+00	{"country": null, "industry": null, "logo_url": null, "timezone": "UTC", "description": null, "website_url": null, "company_size": null, "billing_email": null, "trial_ends_at": "2025-08-30T13:05:46.730Z", "allowed_domains": ["playwright-test.com"], "trial_started_at": "2025-08-16T13:05:46.730Z", "subscription_tier": "trial"}
0a1eaf20-5386-43e8-ad36-73fafefeb500	Playwright Test Organization 1755349777432	playwright-test-organization-1755349777432	2025-08-16 13:09:39.369872+00	2025-08-16 13:09:39.369872+00	{"country": null, "industry": null, "logo_url": null, "timezone": "UTC", "description": null, "website_url": null, "company_size": null, "billing_email": null, "trial_ends_at": "2025-08-30T13:09:38.932Z", "allowed_domains": ["playwright-test-1755349777432.com"], "trial_started_at": "2025-08-16T13:09:38.932Z", "subscription_tier": "trial"}
\.


--
-- Data for Name: secure_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.secure_config (key, encrypted_value, description, created_at, updated_at) FROM stdin;
JWT_SECRET	\\xc30d04070302d27ae31a602731c77fd25d01718f293550a9d9d49f26bdd3ac06c352477d3abee7d7ebab7c743311c04e98a488497797f740f4912cf11661c58049cad21964e56ab051853867028637a488fded854b92759a197070b7433590ea88c54fcdad65db6c6e25f037b153	JWT signing secret	2025-08-17 15:29:25.491203	2025-08-17 15:29:25.491203
NEON_API_KEY	\\xc30d04070302c598981457d1b4cc62d276017ce319b5137a2d879b7e5499b264467d6426ae2b75160c301b67b4c28a9c897a5428df9b0aac6fc4bb59c4cb06fea0516866fe58ccd2efa37672f266cc703c040def9b5601002146dadb0c2c0b518d4b913b60fbd72520481dc2f8f0c93665738331dfcc1abd3037aad7e20e59b5b7ffc53f210d32	Updated secret value	2025-08-17 15:29:25.474777	2025-08-17 15:37:04.4267
BETTER_AUTH_SECRET	\\xc30d04070302e02823f7d099eafc68d25d018cd9072b03a188f96c584fd502580fc152b6280fd1080ce1544d33249e39cecc70f8707998f5769a7097f42f07b1f7104ba04ade9a37c83261acb8977a2a31b615605b0c1938da0e10bb08779fdbd3a73794decdcb87b34581e5ce84	Updated secret value	2025-08-17 15:37:10.9611	2025-08-17 15:37:10.9611
BOOTSTRAP_SECRET	\\xc30d04070302c89734c01451e6fa74d27101b2c4cb38704414ad9f23bd9dd1c6cb18c05006b26120c7566b145288c5affa8e95704f9cdb2db0ba7a1abbd0934b245c59145f7cb37760525fdca3a236d2b52105cb6400193d69886ecf8c65c8d87212ed6e1118ff24849094443d39f222b6292ed7f9a85d1b16f8bb2bbcc048bf0924	Updated secret value	2025-08-17 15:37:17.67754	2025-08-17 15:37:17.67754
RESEND_API_KEY	\\xc30d040703027c153549a404d69f75d25501ef242937b09d1bbecff69f0f758fa218a9d7714972057af57714f983859d998401bec5e32b66377a26a29319b1639f0aef283cbd7f748f25b71e2a0d00af9cf5bf3d460e929845bf3fe0d9d9c9c797929c9c02fa	Updated secret value	2025-08-17 15:37:24.05755	2025-08-17 15:37:24.05755
POLAR_ACCESS_TOKEN	\\xc30d04070302fddb153e6f8422a77ed266014ed518020b597eca62d43df17d54222a31e674182f49f4c5db811110382023554d244bf91dcbe5ae42e9012026a25de6d12677f35033628dfaf579ba4a50b3dca2eb73dab7e16272d6e5fbb51a415a2a3dcd4b7f2952b3eea140fef913868b1a4b2ffb704e	Updated secret value	2025-08-17 15:37:32.063008	2025-08-17 15:37:32.063008
POLAR_WEBHOOK_SECRET	\\xc30d04070302bda814d6a8dac3e26cd277016c75f20b8e916bcf23f8947f615ad330248ca0f19065b542a57b04ff6d68c19e66555a9d8ee54ebfd385465c7d52877805904456f1d5aeef6f0db8698630e57594605af14866768a71f00b43e1ad3793ea5a4a8dd0025740238f8ac6ef268f1e464fc2f97110669ed5d7d2698e84ee0761315ac02c1a	Updated secret value	2025-08-17 15:37:39.262082	2025-08-17 15:37:39.262082
GITHUB_TOKEN	\\xc30d04070302145614aecb8892dd68d25801843703f286dfe9e52377e33379ddc90bb7dabe8ff29cc2d980d7bebdde53362c998c023924e93af33b32e17917fd009c96ac3b627582c278c2fde1de88517296873db1656f68303c01fa6e632e06f27f3bf88835ada234	Updated secret value	2025-08-17 15:29:25.483446	2025-08-17 15:37:51.306406
OPENAI_API_KEY	\\xc30d04070302d9e11cac6baab7216bd25c018f97c7c2fc379ec428649169050b6049d04edb85a505eb5bbf3f818569000ff333b6a24dd6421c204a7c06513fd219c904a534bab8b116e0ef30e5e43064022b3333a87c3582164525a5f9c372ffc121f5709d1e7c3ecfaa11dc46	Updated secret value	2025-08-17 15:29:25.485462	2025-08-17 15:37:56.38361
STRIPE_SECRET_KEY	\\xc30d0407030217685b109f6a67c862d261019f68ecc425c972609f6f6582330edc0d13a298a5e9bd75a907b89f9e974f5478edef50fdefae6340c6bda94b1ddf5ca3f8c5c0b1edf612c54aab5aba0722b638cd5a10536fb64fe300f2b09dfd803ab3f11c0a80d4b1da650571d7aa0cbed58c	Updated secret value	2025-08-17 15:29:25.48842	2025-08-17 15:38:02.779048
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (id, "userId", token, "expiresAt", "ipAddress", "userAgent", "createdAt", "updatedAt", "impersonatedBy", "activeOrganizationId") FROM stdin;
0198b83a-6aab-7261-b712-dfe55458cb5b	0198b046-c453-72d9-b71a-092e1f75601a	ANVlhyVvVmXzNiFnHpUAANkS2QQMINQn	2025-08-24 09:31:32.492		Better-Auth-Reset-Script/1.0	2025-08-17 09:31:32.492	2025-08-17 09:31:32.492	\N	\N
0198b84b-1b46-7a29-8a59-437367be2934	0198b046-c453-72d9-b71a-092e1f75601a	GOZiDkoL7Kse2kd3QBpNGgorYdcMv1MV	2025-08-24 09:49:46.183		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 09:49:46.183	2025-08-17 09:49:46.183	\N	\N
0198b930-d17e-7ba2-bfd6-ad88f4efe331	0198b046-c453-72d9-b71a-092e1f75601a	SHGeTbYlGZHHYzv5j1xLWVxBFwgEyhy2	2025-08-24 14:00:40.6		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:00:40.6	2025-08-17 14:00:40.6	\N	\N
0198b93c-ced6-74cb-a9d4-c49614977e8f	0198b046-c453-72d9-b71a-092e1f75601a	Zbl2pz4MiA9a5YHShSeaR5xBdLRCQlTB	2025-08-24 14:13:46.283		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:13:46.283	2025-08-17 14:13:46.283	\N	\N
0198b950-255e-79a1-b9ba-fc38a5c48fbc	0198b046-c453-72d9-b71a-092e1f75601a	iDytInQXPe4HYbAaEqFNDtswP0Gv9PiB	2025-08-24 14:34:53.635		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:34:53.636	2025-08-17 14:34:53.636	\N	\N
0198b958-0cba-7d53-a7cc-eac1df43c432	0198b046-c453-72d9-b71a-092e1f75601a	PBdeO0EnIzKBGuntWIkaPp14wcAH0JD4	2025-08-24 14:43:31.671		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:43:31.671	2025-08-17 14:43:31.671	\N	\N
0198b983-bf48-7a94-a836-62eddb25817a	0198b046-c453-72d9-b71a-092e1f75601a	TsfuQSSPmuk958Sz7gppsKe5eyceFR8F	2025-08-24 15:31:15.425		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:31:15.425	2025-08-17 15:31:15.425	\N	\N
0198b98f-8cae-7da0-98a0-43822ad0ed89	0198b046-c453-72d9-b71a-092e1f75601a	z6ZVgEkjQJvTRNgC1pg1XVVpallXbRMt	2025-08-24 15:44:08.901		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:44:08.901	2025-08-17 15:44:08.901	\N	\N
0198b999-0126-7cff-acd7-c911ea73f228	0198b046-c453-72d9-b71a-092e1f75601a	UDhpiULU4EFjNRhZzeGdiW6N2UAVfVyp	2025-08-24 15:54:28.567		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:54:28.567	2025-08-17 15:54:28.567	\N	\N
0198b9a3-0ca7-73cb-b398-56247710e3a8	0198b046-c453-72d9-b71a-092e1f75601a	lcKs20emKIvtKEXoE8yNwAZTo2T3FCsi	2025-08-24 16:05:26.838		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 16:05:26.838	2025-08-17 16:05:26.838	\N	\N
0198b9ee-c7a6-7715-bf89-cc95a7a9c30d	0198b046-c453-72d9-b71a-092e1f75601a	793mAFQteG5Rqn9sOlJuW6Evt5Y11GMS	2025-08-24 17:28:09.888		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 17:28:09.888	2025-08-17 17:28:09.888	\N	\N
0198b83a-8240-75d6-8198-eb4b2ac26f0b	0198b046-d127-769d-9bc2-8e5824b71b3a	OrNmv88CgfLstzCr4QScUm5bwjzHVBn8	2025-08-24 09:31:37.617		Better-Auth-Reset-Script/1.0	2025-08-17 09:31:37.617	2025-08-17 09:31:37.617	\N	\N
0198b920-6c62-7102-9f9e-260bdfa00811	0198b046-c453-72d9-b71a-092e1f75601a	4EXRqxhFP4lYuZ8FPWWWsqQiwzEll0X6	2025-08-24 13:42:46.12		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 13:42:46.12	2025-08-17 13:42:46.12	\N	\N
0198b934-6924-718d-ad69-069b7335e94c	0198b046-c453-72d9-b71a-092e1f75601a	qyssBTtZKeu2eOaK5LeSzs2FehzQYIoy	2025-08-24 14:04:36.005		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:04:36.005	2025-08-17 14:04:36.005	\N	\N
0198b941-2c93-7c69-8a95-ed81b2f189e6	0198b046-c453-72d9-b71a-092e1f75601a	d0n4J0cOTud3c9g0J8zw6VQtaovrLMxl	2025-08-24 14:18:32.433		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:18:32.433	2025-08-17 14:18:32.433	\N	\N
0198b952-658d-7f51-bd8b-35239df9deac	0198b046-c453-72d9-b71a-092e1f75601a	dfoIrKvS7nZrFD8042JgikSxUVrlpoLZ	2025-08-24 14:37:21.178		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:37:21.178	2025-08-17 14:37:21.178	\N	\N
0198b95b-e93b-72a7-870f-5ba297baf804	0198b046-c453-72d9-b71a-092e1f75601a	yYTyW9L1txDnfJ7eDIWidm3ujFwMbciv	2025-08-24 14:47:44.724		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:47:44.725	2025-08-17 14:47:44.725	\N	\N
0198b987-c4bd-719d-84a9-7c8b61a73c4c	0198b046-c453-72d9-b71a-092e1f75601a	XRh4Xow3Iv0R68cvNZfv7hsKfUA10QWI	2025-08-24 15:35:38.947		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:35:38.947	2025-08-17 15:35:38.947	\N	\N
0198b991-e30f-7b7f-90b7-44061988aa12	0198b046-c453-72d9-b71a-092e1f75601a	oQc09Oc2s76j1ff6KK933L4tkvtDLKE7	2025-08-24 15:46:42.083		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:46:42.083	2025-08-17 15:46:42.083	\N	\N
0198b99b-d9ee-79b7-b15d-a9337f58ab99	0198b046-c453-72d9-b71a-092e1f75601a	NtRND78lhlP7vUyg4ynEurUfctXfmC01	2025-08-24 15:57:35.07		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:57:35.07	2025-08-17 15:57:35.07	\N	\N
0198b9dd-de46-729e-bb83-7ae05ba5fcca	0198b046-c453-72d9-b71a-092e1f75601a	moxqCd9Ddk00geoqyyrxyrEv7sN6ALLA	2025-08-24 17:09:41.581		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 17:09:41.581	2025-08-17 17:09:41.581	\N	\N
0198b9f1-41e7-7897-a053-eb4a708ff171	0198b046-c453-72d9-b71a-092e1f75601a	Rsr14OPr1RyuY2PxrvisOQYrdaMjqEvO	2025-08-24 17:30:52.327		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 17:30:52.327	2025-08-17 17:30:52.327	\N	\N
0198af99-c88e-73bc-af0a-a67632e75d64	0198aed6-cc0b-783b-b414-c5fb8a81f227	JDKKfPjlai0RL2Jup00oyBK4tzgwhQZm	2025-08-22 17:19:07.658		node	2025-08-15 17:19:07.658	2025-08-15 17:19:07.658	\N	\N
0198b83a-9cc2-798c-9fbb-4e385ef67711	0198b046-d931-7772-a1e8-b63c68c7f43d	NGkMIKGxeNOlJpMMyW5HsBQ26KzookKy	2025-08-24 09:31:44.189		Better-Auth-Reset-Script/1.0	2025-08-17 09:31:44.19	2025-08-17 09:31:44.19	\N	\N
0198b926-59f0-7414-97ba-d8a6c878c926	0198b046-c453-72d9-b71a-092e1f75601a	iwGx33WiqjY8Zl6mOTG3iP7yPVxQNhdu	2025-08-24 13:49:14.602		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 13:49:14.602	2025-08-17 13:49:14.602	\N	\N
0198b937-ab49-7e7f-9456-b0b2007f260b	0198b046-c453-72d9-b71a-092e1f75601a	4RfLYUE3klrcxoPtZQv9CDQWeSzUKf99	2025-08-24 14:08:09.531		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:08:09.531	2025-08-17 14:08:09.531	\N	\N
0198b945-b53c-7120-8a05-7556feea4e79	0198b046-c453-72d9-b71a-092e1f75601a	JxpGmsyeoY5rJbYFu9bHEtNGn8xisE1Z	2025-08-24 14:23:29.605		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:23:29.605	2025-08-17 14:23:29.605	\N	\N
0198b954-4a56-7409-b2dc-bf15e25dc88a	0198b046-c453-72d9-b71a-092e1f75601a	XTteUMm3W2t4K2ldVhh3oTgOVMCuQ9ee	2025-08-24 14:39:25.309		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:39:25.309	2025-08-17 14:39:25.309	\N	\N
0198b95c-b9b4-7b0f-8743-ccdab2c687ac	0198b046-c453-72d9-b71a-092e1f75601a	799xngDSVSlNxhqVEox28mIIxCwguzaO	2025-08-24 14:48:38.074		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:48:38.074	2025-08-17 14:48:38.074	\N	\N
0198b98a-b0ae-7362-8a36-eb1f393e3937	0198b046-c453-72d9-b71a-092e1f75601a	27Nc3giWD9i8BHENIgjZn3BQBrW1d2bY	2025-08-24 15:38:50.418		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:38:50.418	2025-08-17 15:38:50.418	\N	\N
0198b994-87d4-7b9c-bd4c-eb82ea631389	0198b046-c453-72d9-b71a-092e1f75601a	yvSqrZ9n6ZLVBUEDQAVIq9fLMk52utrs	2025-08-24 15:49:35.275		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:49:35.275	2025-08-17 15:49:35.275	\N	\N
0198b99d-78ae-739c-8d03-f85c7d961ecb	0198b046-c453-72d9-b71a-092e1f75601a	pcCM4oPqJjx37Kw34p46ZSQQCYlqkWhu	2025-08-24 15:59:21.302		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:59:21.302	2025-08-17 15:59:21.302	\N	\N
0198b9df-83e5-7db3-9ea8-05d09ac8e3cf	0198b046-c453-72d9-b71a-092e1f75601a	o8rohStM6J1axldlhtU5wRxk6GRsnJPS	2025-08-24 17:11:29.534		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 17:11:29.534	2025-08-17 17:11:29.534	\N	\N
0198b9f5-beea-7f22-9a1e-0588c3ce6313	0198b046-c453-72d9-b71a-092e1f75601a	E9Es1obLDpCGkCOXQXSDdksWxY0sqrRJ	2025-08-24 17:35:46.402		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 17:35:46.402	2025-08-17 17:35:46.402	\N	\N
0198aed7-2bd8-7388-bc5b-79af83ca8c98	0198aed6-cc0b-783b-b414-c5fb8a81f227	hAboPJTJkBFBep4FetUvBcfH6GxkUMBo	2025-08-22 13:46:33.376		curl/8.5.0	2025-08-15 13:46:33.376	2025-08-15 13:46:33.376	\N	\N
0198aed7-6a28-768c-b564-b2bc5693e64c	0198aed6-cc0b-783b-b414-c5fb8a81f227	zWhBgBEb748G0YDRyOGbAYgFcx0TJgRM	2025-08-22 13:46:49.334		curl/8.5.0	2025-08-15 13:46:49.334	2025-08-15 13:46:49.334	\N	\N
0198af61-07a5-72e7-8686-b3df5a2ba77e	0198aed6-cc0b-783b-b414-c5fb8a81f227	zIl6cfOGRvDBrprHmBFKZ9ppYzBWF6U5	2025-08-22 16:17:07.565		node	2025-08-15 16:17:07.565	2025-08-15 16:17:07.565	\N	\N
0198af63-1dde-7520-9fa5-f6f3dc611517	0198aed6-cc0b-783b-b414-c5fb8a81f227	dO5C0wkGe21Md0lqj8mU3xdbTVDMUQRz	2025-08-22 16:19:24.848		node	2025-08-15 16:19:24.848	2025-08-15 16:19:24.848	\N	\N
0198af64-c0de-7845-865e-5daa3b53539c	0198aed6-cc0b-783b-b414-c5fb8a81f227	umBgE27m0qZgIRJL7tO0cQCgMYgEm7la	2025-08-22 16:21:12.262		node	2025-08-15 16:21:12.262	2025-08-15 16:21:12.262	\N	\N
0198af65-4751-738a-82db-cceb27f748df	0198aed6-cc0b-783b-b414-c5fb8a81f227	u7nlqwlgVydcwk1bsQGltyMTwr6A1bLy	2025-08-22 16:21:46.715		node	2025-08-15 16:21:46.715	2025-08-15 16:21:46.715	\N	\N
0198af66-ae9e-76aa-b3e7-bf52288cdd09	0198aed6-cc0b-783b-b414-c5fb8a81f227	WTl5jxdOKJAjaRwWKhhG2U3hkgD4WKUC	2025-08-22 16:23:18.706		node	2025-08-15 16:23:18.706	2025-08-15 16:23:18.706	\N	\N
0198af6b-0b46-7dc7-a0b1-e29f73a2afbc	0198aed6-cc0b-783b-b414-c5fb8a81f227	PumlPgNGquTUkTHQORRO1LZ8xHh1fLmV	2025-08-22 16:28:04.526		node	2025-08-15 16:28:04.526	2025-08-15 16:28:04.526	\N	\N
0198af6c-0c2b-74ec-bdc4-e8511335aa97	0198aed6-cc0b-783b-b414-c5fb8a81f227	tB5BFBEZr57FnfS1YGMwsoCCM49IKypy	2025-08-22 16:29:10.169		node	2025-08-15 16:29:10.169	2025-08-15 16:29:10.169	\N	\N
0198af71-314d-7180-95e2-5946ab29f7b8	0198aed6-cc0b-783b-b414-c5fb8a81f227	EqLbqNmxC66RGjGdmguurjMIc9u9GJ7W	2025-08-22 16:34:46.407		node	2025-08-15 16:34:46.407	2025-08-15 16:34:46.407	\N	\N
0198af74-14dd-7405-b816-54a8680d053b	0198aed6-cc0b-783b-b414-c5fb8a81f227	5YBjJi3i8H3y1IPrS0A374hYKHTJdI3G	2025-08-22 16:37:55.946		node	2025-08-15 16:37:55.946	2025-08-15 16:37:55.946	\N	\N
0198af76-7f11-7100-b76a-6cd32276c330	0198aed6-cc0b-783b-b414-c5fb8a81f227	rvCvvVRSRlkFYP9e0UPIZaMHOjAJGquO	2025-08-22 16:40:35.076		node	2025-08-15 16:40:35.076	2025-08-15 16:40:35.076	\N	\N
0198af77-a437-7d6f-98c4-6a14d9b8c268	0198aed6-cc0b-783b-b414-c5fb8a81f227	X0EApf2wl4dKwdt3MqhMl477jyT2GP97	2025-08-22 16:41:49.946		node	2025-08-15 16:41:49.946	2025-08-15 16:41:49.946	\N	\N
0198af7a-6ced-739b-8841-59551868ce7f	0198aed6-cc0b-783b-b414-c5fb8a81f227	Ojgb34sS5v6taCLXoUjHYwL8LID2reb5	2025-08-22 16:44:51.5		node	2025-08-15 16:44:51.501	2025-08-15 16:44:51.501	\N	\N
0198af7b-ebaa-75cb-b6c0-0432ac6af05a	0198aed6-cc0b-783b-b414-c5fb8a81f227	yJYle4LnfwYE4KiPnx2aBprlGTmBiS7E	2025-08-22 16:46:30.449		node	2025-08-15 16:46:30.449	2025-08-15 16:46:30.449	\N	\N
0198af7c-adb7-7ab8-8501-e0a79255a57d	0198aed6-cc0b-783b-b414-c5fb8a81f227	WmgbpBGVZnxFu404bp0sExdt19UJCapI	2025-08-22 16:47:20.195		node	2025-08-15 16:47:20.196	2025-08-15 16:47:20.196	\N	\N
0198af7d-6eda-7d8f-b3d5-481d57019d17	0198aed6-cc0b-783b-b414-c5fb8a81f227	y6tbwZ4otEDxhQ6O9Uo7ET4xGmB62KMR	2025-08-22 16:48:09.609		node	2025-08-15 16:48:09.609	2025-08-15 16:48:09.609	\N	\N
0198af7e-2b52-7d23-9746-0f9d52139a4a	0198aed6-cc0b-783b-b414-c5fb8a81f227	FON4HF5O3CpC2c4CZDSZUVkFZplHEfZP	2025-08-22 16:48:57.868		node	2025-08-15 16:48:57.869	2025-08-15 16:48:57.869	\N	\N
0198af7f-727f-7fc5-98d9-5e93c7395c08	0198aed6-cc0b-783b-b414-c5fb8a81f227	wBVoMLuSNA6w5srtrwJlvYIkTjEBS9wI	2025-08-22 16:50:21.64		node	2025-08-15 16:50:21.64	2025-08-15 16:50:21.64	\N	\N
0198af80-8cd5-7092-adc7-182c097c945e	0198aed6-cc0b-783b-b414-c5fb8a81f227	fMfcLxcYYA0SUsQwJXtE6K6BvGz3oRnk	2025-08-22 16:51:33.899		node	2025-08-15 16:51:33.899	2025-08-15 16:51:33.899	\N	\N
0198af81-97d2-7ae6-a211-3903944f4c8c	0198aed6-cc0b-783b-b414-c5fb8a81f227	TPN1QgDXzTFrHwnanY4RUOEnySGvFXLS	2025-08-22 16:52:42.191		node	2025-08-15 16:52:42.191	2025-08-15 16:52:42.191	\N	\N
0198af84-ba26-7726-9057-0263de939faa	0198aed6-cc0b-783b-b414-c5fb8a81f227	7knLTp2NSG27Yk1IzZFJL4GAKIQb1sba	2025-08-22 16:56:07.516		node	2025-08-15 16:56:07.516	2025-08-15 16:56:07.516	\N	\N
0198af85-5ea6-7fd8-8986-8a2339f41820	0198aed6-cc0b-783b-b414-c5fb8a81f227	Q7l7fMYWykCYR8Xw2YjJKhwqxl80gWt5	2025-08-22 16:56:49.867		node	2025-08-15 16:56:49.867	2025-08-15 16:56:49.867	\N	\N
0198af86-5f4f-7a2e-997a-bee219644535	0198aed6-cc0b-783b-b414-c5fb8a81f227	rvo7MnAH5Dkzv8H35B1ay4l2TpnYLvqm	2025-08-22 16:57:55.474		node	2025-08-15 16:57:55.475	2025-08-15 16:57:55.475	\N	\N
0198af88-2822-75a1-8111-2f9aa5c79dd8	0198aed6-cc0b-783b-b414-c5fb8a81f227	IIAoPNlPvkev0ZlTlVEWxVFGoQsxcpiu	2025-08-22 16:59:52.281		node	2025-08-15 16:59:52.281	2025-08-15 16:59:52.281	\N	\N
0198af8e-f5f7-76ba-80cf-0a5845582cf2	0198aed6-cc0b-783b-b414-c5fb8a81f227	jRkLNq5i4au2BfsN1KtmcnmWoBYO2U2O	2025-08-22 17:07:18.14		node	2025-08-15 17:07:18.141	2025-08-15 17:07:18.141	\N	\N
0198af8f-5aa4-7dab-a8c6-9f66cdbff729	0198aed6-cc0b-783b-b414-c5fb8a81f227	tdQu0P9cRfbWG9nAOxhNT3hDv97hAli8	2025-08-22 17:07:43.969		node	2025-08-15 17:07:43.969	2025-08-15 17:07:43.969	\N	\N
0198b83f-5dbf-7e32-8cb1-339f7d4727f7	0198b046-c453-72d9-b71a-092e1f75601a	eXZpDURS2lWAYQcefrmaYq8DIWOugucB	2025-08-24 09:36:55.739		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 09:36:55.74	2025-08-17 09:36:55.74	\N	\N
0198b929-c233-71eb-bab2-50ff00f29edd	0198b046-c453-72d9-b71a-092e1f75601a	5GdhSREYA3XuqOjavdcjXDHObDczdmXs	2025-08-24 13:52:57.922		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 13:52:57.922	2025-08-17 13:52:57.922	\N	\N
0198af9b-3a00-79e9-ae89-fdf042edc48a	0198aed6-cc0b-783b-b414-c5fb8a81f227	bU8hPBRoFb4z7lZ9ZRH0Fyx1WN8ekrgi	2025-08-22 17:20:42.152		node	2025-08-15 17:20:42.152	2025-08-15 17:20:42.152	\N	\N
0198b938-da3a-791d-81ce-581d4d4c18ce	0198b046-c453-72d9-b71a-092e1f75601a	B0QOHVJSEfvJIceG8tWrETu6kHDJbDJ9	2025-08-24 14:09:27.098		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:09:27.098	2025-08-17 14:09:27.098	\N	\N
0198b947-a913-77c9-bbfe-39cd6ce38944	0198b046-c453-72d9-b71a-092e1f75601a	t1EsSQ5P29DXAJJu3Pskp6KFvaxBAmRG	2025-08-24 14:25:37.559		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:25:37.559	2025-08-17 14:25:37.559	\N	\N
0198b955-2060-74ba-ad6f-3ab9a040d148	0198b046-c453-72d9-b71a-092e1f75601a	FmEkimsZWjXWCgncseIxiy6xdxcrrjHk	2025-08-24 14:40:20.06		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:40:20.06	2025-08-17 14:40:20.06	\N	\N
0198af9f-5ae5-79a0-a5f6-906bb916534e	0198aed6-cc0b-783b-b414-c5fb8a81f227	jW0WaXvCli4xEVVRGJv1dbjqrg9tzsfd	2025-08-22 17:25:12.578		node	2025-08-15 17:25:12.578	2025-08-15 17:25:12.578	\N	\N
0198afa8-fede-7278-8036-9b900bdb33c5	0198aed6-cc0b-783b-b414-c5fb8a81f227	BlLRnQyFfkXwM6ac10Zgmnd4A3pcldpI	2025-08-22 17:35:44.547		curl/8.5.0	2025-08-15 17:35:44.547	2025-08-15 17:35:44.547	\N	\N
0198afae-a14d-760a-b765-641ee5cba6f1	0198aed6-cc0b-783b-b414-c5fb8a81f227	ofGr004aXubYLbmXOToI5bL6DViQBJvP	2025-08-22 17:41:53.846		node	2025-08-15 17:41:53.846	2025-08-15 17:41:53.846	\N	\N
0198afaf-49c7-764b-955e-7dcca58353e2	0198aed6-cc0b-783b-b414-c5fb8a81f227	e0A81ri5hXBo0hyGNOxmsFR76jHUgLFw	2025-08-22 17:42:36.968		node	2025-08-15 17:42:36.968	2025-08-15 17:42:36.968	\N	\N
0198afaf-a779-7102-b98f-befb2090edb4	0198aed6-cc0b-783b-b414-c5fb8a81f227	wU9KXiYsJozDcLcVZ7dyiDE5QedNasWj	2025-08-22 17:43:00.955		node	2025-08-15 17:43:00.955	2025-08-15 17:43:00.955	\N	\N
0198afb0-aa87-7a63-8ac4-3b8036e5590e	0198aed6-cc0b-783b-b414-c5fb8a81f227	3aavbacGM5sWFBra4jtkVhr5ZFlkz1gz	2025-08-22 17:44:07.25		node	2025-08-15 17:44:07.25	2025-08-15 17:44:07.25	\N	\N
0198afb1-48fd-7038-bc49-f87b1c926853	0198aed6-cc0b-783b-b414-c5fb8a81f227	Ojk5PxCmEdnojLq4DfjrRJRPdJWD7lw6	2025-08-22 17:44:47.842		node	2025-08-15 17:44:47.842	2025-08-15 17:44:47.842	\N	\N
0198afbc-0700-761d-b3b7-ac63bbc5902b	0198aed6-cc0b-783b-b414-c5fb8a81f227	e5xDlcmxH9a2nMCIQc4abqg5IbqNg9Ke	2025-08-22 17:56:31.852		node	2025-08-15 17:56:31.852	2025-08-15 17:56:31.852	\N	\N
0198b047-4d5b-7ec5-ab35-28414ce34834	0198b046-c453-72d9-b71a-092e1f75601a	sKvFaiNNFtzlWQPRDNTnuOclMFJwxU3A	2025-08-22 20:28:39.233		node	2025-08-15 20:28:39.233	2025-08-15 20:28:39.233	\N	\N
0198b047-9155-77c3-95a1-13a4ebba5416	0198b046-d127-769d-9bc2-8e5824b71b3a	ilrp9onH9vDVU2DW2YzGJMWsHa7rLQ1c	2025-08-22 20:28:56.641		node	2025-08-15 20:28:56.641	2025-08-15 20:28:56.641	\N	\N
0198b047-d272-73b7-81a2-cccd536761ee	0198b046-d931-7772-a1e8-b63c68c7f43d	Tuv5xCcEsVlfLbzItyofqOCKS00IlTz4	2025-08-22 20:29:13.286		node	2025-08-15 20:29:13.287	2025-08-15 20:29:13.287	\N	\N
0198b048-13ce-7d22-972f-076a20823770	0198b046-e873-7739-bac2-10db9440486b	MHHLDxGw6Uq3v3S0X4hZ6PuwRjhBR2K4	2025-08-22 20:29:29.956		node	2025-08-15 20:29:29.956	2025-08-15 20:29:29.956	\N	\N
0198b048-5208-78d6-8c32-0368f2e8584d	0198b046-fe7a-7855-b4d8-4408253dc9c5	04YRV2YBVYDKwn4dFq7jyiko3LEzJjoV	2025-08-22 20:29:45.798		node	2025-08-15 20:29:45.799	2025-08-15 20:29:45.799	\N	\N
0198b05a-1670-788e-ba94-6873d76042ed	0198b046-c453-72d9-b71a-092e1f75601a	GJL8Jm7Wq1t44ntqZHleknvecC8nUysE	2025-08-22 20:49:10.494		node	2025-08-15 20:49:10.494	2025-08-15 20:49:10.494	\N	\N
0198b05a-1d03-7647-8172-ab92a96b944a	0198b046-d127-769d-9bc2-8e5824b71b3a	pSmAaq82SPPiCavxqgv8XOm2cWXOeiAE	2025-08-22 20:49:12.151		node	2025-08-15 20:49:12.151	2025-08-15 20:49:12.151	\N	\N
0198b05a-2385-741c-ad35-e80ebbba565b	0198b046-e873-7739-bac2-10db9440486b	bTsgqo0OyufIdaosJ4NebWviWYk37ACU	2025-08-22 20:49:13.772		node	2025-08-15 20:49:13.772	2025-08-15 20:49:13.772	\N	\N
0198b05a-29f7-7ee7-ac1b-a9b91dc650ad	0198b046-fe7a-7855-b4d8-4408253dc9c5	N1REQqrGEUn9i69aE91arkn57OkWrk1G	2025-08-22 20:49:15.403		node	2025-08-15 20:49:15.404	2025-08-15 20:49:15.404	\N	\N
0198b05a-7103-7471-9c0d-a5027bd08479	0198b046-c453-72d9-b71a-092e1f75601a	6lg2MqJ2UGzs2glOMzFwfw1htSg4bqU5	2025-08-22 20:49:33.66		node	2025-08-15 20:49:33.66	2025-08-15 20:49:33.66	\N	\N
0198b05a-78a9-751f-b4dc-f40142935cfc	0198b046-d127-769d-9bc2-8e5824b71b3a	sMG2hu1TMaWAhkGfrQ7BuYmifn7iSa1E	2025-08-22 20:49:35.547		node	2025-08-15 20:49:35.547	2025-08-15 20:49:35.547	\N	\N
0198b05a-8035-77af-86b4-cbea131dfd46	0198b046-e873-7739-bac2-10db9440486b	BH5GXnASII4gyh6aPxOdVMociRqaMSQ0	2025-08-22 20:49:37.4		node	2025-08-15 20:49:37.4	2025-08-15 20:49:37.4	\N	\N
0198b05a-87bd-73c7-b3b2-f24598fb3c02	0198b046-fe7a-7855-b4d8-4408253dc9c5	F8UHYLUwAiU2yItC9oAiufu9k3vmE0n6	2025-08-22 20:49:39.425		node	2025-08-15 20:49:39.425	2025-08-15 20:49:39.425	\N	\N
0198b05a-d42b-7074-9fe3-7983c9b4ca62	0198b046-c453-72d9-b71a-092e1f75601a	U8bUaSSiTi5hKjf3OfEgxpXG6hc53rMo	2025-08-22 20:49:58.937		node	2025-08-15 20:49:58.937	2025-08-15 20:49:58.937	\N	\N
0198b05a-db0d-7bee-9abf-0b99a4121f20	0198b046-d127-769d-9bc2-8e5824b71b3a	6nhFXd45Req0UXswzyTuXZAjTlejZxBk	2025-08-22 20:50:00.729		node	2025-08-15 20:50:00.729	2025-08-15 20:50:00.729	\N	\N
0198b05a-e24c-7888-8e62-a53780e49ae5	0198b046-e873-7739-bac2-10db9440486b	HYzToK2utap43m0V9ipuaq2d0FqbDEFB	2025-08-22 20:50:02.576		node	2025-08-15 20:50:02.576	2025-08-15 20:50:02.576	\N	\N
0198b05a-e917-786b-9af6-990c2c3afe53	0198b046-fe7a-7855-b4d8-4408253dc9c5	9sFK7LUaIwIk42kyzHWsjRzhx0p5jeX2	2025-08-22 20:50:04.333		node	2025-08-15 20:50:04.334	2025-08-15 20:50:04.334	\N	\N
0198b05b-7a0e-7bcb-8411-0e83f92b5510	0198b046-c453-72d9-b71a-092e1f75601a	QHxyZIZ7qVv4xJOJEm2hEL26xeQZFrrJ	2025-08-22 20:50:40.613		node	2025-08-15 20:50:40.614	2025-08-15 20:50:40.614	\N	\N
0198b05b-84ad-7110-a7cc-510e13aa5525	0198b046-d127-769d-9bc2-8e5824b71b3a	TJMJHFCFYYHadauO8a5EQDtdyhofQxo3	2025-08-22 20:50:44.127		node	2025-08-15 20:50:44.127	2025-08-15 20:50:44.127	\N	\N
0198b05b-8c4a-70c7-9034-318dd1e63865	0198b046-e873-7739-bac2-10db9440486b	Gm1753CIYlcmNI4TAQoMS4NBiidpVX6s	2025-08-22 20:50:46.062		node	2025-08-15 20:50:46.062	2025-08-15 20:50:46.062	\N	\N
0198b05b-93b7-7f28-8a98-6d9ef528ed24	0198b046-fe7a-7855-b4d8-4408253dc9c5	rFQr5GvFUXjNKVtXldGY9GREmaaLzUDr	2025-08-22 20:50:48.064		node	2025-08-15 20:50:48.064	2025-08-15 20:50:48.064	\N	\N
0198b2d7-521f-7bbb-a874-821672288806	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	9kCTa49xtrZxxk9xBZYYUKgNjIBZY7ef	2025-08-23 08:25:11.165		curl/8.5.0	2025-08-16 08:25:11.166	2025-08-16 08:25:11.166	\N	\N
0198b2d8-04c9-78f0-bd58-b440c8d89ed1	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	yfXrJJwON49RFEGDeorwqxwCdcD0r7WS	2025-08-23 08:25:57.867		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-16 08:25:57.867	2025-08-16 08:25:57.867	\N	\N
0198b30b-7495-7073-911f-69d93c3a548c	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	6QPOw4F7wZbqlejQJsuz3Vfezk774cUu	2025-08-23 09:22:08.703		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-16 09:22:08.703	2025-08-16 09:22:08.703	\N	\N
0198b30e-61aa-7f81-81c1-8ef98632e477	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	de3oApZoT332HiRQgg36oiKkj8jke7Ss	2025-08-23 09:25:20.519		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-16 09:25:20.519	2025-08-16 09:25:20.519	\N	\N
0198b3ec-a7c0-7bf0-ba03-aca8ab540c4e	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	tIe0LbuvN2ZSLJuwzMNMswIHWp89icZf	2025-08-23 13:28:07.476		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-16 13:28:07.476	2025-08-16 13:28:07.476	\N	\N
0198b3ed-e192-7619-b3f3-d753f020f898	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	1lRvWYdMYonT3cH4sIiJAEnTsF0Trx9T	2025-08-23 13:29:27.88		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-16 13:29:27.88	2025-08-16 13:29:27.88	\N	\N
0198b3ef-95c1-797a-b8d9-aefaab4e5003	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	PCNKG9sCuCEg9GFz5IHySvGmzNNeZeh6	2025-08-23 13:31:19.405		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-16 13:31:19.405	2025-08-16 13:31:19.405	\N	\N
0198b844-763a-77ac-a4e6-e77815468f9a	0198b046-c453-72d9-b71a-092e1f75601a	MIT7jeELZvmqtO4wb9PnHf92cwc6Duz3	2025-08-24 09:42:30.706		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 09:42:30.706	2025-08-17 09:42:30.706	\N	\N
0198b3e9-3a76-78b3-8203-266ae04ec3aa	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	WAQwQqcQbK9ECijx7VjVZ33RQiHnafm3	2025-08-24 13:24:44.488		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-16 13:24:22.921	2025-08-17 13:24:44.488	\N	\N
0198b92b-6fe0-7ebd-920d-eca312819c2e	0198b046-c453-72d9-b71a-092e1f75601a	hBMPZhjnf2FZHBHI7ytrML9fAZwbIceP	2025-08-24 13:54:47.896		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 13:54:47.896	2025-08-17 13:54:47.896	\N	\N
0198b93a-b0a3-70e6-ad79-8bd9f59c9cb8	0198b046-c453-72d9-b71a-092e1f75601a	iCxD0IothhPB9eNYBSsq0ClTpeXYe90j	2025-08-24 14:11:27.533		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:11:27.533	2025-08-17 14:11:27.533	\N	\N
0198b94d-c23b-794f-94b1-444e356b1a2f	0198b046-c453-72d9-b71a-092e1f75601a	BcqDkyH5cX2wdotqyC4XmEVa1JzwCahR	2025-08-24 14:32:17.201		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:32:17.201	2025-08-17 14:32:17.201	\N	\N
0198b956-ec6d-7705-84eb-165bed505540	0198b046-c453-72d9-b71a-092e1f75601a	Sci5NYjpXBWEcpn2alOr3niSoQAR1INw	2025-08-24 14:42:17.855		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:42:17.855	2025-08-17 14:42:17.855	\N	\N
0198b95d-c6b5-7fbf-bb01-92192ba9b123	0198b046-c453-72d9-b71a-092e1f75601a	kll2bZjije0nVy2M6WbRMX5Fp2NESKjy	2025-08-24 14:49:46.918		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 14:49:46.918	2025-08-17 14:49:46.918	\N	\N
0198b98c-5660-791c-ad7c-b0d6a04db31e	0198b046-c453-72d9-b71a-092e1f75601a	n11DyGOT84UzFMVp0NNnANIHq7ZjLi66	2025-08-24 15:40:38.348		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:40:38.348	2025-08-17 15:40:38.348	\N	\N
0198b997-b658-743e-8571-9af9a586f741	0198b046-c453-72d9-b71a-092e1f75601a	ZKtJ5nOicYcCAbJczMzFTsX8rihsSOhM	2025-08-24 15:53:03.84		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 15:53:03.84	2025-08-17 15:53:03.84	\N	\N
0198b99f-0425-7870-b184-9e72f310e3bc	0198b046-c453-72d9-b71a-092e1f75601a	axWu7yv1WB9bCn9uXMU1jucLxMmodhdV	2025-08-24 16:01:02.483		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 16:01:02.483	2025-08-17 16:01:02.483	\N	\N
0198b9e6-6c5f-7b96-afd8-13f98ec49f82	0198b046-c453-72d9-b71a-092e1f75601a	yoIGovd4nGYD53PUuz1CzVbKZL7TF8HG	2025-08-24 17:19:02.28		Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36	2025-08-17 17:19:02.28	2025-08-17 17:19:02.28	\N	\N
\.


--
-- Data for Name: subscription_limits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_limits (id, tier, limit_type, limit_value, limit_details, is_active, created_at, updated_at) FROM stdin;
2393b9b2-f5ed-49a9-8014-04e32e484b07	free	api_calls_per_month	1000	{"description": "API calls per month"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
2fc637f4-3ee7-4549-b36e-d3ca1bb11117	free	storage_gb	1	{"description": "Storage limit in GB"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
36d70bbb-a888-4254-a8f2-0ddd8d03e1f2	free	max_users	3	{"description": "Maximum organization members"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
f3c76781-daf7-4861-b87e-de25e92c3bca	free	max_projects	2	{"description": "Maximum projects"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
bf951b85-cdcd-4205-822c-b84863032ab0	free	max_tasks_per_project	50	{"description": "Maximum tasks per project"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
81f9ab0e-6ad8-474b-8a13-91480ddd9174	pro	api_calls_per_month	10000	{"description": "API calls per month"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
55ec751f-4d52-4cf3-b60f-207413e4a2f1	pro	storage_gb	50	{"description": "Storage limit in GB"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
29c832c7-a446-453e-9501-7399ce8603bd	pro	max_users	25	{"description": "Maximum organization members"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
eae5bbc6-166f-43ec-ac73-90e1763cd396	pro	max_projects	25	{"description": "Maximum projects"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
0c375a50-28c6-447a-96b2-fe532f4cc04c	pro	max_tasks_per_project	1000	{"description": "Maximum tasks per project"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
deefb8cc-2144-48aa-a5d7-a4a6c911bf24	enterprise	api_calls_per_month	100000	{"description": "API calls per month"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
179e2608-bbc9-42c3-af3e-3d014f0f222b	enterprise	storage_gb	500	{"description": "Storage limit in GB"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
cca42f55-c5ef-45a6-ac6f-4c488249e281	enterprise	max_users	500	{"description": "Maximum organization members"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
7e2e04a3-4e67-49a3-b33d-c7258b5ef989	enterprise	max_projects	500	{"description": "Maximum projects"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
9d0249dd-0fa8-4eea-9bb5-beeb4cd3b88b	enterprise	max_tasks_per_project	10000	{"description": "Maximum tasks per project"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
8514512f-112a-473c-b9eb-99582d42357f	trial	api_calls_per_month	50000	{"description": "API calls per month during trial"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
84e91bd7-1a03-42d2-b550-1e92c561cd4f	trial	storage_gb	10	{"description": "Storage limit in GB during trial"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
e30d3001-d976-4822-aaaa-fbfbe39ac93e	trial	max_users	25	{"description": "Maximum organization members during trial"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
df7bcff2-6af4-4722-a557-f9d2640c346f	trial	max_entities_total	-1	{"description": "Unlimited entities during trial (-1 = unlimited)"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
1dc53815-b154-4038-a4c9-e49dbe147fdd	trial	trial_days	14	{"description": "Trial period length in days"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
57a93457-3e56-408c-bfa4-79b2ce80d970	starter	api_calls_per_month	5000	{"description": "API calls per month"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
a34c09b8-1222-410e-bf99-c31f1fc7f073	starter	storage_gb	5	{"description": "Storage limit in GB"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
65e11425-4a92-4365-8634-eaf0c1012cd0	starter	max_users	3	{"description": "Maximum organization members"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
3ed48121-22d3-4f4d-bbbd-a9ff07cc8394	starter	max_entities_total	-1	{"description": "Unlimited entities (-1 = unlimited)"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
\.


--
-- Data for Name: task_org_api_1755170776840_development_tasks_apis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_org_api_1755170776840_development_tasks_apis (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, project_id, description, priority, start_date, due_date, completed_date, assignee_id, github_issue, story_points, sprint) FROM stdin;
\.


--
-- Data for Name: test_crud_final_final_crud_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_crud_final_final_crud_tests (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, client_name, budget) FROM stdin;
213347e7-2b80-4106-823f-5b249920f0fe	test-crud-final	Final CRUD Test Project	active	\N	\N	{}	2025-08-14 11:30:57.385+00	2025-08-14 11:30:57.385+00	Testing complete CRUD workflow	critical	\N	\N	\N	Ultimate Client Corp	150000
\.


--
-- Data for Name: test_crud_org_crud_test_projectss; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_crud_org_crud_test_projectss (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, client_name, budget) FROM stdin;
\.


--
-- Data for Name: test_crud_org_v2_crud_test_v2s; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_crud_org_v2_crud_test_v2s (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, client_name, budget) FROM stdin;
\.


--
-- Data for Name: test_manual_org_manual_test_projectss; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_manual_org_manual_test_projectss (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, client_name, budget) FROM stdin;
\.


--
-- Data for Name: test_org_api_1755170768084_client_projects_apis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_org_api_1755170768084_client_projects_apis (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, client_name, contract_value, project_phase) FROM stdin;
\.


--
-- Data for Name: test_org_api_1755170775829_client_projects_apis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_org_api_1755170775829_client_projects_apis (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, client_name, contract_value, project_phase) FROM stdin;
\.


--
-- Data for Name: universal_entity_registry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.universal_entity_registry (org_id, entity_name, table_name, definition, created_at) FROM stdin;
test-crud-org	crud_test_projects	test_crud_org_crud_test_projectss	{"archetype":"project","fields":[{"name":"client_name","type":"text","required":true},{"name":"budget","type":"decimal","required":false}]}	2025-08-14 11:29:48.873764
test-crud-org-v2	crud_test_v2	test_crud_org_v2_crud_test_v2s	{"archetype":"project","fields":[{"name":"client_name","type":"text","required":true},{"name":"budget","type":"decimal","required":false}]}	2025-08-14 11:30:23.769948
test-crud-final	final_crud_test	test_crud_final_final_crud_tests	{"archetype":"project","fields":[{"name":"client_name","type":"text","required":true},{"name":"budget","type":"decimal","required":false}]}	2025-08-14 11:30:51.577061
org-a	isolation_test	org_a_isolation_tests	{"archetype":"project","fields":[{"name":"department","type":"text","required":true}]}	2025-08-14 11:31:38.337035
org-b	isolation_test	org_b_isolation_tests	{"archetype":"project","fields":[{"name":"department","type":"text","required":true}]}	2025-08-14 11:31:39.806887
auth-test-org-1755171367708	auth_tracked_projects	auth_test_org_1755171367708_auth_tracked_projectss	{"archetype":"project","fields":[{"name":"project_owner","type":"text","required":true},{"name":"auth_test_field","type":"text","required":false}]}	2025-08-14 11:36:09.516056
audit-org-1755171369652	audit_test_tasks	audit_org_1755171369652_audit_test_taskss	{"archetype":"task","fields":[{"name":"assignee","type":"text","required":true}]}	2025-08-14 11:36:10.984166
user-org-a-1755171371820	user_isolated_records	user_org_a_1755171371820_user_isolated_recordss	{"archetype":"record","fields":[{"name":"user_data","type":"text","required":true}]}	2025-08-14 11:36:13.182409
user-org-b-1755171371820	user_isolated_records	user_org_b_1755171371820_user_isolated_recordss	{"archetype":"record","fields":[{"name":"user_data","type":"text","required":true}]}	2025-08-14 11:36:14.548024
anon-test-org-1755171376923	anonymous_test	anon_test_org_1755171376923_anonymous_tests	{"archetype":"document","fields":[{"name":"anonymous_field","type":"text","required":false}]}	2025-08-14 11:36:18.393348
auth-test-org	auth_test_projects	auth_test_org_auth_test_projectss	{"archetype":"project","fields":[{"name":"client_name","type":"text","required":true},{"name":"budget","type":"decimal","required":false}]}	2025-08-14 11:37:32.718856
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."user" (id, name, email, "emailVerified", image, role, "createdAt", "updatedAt", banned, "banReason", "banExpires", password) FROM stdin;
0198aed6-cc0b-783b-b414-c5fb8a81f227	TechFlow Admin	admin@techflow.solutions	t	\N	user	2025-08-15 17:46:09.288+00	2025-08-17 12:41:50.512685+00	\N	\N	\N	$2b$12$UkgwO6dP5ESpW4LcTIneguT5qCkwGzl4vPEuLxlhJsym0cUL6Jfza
0198b046-c453-72d9-b71a-092e1f75601a	Alice CEO	ceo@widecorp.com	t	\N	user	2025-08-16 00:28:04.561+00	2025-08-17 12:55:09.020964+00	\N	\N	\N	$2b$12$RZX/uFINTrCFCSlAn33JDumVcEb2KdvsXwuB0flwHBwTo/lBx.2mC
0198b046-d127-769d-9bc2-8e5824b71b3a	Bob CTO	cto@widecorp.com	t	\N	user	2025-08-16 00:28:07.847+00	2025-08-17 12:55:09.418718+00	\N	\N	\N	$2b$12$GDPdRpqlTyZolhv.m0jQIuRJgAPBYpKLVQnH2hP4F6Wh8aluRFOuC
0198b046-d931-7772-a1e8-b63c68c7f43d	Carol PM	pm1@widecorp.com	t	\N	user	2025-08-16 00:28:09.905+00	2025-08-17 12:55:09.824229+00	\N	\N	\N	$2b$12$ciyrZyDuwZ9ZAl4rENG.ZOpvabqyRgGxVPxoeO/gCBTq0N1n.qi6i
0198b046-e16b-7b46-a15e-baa49fd29990	David PM	pm2@widecorp.com	t	\N	user	2025-08-16 00:28:12.011+00	2025-08-17 12:55:10.18225+00	\N	\N	\N	$2b$12$68H96svCejJIiTnncWJO/.KGreKFVgVylSL7TAiBxwFx5KZoUB3/O
0198b046-e873-7739-bac2-10db9440486b	Eve Developer	dev1@widecorp.com	t	\N	user	2025-08-16 00:28:13.81+00	2025-08-17 12:55:10.606779+00	\N	\N	\N	$2b$12$mALd9lLsH5p5TzERnvAmSOgaG6GD/CzdPemEkd2UII8pODiPn7iKe
0198b046-f056-7735-a3aa-60e8a329dd23	Frank Developer	dev2@widecorp.com	t	\N	user	2025-08-16 00:28:15.829+00	2025-08-17 12:55:11.079074+00	\N	\N	\N	$2b$12$CKAeG/Wme8JtNsQaDnnBkuTY9a898Me3/fDsPJ7Ym9k8wCE8njn4O
0198b046-f71e-7bec-a853-294d7cbcbda5	Grace Designer	designer@widecorp.com	t	\N	user	2025-08-16 00:28:17.565+00	2025-08-17 12:55:11.600933+00	\N	\N	\N	$2b$12$VdwNBJWrtU2GynBWVd3xjeYrvdkRQudkKntGOyH6PAhbkOLfXZ4FW
0198b046-fe7a-7855-b4d8-4408253dc9c5	Henry Intern	intern@widecorp.com	t	\N	user	2025-08-16 00:28:19.45+00	2025-08-17 12:55:12.015002+00	\N	\N	\N	$2b$12$.e0lFAaKpiSYmrHFk9AgseXwDrGtPipiPBR78qwLBcX3gD87vknm.
0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	Playwright Test User	test-playwright-1755347086@gmail.com	t	\N	admin	2025-08-16 12:24:47.367+00	2025-08-16 12:24:47.367+00	\N	\N	\N	\N
0198b059-5419-7165-b2c3-937a66b94865	System Admin	admin@polytest.com	t	\N	user	2025-08-16 00:48:21.017+00	2025-08-16 00:48:21.017+00	\N	\N	\N	\N
0198b059-5999-7f84-8217-0506a838e0da	Sales Manager	sales@polytest.com	t	\N	user	2025-08-16 00:48:22.425+00	2025-08-16 00:48:22.425+00	\N	\N	\N	\N
0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	Support Agent	support@polytest.com	t	\N	user	2025-08-16 00:48:23.998+00	2025-08-16 00:48:23.998+00	\N	\N	\N	\N
0198b059-64c9-7c4f-87be-5b1a3704f1c3	Read Only User	readonly@polytest.com	t	\N	user	2025-08-16 00:48:25.289+00	2025-08-16 00:48:25.289+00	\N	\N	\N	\N
\.


--
-- Data for Name: user_org_a_1755171371820_user_isolated_recordss; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_org_a_1755171371820_user_isolated_recordss (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, user_data) FROM stdin;
8fdb1a3e-380f-417f-920e-94b0dc67b4ab	user-org-a-1755171371820	Org A Record	active	\N	\N	{}	2025-08-14 11:36:14.925+00	2025-08-14 11:36:14.925+00	ORG_A_USER_DATA
\.


--
-- Data for Name: user_org_b_1755171371820_user_isolated_recordss; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_org_b_1755171371820_user_isolated_recordss (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, user_data) FROM stdin;
daf044d5-e760-4463-b4ba-d31baa9d9160	user-org-b-1755171371820	Org B Record	active	\N	\N	{}	2025-08-14 11:36:15.673+00	2025-08-14 11:36:15.673+00	ORG_B_USER_DATA
\.


--
-- Data for Name: validation_org_1755170780558_comprehensive_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.validation_org_1755170780558_comprehensive_tests (id, organization_id, name, status, created_by_id, client_id, custom_fields, created_at, updated_at, description, priority, start_date, end_date, owner_id, text_field, longtext_field, number_field, decimal_field, boolean_field, date_field, datetime_field, json_field) FROM stdin;
\.


--
-- Data for Name: verification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") FROM stdin;
0198b838-9bf2-7a45-a2ea-7551625a3505	reset-password:vVuNxrb89cdJWHGiUhudtXIV	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 10:29:34.449	2025-08-17 09:29:34.449	2025-08-17 09:29:34.449
0198b838-a6cd-7be8-851d-e596bc78834b	reset-password:Sj4BQoOLs8xXxz2oAlsyafX1	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 10:29:37.228	2025-08-17 09:29:37.229	2025-08-17 09:29:37.229
0198b838-b14b-7ce1-acd8-dc7fb085d603	reset-password:L6Y53N5e66HvBnVnxWWdOaXi	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 10:29:39.915	2025-08-17 09:29:39.915	2025-08-17 09:29:39.915
0198b839-91fb-7f2e-899e-d76e7b92dc8f	reset-password:XF0p0dMVG315J4XpfPYu7rd2	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 10:30:37.435	2025-08-17 09:30:37.435	2025-08-17 09:30:37.435
0198b839-9af6-7001-9c89-1d753d2de43a	reset-password:APHkQD0DMyqiRWQokUTDu2Qm	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 10:30:39.734	2025-08-17 09:30:39.734	2025-08-17 09:30:39.734
0198b839-a325-778d-8a14-9085e38e9d23	reset-password:UugKX0mya2rwkd0L3W6MtZ55	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 10:30:41.829	2025-08-17 09:30:41.829	2025-08-17 09:30:41.829
\.


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

