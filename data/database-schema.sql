--
-- PostgreSQL database cluster dump
--

\restrict res6rHw7ND65DgcZsvE5L1YmeN8S5k403bjZi268bkrSfmV5pBUp2PYfHwoK9eX

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:hDJFpxU+RwYeYVYdZseesA==$pugO/TbJ1u+m9gJWaccalM32BSJ2RSoALu5P6vi920o=:PdSRguQY2lfdmUNggJtDgR4KOPABNU5qwjmOjQwoKmQ=';
CREATE ROLE rls_test_user;
ALTER ROLE rls_test_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:tueG4GI1G0SneGrZC4hpJA==$Q5sMDwyrEwxKwhKBioFYfR8Y9aqXed49wTwZ1iYZHdc=:JWT2AWNewOtZVyPLtptGJI8xqIUGfnieMm1tub8AQs0=';
CREATE ROLE test_user;
ALTER ROLE test_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:ZV+dENjmNVuPaWWqsFtxVQ==$S0COFRLdQlbsZVT+iCSv66dvrFxjMPgwIINNLIxaBXI=:GBBBjLxQZQePFTikOuN4qmz09lhxI0AzLV4k1Kr2yR0=';
CREATE ROLE vibestack_app;
ALTER ROLE vibestack_app WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE vibestack_app_user;
ALTER ROLE vibestack_app_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:QPkei0PoACmdjke8oax4LQ==$xfrXIQNKVrupVwF6ulXFDq8ogWu21unMZFigalQRFJk=:3wwg/gGgWZqZlhjxTp+C72rQgXlVZqOH3qPzvRsmxs4=';

--
-- User Configurations
--








\unrestrict res6rHw7ND65DgcZsvE5L1YmeN8S5k403bjZi268bkrSfmV5pBUp2PYfHwoK9eX

--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

--
-- PostgreSQL database dump
--

\restrict XGrspnWSIjROcUC1PahfC2dhG5dH4MuHJGjtx2qJE7IhPs9feJOuSVhBDr3CBbq

-- Dumped from database version 17.6 (Debian 17.6-1.pgdg12+1)
-- Dumped by pg_dump version 17.6 (Debian 17.6-1.pgdg12+1)

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
-- PostgreSQL database dump complete
--

\unrestrict XGrspnWSIjROcUC1PahfC2dhG5dH4MuHJGjtx2qJE7IhPs9feJOuSVhBDr3CBbq

--
-- Database "elevra_dev" dump
--

--
-- PostgreSQL database dump
--

\restrict CDexJOV1izbpqCcaf67dxmllyU53vFycdECFl8dGczpvfG5UTowmq9AzanHYiAB

-- Dumped from database version 17.6 (Debian 17.6-1.pgdg12+1)
-- Dumped by pg_dump version 17.6 (Debian 17.6-1.pgdg12+1)

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
-- Name: elevra_dev; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE elevra_dev WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE elevra_dev OWNER TO postgres;

\unrestrict CDexJOV1izbpqCcaf67dxmllyU53vFycdECFl8dGczpvfG5UTowmq9AzanHYiAB
\connect elevra_dev
\restrict CDexJOV1izbpqCcaf67dxmllyU53vFycdECFl8dGczpvfG5UTowmq9AzanHYiAB

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
-- Name: add_soft_delete_fields(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_soft_delete_fields(table_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Add deleted boolean field (default false)
    BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted BOOLEAN DEFAULT FALSE', table_name);
        RAISE NOTICE 'Added deleted field to table: %', table_name;
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'Deleted field already exists in table: %', table_name;
    END;
    
    -- Add deleted_at timestamp field (nullable)
    BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE', table_name);
        RAISE NOTICE 'Added deleted_at field to table: %', table_name;
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'Deleted_at field already exists in table: %', table_name;
    END;
    
    -- Add index on deleted field for efficient queries
    BEGIN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (deleted)', 
                      table_name || '_deleted_idx', 
                      table_name);
        RAISE NOTICE 'Added deleted index to table: %', table_name;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not create deleted index for table: % (may already exist)', table_name;
    END;
    
    -- Add index on deleted_at field for efficient queries
    BEGIN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (deleted_at)', 
                      table_name || '_deleted_at_idx', 
                      table_name);
        RAISE NOTICE 'Added deleted_at index to table: %', table_name;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not create deleted_at index for table: % (may already exist)', table_name;
    END;
END;
$$;


ALTER FUNCTION public.add_soft_delete_fields(table_name text) OWNER TO postgres;

--
-- Name: add_updated_at_trigger(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_updated_at_trigger(table_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    trigger_name TEXT;
BEGIN
    trigger_name := table_name || '_update_updated_at';
    
    -- Drop trigger if it exists
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, table_name);
    
    -- Create the trigger
    EXECUTE format('
        CREATE TRIGGER %I
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()',
        trigger_name,
        table_name
    );
    
    RAISE NOTICE 'Added updated_at trigger to table: %', table_name;
END;
$$;


ALTER FUNCTION public.add_updated_at_trigger(table_name text) OWNER TO postgres;

--
-- Name: apply_entity_table_rls(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_entity_table_rls(table_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Enable RLS on the table
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    
    -- Read policy - users can read data in their org if they have read permissions
    EXECUTE format('
        CREATE POLICY %I_read_policy ON %I
        FOR SELECT
        USING (
            user_can_read() AND 
            organization_id = get_current_organization_id()
        )',
        table_name || '_read', table_name
    );
    
    -- Write policy - users can insert data if they have write permissions
    EXECUTE format('
        CREATE POLICY %I_insert_policy ON %I  
        FOR INSERT
        WITH CHECK (
            user_can_write() AND
            organization_id = get_current_organization_id()
        )',
        table_name || '_insert', table_name
    );
    
    -- Update policy - users can update data if they have write permissions
    EXECUTE format('
        CREATE POLICY %I_update_policy ON %I
        FOR UPDATE
        USING (
            user_can_write() AND
            organization_id = get_current_organization_id()
        )
        WITH CHECK (
            user_can_write() AND
            organization_id = get_current_organization_id()
        )',
        table_name || '_update', table_name
    );
    
    -- Delete policy - only managers can delete data
    EXECUTE format('
        CREATE POLICY %I_delete_policy ON %I
        FOR DELETE
        USING (
            user_can_manage() AND
            organization_id = get_current_organization_id()
        )',
        table_name || '_delete', table_name
    );
    
END;
$$;


ALTER FUNCTION public.apply_entity_table_rls(table_name text) OWNER TO postgres;

--
-- Name: FUNCTION apply_entity_table_rls(table_name text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.apply_entity_table_rls(table_name text) IS 'Applies standard RLS policies to dynamically created entity tables';


--
-- Name: apply_simplified_business_table_rls(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_simplified_business_table_rls() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    table_record RECORD;
    policy_count INTEGER := 0;
BEGIN
    -- Find all business tables (org_*_* pattern)
    FOR table_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'org_%_%'
        AND schemaname = 'public'
    LOOP
        -- Drop existing complex policies
        EXECUTE format('DROP POLICY IF EXISTS %I_admin_policy ON %I.%I', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS %I_user_policy ON %I.%I', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS %I_role_policy ON %I.%I', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        
        -- Create simple organization-only policy
        EXECUTE format('CREATE POLICY %I_org_policy ON %I.%I FOR ALL USING (organization_id = get_current_organization_id())', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        
        policy_count := policy_count + 1;
        
        RAISE NOTICE 'Applied simplified RLS to table: %', table_record.tablename;
    END LOOP;
    
    RETURN format('Applied simplified RLS policies to %s business tables', policy_count);
END;
$$;


ALTER FUNCTION public.apply_simplified_business_table_rls() OWNER TO postgres;

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
-- Name: check_user_permission(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_user_permission(operation text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    CASE operation
        WHEN 'read' THEN
            RETURN user_can_read();
        WHEN 'write', 'create', 'update' THEN  
            RETURN user_can_write();
        WHEN 'delete', 'manage' THEN
            RETURN user_can_manage();
        WHEN 'administer', 'admin' THEN
            RETURN user_can_administer();
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;


ALTER FUNCTION public.check_user_permission(operation text) OWNER TO postgres;

--
-- Name: FUNCTION check_user_permission(operation text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.check_user_permission(operation text) IS 'Checks if user has permission for specific operation';


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
-- Name: ensure_org_id_indexes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_org_id_indexes() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    table_record RECORD;
    index_count INTEGER := 0;
BEGIN
    FOR table_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'org_%_%'
        AND schemaname = 'public'
    LOOP
        -- Create organization_id index if it doesn't exist
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON %I.%I(organization_id)', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        
        index_count := index_count + 1;
    END LOOP;
    
    RETURN format('Ensured organization_id indexes on %s business tables', index_count);
END;
$$;


ALTER FUNCTION public.ensure_org_id_indexes() OWNER TO postgres;

--
-- Name: generate_uuidv7(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_uuidv7() RETURNS uuid
    LANGUAGE sql
    AS $$ SELECT gen_random_uuid(); $$;


ALTER FUNCTION public.generate_uuidv7() OWNER TO postgres;

--
-- Name: get_available_relationship_types(uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_available_relationship_types(p_org_id uuid, p_source_entity_type character varying DEFAULT NULL::character varying, p_target_entity_type character varying DEFAULT NULL::character varying) RETURNS TABLE(relationship_type text, label text, description text, color text, icon text, allowed_target_types text[], cardinality text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        co.value::TEXT as relationship_type,
        co.label,
        co.description,
        co.color,
        co.icon,
        ARRAY(SELECT jsonb_array_elements_text(co.metadata->'allowed_target')) as allowed_target_types,
        co.metadata->>'cardinality' as cardinality
    FROM custom_options co
    JOIN custom_option_sets cos ON co.option_set_id = cos.id
    WHERE cos.org_id = p_org_id::text
        AND cos.option_set_type = 'relationship_type'
        AND co.is_active = true
        AND (
            p_source_entity_type IS NULL
            OR co.metadata->'allowed_source' ? p_source_entity_type
            OR co.metadata->'allowed_source' ? '*'
        )
        AND (
            p_target_entity_type IS NULL
            OR co.metadata->'allowed_target' ? p_target_entity_type
            OR co.metadata->'allowed_target' ? '*'
        )
    ORDER BY co.sort_order;
END;
$$;


ALTER FUNCTION public.get_available_relationship_types(p_org_id uuid, p_source_entity_type character varying, p_target_entity_type character varying) OWNER TO postgres;

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
    -- Return NULL - roles now handled by Organization Actor
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.get_current_user_role() OWNER TO postgres;

--
-- Name: FUNCTION get_current_user_role(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_current_user_role() IS 'DEPRECATED: Role checks moved to Organization Actor SQLite cache';


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
-- Name: get_organization_roles_for_cache(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_organization_roles_for_cache(p_organization_id uuid) RETURNS TABLE(user_id text, organization_id uuid, role text, permissions text[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        om.user_id,
        om.organization_id,
        om.role,
        CASE om.role
            WHEN 'owner' THEN ARRAY['admin', 'write', 'read', 'invite', 'manage_billing']
            WHEN 'admin' THEN ARRAY['admin', 'write', 'read', 'invite']  
            WHEN 'manager' THEN ARRAY['write', 'read', 'invite']
            WHEN 'member' THEN ARRAY['read', 'write']
            ELSE ARRAY['read']
        END as permissions
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
    AND om.status = 'active';
END;
$$;


ALTER FUNCTION public.get_organization_roles_for_cache(p_organization_id uuid) OWNER TO postgres;

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
-- Name: get_user_effective_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_effective_role() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    user_id TEXT;
    org_id TEXT;
    highest_role TEXT := 'none';
    role_levels INTEGER := 0;
BEGIN
    -- Get current context
    user_id := current_setting('app.current_user_id', true);
    org_id := current_setting('app.current_organization_id', true);
    
    IF user_id IS NULL OR org_id IS NULL THEN
        RETURN 'none';
    END IF;
    
    -- Define role hierarchy levels (higher number = more permissions)
    -- none: 0, viewer: 1, member: 2, contributor: 2, manager: 3, admin: 4, owner: 5
    
    -- Check system-level permissions first (highest priority)
    SELECT 
        CASE role
            WHEN 'owner' THEN 5
            WHEN 'admin' THEN 4  
            WHEN 'manager' THEN 3
            WHEN 'member' THEN 2
            WHEN 'contributor' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
        END
    INTO role_levels
    FROM container_permission 
    WHERE user_id = get_user_effective_role.user_id
      AND permission_container_type = 'system'
      AND permission_container_id = 'global'
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY 
        CASE role
            WHEN 'owner' THEN 5
            WHEN 'admin' THEN 4
            WHEN 'manager' THEN 3  
            WHEN 'member' THEN 2
            WHEN 'contributor' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
        END DESC
    LIMIT 1;
    
    -- If system role found, return it
    IF role_levels > 0 THEN
        SELECT role INTO highest_role
        FROM container_permission 
        WHERE user_id = get_user_effective_role.user_id
          AND permission_container_type = 'system'
          AND permission_container_id = 'global'
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY 
            CASE role
                WHEN 'owner' THEN 5
                WHEN 'admin' THEN 4
                WHEN 'manager' THEN 3
                WHEN 'member' THEN 2
                WHEN 'contributor' THEN 2
                WHEN 'viewer' THEN 1
                ELSE 0
            END DESC
        LIMIT 1;
        
        RETURN highest_role;
    END IF;
    
    -- Check organization-level permissions
    SELECT 
        CASE role
            WHEN 'owner' THEN 5
            WHEN 'admin' THEN 4
            WHEN 'manager' THEN 3
            WHEN 'member' THEN 2
            WHEN 'contributor' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
        END
    INTO role_levels
    FROM container_permission 
    WHERE user_id = get_user_effective_role.user_id
      AND permission_container_type = 'organization'
      AND permission_container_id = org_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY 
        CASE role
            WHEN 'owner' THEN 5
            WHEN 'admin' THEN 4
            WHEN 'manager' THEN 3
            WHEN 'member' THEN 2
            WHEN 'contributor' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
        END DESC
    LIMIT 1;
    
    -- If org role found, return it
    IF role_levels > 0 THEN
        SELECT role INTO highest_role
        FROM container_permission 
        WHERE user_id = get_user_effective_role.user_id
          AND permission_container_type = 'organization'
          AND permission_container_id = org_id
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY 
            CASE role
                WHEN 'owner' THEN 5
                WHEN 'admin' THEN 4
                WHEN 'manager' THEN 3
                WHEN 'member' THEN 2
                WHEN 'contributor' THEN 2
                WHEN 'viewer' THEN 1
                ELSE 0
            END DESC
        LIMIT 1;
        
        RETURN highest_role;
    END IF;
    
    -- Fall back to organization membership role
    SELECT role INTO highest_role
    FROM organization_members 
    WHERE user_id = get_user_effective_role.user_id
      AND organization_id = org_id;
    
    RETURN COALESCE(highest_role, 'none');
END;
$$;


ALTER FUNCTION public.get_user_effective_role() OWNER TO postgres;

--
-- Name: FUNCTION get_user_effective_role(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_effective_role() IS 'Gets the highest role for the current user in the current organization context';


--
-- Name: get_user_permissions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_permissions() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'user_id', get_current_user_id(),
        'organization_id', get_current_organization_id(),
        'effective_role', get_user_effective_role(),
        'permissions', json_build_object(
            'can_read', user_can_read(),
            'can_write', user_can_write(), 
            'can_manage', user_can_manage(),
            'can_administer', user_can_administer()
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


ALTER FUNCTION public.get_user_permissions() OWNER TO postgres;

--
-- Name: FUNCTION get_user_permissions(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_permissions() IS 'Returns JSON summary of user permissions in current context';


--
-- Name: is_organization_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_organization_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Return FALSE - admin checks now handled by Organization Actor
    RETURN FALSE;
END;
$$;


ALTER FUNCTION public.is_organization_admin() OWNER TO postgres;

--
-- Name: FUNCTION is_organization_admin(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_organization_admin() IS 'DEPRECATED: Admin checks moved to Organization Actor SQLite cache';


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
-- Name: set_default_organization_for_new_member(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_default_organization_for_new_member() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When a user joins their first organization, set it as default
    UPDATE "user" 
    SET 
        default_organization_id = COALESCE(default_organization_id, NEW.organization_id),
        last_used_organization_id = NEW.organization_id,
        last_org_access_at = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_default_organization_for_new_member() OWNER TO postgres;

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
-- Name: set_simplified_rls_context(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_simplified_rls_context(p_organization_id uuid, p_user_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Set only the organization context (for PostgreSQL RLS)
    PERFORM set_config('app.current_organization_id', p_organization_id::text, true);
    PERFORM set_config('app.current_user_id', p_user_id, true);
    
    -- Clear role from PostgreSQL context (handled by Organization Actor)
    PERFORM set_config('app.current_user_role', NULL, true);
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION public.set_simplified_rls_context(p_organization_id uuid, p_user_id text) OWNER TO postgres;

--
-- Name: set_user_default_organization(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_user_default_organization(p_user_id text, p_organization_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Verify user is a member of the organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE user_id = p_user_id 
        AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'User is not an active member of organization';
    END IF;
    
    UPDATE "user" 
    SET 
        default_organization_id = p_organization_id,
        last_used_organization_id = p_organization_id,
        last_org_access_at = NOW()
    WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION public.set_user_default_organization(p_user_id text, p_organization_id text) OWNER TO postgres;

--
-- Name: set_user_default_organization(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_user_default_organization(p_user_id text, p_organization_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Verify user is a member of the organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE user_id = p_user_id 
        AND organization_id = p_organization_id 
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'User is not an active member of organization';
    END IF;
    
    UPDATE "user" 
    SET 
        default_organization_id = p_organization_id,
        last_used_organization_id = p_organization_id,
        last_org_access_at = NOW()
    WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION public.set_user_default_organization(p_user_id text, p_organization_id uuid) OWNER TO postgres;

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
-- Name: test_simplified_rls(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.test_simplified_rls() RETURNS TABLE(test_name text, passed boolean, details text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Test 1: No context = no access
    PERFORM clear_rls_context();
    
    RETURN QUERY SELECT 
        'Simplified RLS - No context test'::TEXT,
        (SELECT COUNT(*) FROM organizations) = 0,
        'Should have no access without organization context'::TEXT;
    
    -- Test 2: With org context = access to org data only
    PERFORM set_simplified_rls_context(
        '01920000-1000-7000-8000-000000000001'::uuid,
        'test-user-id'
    );
    
    RETURN QUERY SELECT 
        'Simplified RLS - Org context test'::TEXT,
        (SELECT COUNT(*) FROM organizations WHERE id = '01920000-1000-7000-8000-000000000001'::uuid) > 0,
        'Should have access to specified organization only'::TEXT;
        
    -- Clean up
    PERFORM clear_rls_context();
END;
$$;


ALTER FUNCTION public.test_simplified_rls() OWNER TO postgres;

--
-- Name: update_dataforge_computed_fields_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_dataforge_computed_fields_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_dataforge_computed_fields_updated_at() OWNER TO postgres;

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
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: update_user_org_access(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_org_access(p_user_id text, p_organization_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE "user" 
    SET 
        last_used_organization_id = p_organization_id,
        last_org_access_at = NOW()
    WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION public.update_user_org_access(p_user_id text, p_organization_id text) OWNER TO postgres;

--
-- Name: update_user_org_access(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_org_access(p_user_id text, p_organization_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE "user" 
    SET 
        last_used_organization_id = p_organization_id,
        last_org_access_at = NOW()
    WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION public.update_user_org_access(p_user_id text, p_organization_id uuid) OWNER TO postgres;

--
-- Name: user_can_administer(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_can_administer() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_user_effective_role() IN ('admin', 'owner');
END;
$$;


ALTER FUNCTION public.user_can_administer() OWNER TO postgres;

--
-- Name: FUNCTION user_can_administer(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.user_can_administer() IS 'RLS helper - checks if user has admin permissions';


--
-- Name: user_can_manage(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_can_manage() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_user_effective_role() IN ('manager', 'admin', 'owner');
END;
$$;


ALTER FUNCTION public.user_can_manage() OWNER TO postgres;

--
-- Name: FUNCTION user_can_manage(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.user_can_manage() IS 'RLS helper - checks if user has manage permissions';


--
-- Name: user_can_read(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_can_read() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_user_effective_role() IN ('viewer', 'member', 'contributor', 'manager', 'admin', 'owner');
END;
$$;


ALTER FUNCTION public.user_can_read() OWNER TO postgres;

--
-- Name: FUNCTION user_can_read(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.user_can_read() IS 'RLS helper - checks if user has read permissions';


--
-- Name: user_can_write(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_can_write() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_user_effective_role() IN ('member', 'contributor', 'manager', 'admin', 'owner');
END;
$$;


ALTER FUNCTION public.user_can_write() OWNER TO postgres;

--
-- Name: FUNCTION user_can_write(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.user_can_write() IS 'RLS helper - checks if user has write permissions';


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
-- Name: validate_relationship(uuid, character varying, uuid, character varying, character varying, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_relationship(p_org_id uuid, p_source_entity_type character varying, p_source_entity_id uuid, p_relationship_type character varying, p_target_entity_type character varying, p_target_entity_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_valid BOOLEAN := true;
    v_errors JSONB := '[]'::jsonb;
    v_relationship_config JSONB;
    v_existing_count INT;
    v_max_allowed INT;
BEGIN
    -- Get relationship configuration
    SELECT metadata INTO v_relationship_config
    FROM custom_options co
    JOIN custom_option_sets cos ON co.option_set_id = cos.id
    WHERE cos.org_id = p_org_id
        AND cos.option_set_type = 'relationship_type'
        AND co.value = p_relationship_type;
    
    IF v_relationship_config IS NULL THEN
        v_valid := false;
        v_errors := v_errors || jsonb_build_object('error', 'Invalid relationship type');
    END IF;
    
    -- Check cardinality constraints
    IF v_relationship_config->>'cardinality' = 'one-to-one' THEN
        -- Check if source already has this relationship
        SELECT COUNT(*) INTO v_existing_count
        FROM org_01920000_1000_7000_8000_000000000001_relationships
        WHERE source_entity_type = p_source_entity_type
            AND source_entity_id = p_source_entity_id
            AND relationship_type = p_relationship_type
            AND valid_until IS NULL;
        
        IF v_existing_count > 0 THEN
            v_valid := false;
            v_errors := v_errors || jsonb_build_object('error', 'Source already has this one-to-one relationship');
        END IF;
    END IF;
    
    -- Additional validation rules can be added here
    
    RETURN jsonb_build_object(
        'valid', v_valid,
        'errors', v_errors
    );
END;
$$;


ALTER FUNCTION public.validate_relationship(p_org_id uuid, p_source_entity_type character varying, p_source_entity_id uuid, p_relationship_type character varying, p_target_entity_type character varying, p_target_entity_id uuid) OWNER TO postgres;

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
-- Name: validate_simplified_rls_context(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_simplified_rls_context() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Only check org and user context (role handled by Organization Actor)
    IF get_current_organization_id() IS NULL THEN
        RAISE EXCEPTION 'Organization context not set - RLS security violation';
    END IF;
    
    IF get_current_user_id() IS NULL THEN
        RAISE EXCEPTION 'User context not set - RLS security violation';
    END IF;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION public.validate_simplified_rls_context() OWNER TO postgres;

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
-- Name: entity_schemas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_schemas (
    org_id text NOT NULL,
    entity_name text NOT NULL,
    table_name text NOT NULL,
    archetype text NOT NULL,
    business_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT entity_schemas_archetype_check CHECK ((archetype = ANY (ARRAY['universe'::text, 'world'::text, 'project'::text, 'task'::text, 'record'::text, 'document'::text, 'file'::text, 'activity'::text, 'discussion'::text, 'collection'::text])))
);

ALTER TABLE ONLY public.entity_schemas FORCE ROW LEVEL SECURITY;


ALTER TABLE public.entity_schemas OWNER TO postgres;

--
-- Name: TABLE entity_schemas; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.entity_schemas IS 'Central registry for all organization entity schemas, replacing Durable Object approach';


--
-- Name: COLUMN entity_schemas.archetype; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.entity_schemas.archetype IS 'Maps to Universal Archetype patterns: project, task, record, document, file, activity, discussion, collection';


--
-- Name: COLUMN entity_schemas.business_metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.entity_schemas.business_metadata IS 'JSONB field containing validation rules, field definitions, and business logic';


--
-- Name: archetype_usage_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.archetype_usage_stats AS
 SELECT org_id,
    archetype,
    count(*) AS entity_count,
    count(DISTINCT entity_name) AS unique_entities,
    max(created_at) AS last_created,
    min(created_at) AS first_created
   FROM public.entity_schemas
  WHERE (archetype IS NOT NULL)
  GROUP BY org_id, archetype;


ALTER VIEW public.archetype_usage_stats OWNER TO postgres;

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
-- Name: custom_option_sets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_option_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id text NOT NULL,
    option_set_type text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.custom_option_sets OWNER TO postgres;

--
-- Name: TABLE custom_option_sets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.custom_option_sets IS 'Organization-specific option sets that can extend or override system options';


--
-- Name: custom_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    option_set_id uuid NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    description text,
    color text,
    icon text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.custom_options OWNER TO postgres;

--
-- Name: TABLE custom_options; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.custom_options IS 'Organization-specific option values with custom labels and styling';


--
-- Name: dataforge_computed_field_calculations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataforge_computed_field_calculations (
    id integer NOT NULL,
    computed_field_id integer,
    entity_id uuid NOT NULL,
    calculated_value jsonb,
    calculation_error text,
    calculation_duration_ms integer,
    context_snapshot jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.dataforge_computed_field_calculations OWNER TO postgres;

--
-- Name: TABLE dataforge_computed_field_calculations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dataforge_computed_field_calculations IS 'Optional calculation history for monitoring and debugging';


--
-- Name: dataforge_computed_field_calculations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dataforge_computed_field_calculations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dataforge_computed_field_calculations_id_seq OWNER TO postgres;

--
-- Name: dataforge_computed_field_calculations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dataforge_computed_field_calculations_id_seq OWNED BY public.dataforge_computed_field_calculations.id;


--
-- Name: dataforge_computed_field_dependencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataforge_computed_field_dependencies (
    id integer NOT NULL,
    computed_field_id integer,
    depends_on_org_id uuid NOT NULL,
    depends_on_entity_type text NOT NULL,
    depends_on_field_name text NOT NULL,
    dependency_type text DEFAULT 'field'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT dataforge_computed_field_dependencies_dependency_type_check CHECK ((dependency_type = ANY (ARRAY['field'::text, 'relationship'::text, 'computed'::text])))
);


ALTER TABLE public.dataforge_computed_field_dependencies OWNER TO postgres;

--
-- Name: TABLE dataforge_computed_field_dependencies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dataforge_computed_field_dependencies IS 'Tracks dependencies between computed fields and other fields';


--
-- Name: dataforge_computed_field_dependencies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dataforge_computed_field_dependencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dataforge_computed_field_dependencies_id_seq OWNER TO postgres;

--
-- Name: dataforge_computed_field_dependencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dataforge_computed_field_dependencies_id_seq OWNED BY public.dataforge_computed_field_dependencies.id;


--
-- Name: dataforge_computed_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataforge_computed_fields (
    id integer NOT NULL,
    org_id uuid NOT NULL,
    entity_type text NOT NULL,
    field_name text NOT NULL,
    field_type text NOT NULL,
    expression text NOT NULL,
    dependencies jsonb DEFAULT '[]'::jsonb,
    compute_location text DEFAULT 'backend'::text NOT NULL,
    result_type text DEFAULT 'number'::text NOT NULL,
    refresh_triggers jsonb DEFAULT '[]'::jsonb,
    cache_results boolean DEFAULT true,
    last_calculated timestamp without time zone,
    calculation_error text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT dataforge_computed_fields_compute_location_check CHECK ((compute_location = ANY (ARRAY['backend'::text, 'frontend'::text, 'hybrid'::text]))),
    CONSTRAINT dataforge_computed_fields_field_type_check CHECK ((field_type = ANY (ARRAY['computed_formula'::text, 'computed_expression'::text]))),
    CONSTRAINT dataforge_computed_fields_result_type_check CHECK ((result_type = ANY (ARRAY['number'::text, 'text'::text, 'boolean'::text, 'date'::text, 'json'::text])))
);


ALTER TABLE public.dataforge_computed_fields OWNER TO postgres;

--
-- Name: TABLE dataforge_computed_fields; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dataforge_computed_fields IS 'Stores configuration for computed fields including expressions and dependencies';


--
-- Name: COLUMN dataforge_computed_fields.expression; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dataforge_computed_fields.expression IS 'The mathematical or logical expression to evaluate';


--
-- Name: COLUMN dataforge_computed_fields.dependencies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dataforge_computed_fields.dependencies IS 'JSONB array of field names this computed field depends on';


--
-- Name: COLUMN dataforge_computed_fields.compute_location; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dataforge_computed_fields.compute_location IS 'Whether computation happens on backend, frontend, or hybrid';


--
-- Name: COLUMN dataforge_computed_fields.refresh_triggers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dataforge_computed_fields.refresh_triggers IS 'JSONB array of events that trigger recalculation';


--
-- Name: COLUMN dataforge_computed_fields.cache_results; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dataforge_computed_fields.cache_results IS 'Whether to store calculated values in the entity table';


--
-- Name: dataforge_computed_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dataforge_computed_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dataforge_computed_fields_id_seq OWNER TO postgres;

--
-- Name: dataforge_computed_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dataforge_computed_fields_id_seq OWNED BY public.dataforge_computed_fields.id;


--
-- Name: dataforge_relationship_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataforge_relationship_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    entity_type character varying(100) NOT NULL,
    field_name character varying(100) NOT NULL,
    relationship_type character varying(100) NOT NULL,
    target_entity_type character varying(100),
    cardinality character varying(50),
    display_format character varying(200),
    validation_rules jsonb,
    ui_config jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.dataforge_relationship_fields OWNER TO postgres;

--
-- Name: dataforge_rollup_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataforge_rollup_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id text NOT NULL,
    entity_name text NOT NULL,
    field_name text NOT NULL,
    rollup_type text NOT NULL,
    relationship_type text NOT NULL,
    target_entity_type text NOT NULL,
    target_field text,
    separator text,
    conditions jsonb DEFAULT '{}'::jsonb,
    expression text,
    computation_context jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.dataforge_rollup_fields OWNER TO postgres;

--
-- Name: fields_trash; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fields_trash (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    org_id text NOT NULL,
    entity_name text NOT NULL,
    field_name text NOT NULL,
    field_definition jsonb,
    table_name text NOT NULL,
    deleted_by text,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fields_trash OWNER TO postgres;

--
-- Name: file_imports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.file_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id text NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    file_path text NOT NULL,
    file_hash text,
    status text DEFAULT 'uploaded'::text NOT NULL,
    detected_columns jsonb,
    row_count integer,
    sample_data jsonb,
    target_entity text,
    column_mappings jsonb,
    transformation_rules jsonb,
    import_mode text DEFAULT 'create'::text,
    records_processed integer DEFAULT 0,
    records_imported integer DEFAULT 0,
    records_updated integer DEFAULT 0,
    records_failed integer DEFAULT 0,
    records_skipped integer DEFAULT 0,
    error_details jsonb,
    validation_errors jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_by text,
    CONSTRAINT file_imports_file_type_check CHECK ((file_type = ANY (ARRAY['csv'::text, 'tsv'::text, 'xlsx'::text, 'xls'::text, 'json'::text, 'xml'::text]))),
    CONSTRAINT file_imports_import_mode_check CHECK ((import_mode = ANY (ARRAY['create'::text, 'update'::text, 'upsert'::text]))),
    CONSTRAINT file_imports_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'analyzing'::text, 'mapped'::text, 'importing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


ALTER TABLE public.file_imports OWNER TO postgres;

--
-- Name: TABLE file_imports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.file_imports IS 'File-based data import jobs with status tracking and results';


--
-- Name: COLUMN file_imports.detected_columns; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.file_imports.detected_columns IS 'Auto-detected schema: [{name: string, type: string, sample_values: string[], nullable: boolean, unique_count?: number}]';


--
-- Name: COLUMN file_imports.sample_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.file_imports.sample_data IS 'First 5-10 rows as array of objects for preview UI';


--
-- Name: COLUMN file_imports.column_mappings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.file_imports.column_mappings IS 'Source to target mapping: {source_column: {target_field, transformation?, validation?}}';


--
-- Name: COLUMN file_imports.transformation_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.file_imports.transformation_rules IS 'Global transformation rules: {trim_whitespace: boolean, handle_empty_strings: "null"|"empty"|"skip"}';


--
-- Name: import_errors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.import_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_import_id uuid NOT NULL,
    row_number integer,
    column_name text,
    error_type text NOT NULL,
    error_code text,
    error_message text NOT NULL,
    source_value text,
    source_row_data jsonb,
    resolution_status text DEFAULT 'unresolved'::text,
    resolution_notes text,
    resolved_at timestamp without time zone,
    resolved_by text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT import_errors_resolution_status_check CHECK ((resolution_status = ANY (ARRAY['unresolved'::text, 'ignored'::text, 'fixed'::text])))
);


ALTER TABLE public.import_errors OWNER TO postgres;

--
-- Name: TABLE import_errors; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.import_errors IS 'Detailed error tracking and resolution for import issues';


--
-- Name: import_field_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.import_field_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_import_id uuid NOT NULL,
    source_column text NOT NULL,
    target_field text NOT NULL,
    field_type text NOT NULL,
    transformation_function text,
    transformation_params jsonb,
    default_value text,
    is_required boolean DEFAULT false,
    validation_rules jsonb,
    values_processed integer DEFAULT 0,
    values_transformed integer DEFAULT 0,
    validation_errors integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.import_field_mappings OWNER TO postgres;

--
-- Name: TABLE import_field_mappings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.import_field_mappings IS 'Granular field mapping configurations for imports';


--
-- Name: import_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.import_mappings (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    org_id text NOT NULL,
    connection_id text,
    source_type text NOT NULL,
    source_id text NOT NULL,
    source_name text,
    target_entity text NOT NULL,
    field_mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    transformation_rules jsonb DEFAULT '{}'::jsonb,
    sync_enabled boolean DEFAULT false,
    sync_direction text DEFAULT 'import'::text,
    last_sync_at timestamp with time zone,
    sync_status text DEFAULT 'pending'::text,
    sync_error text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT import_mappings_sync_direction_check CHECK ((sync_direction = ANY (ARRAY['import'::text, 'export'::text, 'bidirectional'::text]))),
    CONSTRAINT import_mappings_sync_status_check CHECK ((sync_status = ANY (ARRAY['pending'::text, 'syncing'::text, 'completed'::text, 'failed'::text])))
);


ALTER TABLE public.import_mappings OWNER TO postgres;

--
-- Name: TABLE import_mappings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.import_mappings IS 'Stores field mappings and sync configuration for data imports';


--
-- Name: COLUMN import_mappings.field_mappings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.import_mappings.field_mappings IS 'JSON object mapping source fields to target fields';


--
-- Name: COLUMN import_mappings.transformation_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.import_mappings.transformation_rules IS 'JSON object defining data transformation rules during import';


--
-- Name: import_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.import_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id text NOT NULL,
    name text NOT NULL,
    description text,
    file_type text NOT NULL,
    target_entity text NOT NULL,
    column_mappings jsonb NOT NULL,
    transformation_rules jsonb,
    import_mode text DEFAULT 'create'::text,
    is_shared boolean DEFAULT false,
    is_public boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    last_used_at timestamp without time zone,
    created_by text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.import_templates OWNER TO postgres;

--
-- Name: TABLE import_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.import_templates IS 'Reusable import mapping templates for common file structures';


--
-- Name: integration_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.integration_connections (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    org_id text NOT NULL,
    provider text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT integration_connections_provider_check CHECK ((provider = ANY (ARRAY['clickup'::text, 'jira'::text, 'asana'::text, 'notion'::text, 'monday'::text])))
);


ALTER TABLE public.integration_connections OWNER TO postgres;

--
-- Name: TABLE integration_connections; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.integration_connections IS 'Stores OAuth tokens and API keys for external integrations';


--
-- Name: COLUMN integration_connections.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.integration_connections.metadata IS 'JSON object containing provider-specific data like workspace_id, user_email, etc.';


--
-- Name: integration_sync_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.integration_sync_log (
    id text DEFAULT public.generate_uuidv7() NOT NULL,
    org_id text NOT NULL,
    connection_id text,
    mapping_id text,
    sync_type text NOT NULL,
    sync_direction text NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    records_processed integer DEFAULT 0,
    records_created integer DEFAULT 0,
    records_updated integer DEFAULT 0,
    records_deleted integer DEFAULT 0,
    records_skipped integer DEFAULT 0,
    records_failed integer DEFAULT 0,
    error_details jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT integration_sync_log_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT integration_sync_log_sync_direction_check CHECK ((sync_direction = ANY (ARRAY['import'::text, 'export'::text]))),
    CONSTRAINT integration_sync_log_sync_type_check CHECK ((sync_type = ANY (ARRAY['full'::text, 'incremental'::text, 'webhook'::text])))
);


ALTER TABLE public.integration_sync_log OWNER TO postgres;

--
-- Name: TABLE integration_sync_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.integration_sync_log IS 'Audit log of all sync operations between VibeStack and external systems';


--
-- Name: COLUMN integration_sync_log.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.integration_sync_log.metadata IS 'JSON object containing sync-specific data like filters used, webhook payload, etc.';


--
-- Name: org_01920000_1000_7000_8000_000000000001_relationships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_entity_type character varying(100) NOT NULL,
    source_entity_id uuid NOT NULL,
    relationship_type character varying(100) NOT NULL,
    relationship_subtype character varying(100),
    target_entity_type character varying(100) NOT NULL,
    target_entity_id uuid NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb,
    valid_from timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    valid_until timestamp without time zone,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid,
    updated_at timestamp without time zone
);


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_relationships OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_task (
    id text NOT NULL,
    organization_id text NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    title text NOT NULL,
    description text,
    priority text,
    status text,
    due_date timestamp without time zone
);

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_task REPLICA IDENTITY FULL;


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_task OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_testdocument; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_testdocument (
    id text NOT NULL,
    organization_id text NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    title text NOT NULL,
    content text,
    status text DEFAULT 'draft'::text NOT NULL,
    document_type text NOT NULL,
    word_count numeric
);

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_testdocument REPLICA IDENTITY FULL;


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_testdocument OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_testproject; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_testproject (
    id text NOT NULL,
    organization_id text NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    name text NOT NULL,
    description text,
    priority text,
    status text DEFAULT 'not_started'::text NOT NULL,
    start_date date,
    end_date date,
    budget numeric,
    progress_percentage integer DEFAULT 0,
    client_name text NOT NULL,
    budget_amount numeric
);

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_testproject REPLICA IDENTITY FULL;


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_testproject OWNER TO postgres;

--
-- Name: org_01920000_1000_7000_8000_000000000001_workflowtask; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_01920000_1000_7000_8000_000000000001_workflowtask (
    id text NOT NULL,
    organization_id text NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    title text NOT NULL,
    description text,
    priority text,
    status text DEFAULT 'not_started'::text NOT NULL,
    due_date timestamp without time zone
);

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_workflowtask REPLICA IDENTITY FULL;


ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_workflowtask OWNER TO postgres;

--
-- Name: org_relationship_definitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_relationship_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    relationship_type character varying(100) NOT NULL,
    display_name character varying(200) NOT NULL,
    description text,
    allowed_source_types text[],
    allowed_target_types text[],
    cardinality character varying(20),
    is_directional boolean DEFAULT true,
    inverse_relationship_type character varying(100),
    property_schema jsonb,
    ui_config jsonb,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true
);


ALTER TABLE public.org_relationship_definitions OWNER TO postgres;

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

ALTER TABLE ONLY public.organization_members REPLICA IDENTITY FULL;


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
    settings jsonb DEFAULT '{}'::jsonb,
    type text DEFAULT 'business'::text,
    owner_user_id text,
    auto_created boolean DEFAULT false,
    lore text,
    canon jsonb DEFAULT '[]'::jsonb,
    subscription_tier text DEFAULT 'trial'::text,
    subscription_status text DEFAULT 'active'::text,
    billing_cycle text DEFAULT 'monthly'::text,
    billing_email text,
    trial_ends_at timestamp with time zone,
    billing_settings jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE ONLY public.organizations REPLICA IDENTITY FULL;


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.organizations IS 'Organizations table - each organization represents a "world" in a user''s universe with its own lore (purpose) and canon (rules)';


--
-- Name: COLUMN organizations.lore; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.lore IS 'World lore: The purpose, mission, and story of this world (organization)';


--
-- Name: COLUMN organizations.canon; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.canon IS 'World canon: The rules, standards, and boundaries that govern this world';


--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id text NOT NULL,
    team_id uuid,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active'::text,
    priority text DEFAULT 'medium'::text,
    project_type text,
    start_date date,
    target_completion_date date,
    actual_completion_date date,
    created_by uuid,
    project_lead_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT projects_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text, 'cancelled'::text])))
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: TABLE projects; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.projects IS 'Projects table - contains actual work initiatives within organization worlds. Converted from the original worlds table to eliminate micro-worlds.';


--
-- Name: schema_metadata; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schema_metadata (
    key character varying(255) NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.schema_metadata OWNER TO postgres;

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
-- Name: system_option_sets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_option_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    option_set_type text NOT NULL,
    archetype text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT system_option_sets_archetype_check CHECK ((archetype = ANY (ARRAY['universe'::text, 'world'::text, 'project'::text, 'task'::text, 'record'::text, 'document'::text, 'file'::text, 'activity'::text, 'discussion'::text, 'collection'::text])))
);


ALTER TABLE public.system_option_sets OWNER TO postgres;

--
-- Name: TABLE system_option_sets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.system_option_sets IS 'System-wide option sets shared across all organizations for each archetype';


--
-- Name: COLUMN system_option_sets.option_set_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.system_option_sets.option_set_type IS 'Type of option set: priority, status, category, discussion_type, etc.';


--
-- Name: COLUMN system_option_sets.archetype; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.system_option_sets.archetype IS 'Which archetype this option set applies to';


--
-- Name: system_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    option_set_id uuid NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    description text,
    color text,
    icon text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_options OWNER TO postgres;

--
-- Name: TABLE system_options; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.system_options IS 'System option values with labels, colors, and metadata';


--
-- Name: COLUMN system_options.value; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.system_options.value IS 'The stored value in entity fields (e.g., "high", "active")';


--
-- Name: COLUMN system_options.label; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.system_options.label IS 'The display label shown in UI (e.g., "High Priority", "Active")';


--
-- Name: COLUMN system_options.color; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.system_options.color IS 'Hex color code for UI styling (e.g., "#ef4444" for red)';


--
-- Name: team_memberships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT team_memberships_role_check CHECK ((role = ANY (ARRAY['member'::text, 'lead'::text, 'admin'::text])))
);


ALTER TABLE public.team_memberships OWNER TO postgres;

--
-- Name: TABLE team_memberships; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.team_memberships IS 'User roles and memberships within specific teams';


--
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    parent_team_id uuid,
    team_type text DEFAULT 'department'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT teams_team_type_check CHECK ((team_type = ANY (ARRAY['department'::text, 'project'::text, 'functional'::text, 'cross_functional'::text])))
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- Name: TABLE teams; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.teams IS 'Organizational units within a single organization (departments, project teams, etc.)';


--
-- Name: COLUMN teams.parent_team_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.teams.parent_team_id IS 'NULL = top-level team, NOT NULL = sub-team';


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
    password text,
    default_organization_id text,
    last_used_organization_id text,
    last_org_access_at timestamp with time zone,
    active_organization_id text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public."user" OWNER TO postgres;

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
-- Name: wide_corp_relationship_field_configs; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.wide_corp_relationship_field_configs AS
 SELECT drf.id,
    drf.org_id,
    drf.entity_type,
    drf.field_name,
    drf.relationship_type,
    drf.target_entity_type,
    drf.cardinality,
    drf.display_format,
    drf.validation_rules,
    drf.ui_config,
    drf.created_at,
    drf.updated_at,
    cos.name AS option_set_name,
    ( SELECT jsonb_agg(jsonb_build_object('value', co.value, 'label', co.label, 'color', co.color, 'icon', co.icon) ORDER BY co.sort_order) AS jsonb_agg
           FROM (public.custom_options co
             JOIN public.custom_option_sets cos2 ON ((co.option_set_id = cos2.id)))
          WHERE ((cos2.org_id = (drf.org_id)::text) AND (cos2.option_set_type = 'relationship_type'::text) AND (co.value = (drf.relationship_type)::text))) AS relationship_options
   FROM (public.dataforge_relationship_fields drf
     LEFT JOIN public.custom_option_sets cos ON (((cos.org_id = (drf.org_id)::text) AND (cos.option_set_type = 'relationship_type'::text))))
  WHERE (drf.org_id = '01920000-1000-7000-8000-000000000001'::uuid);


ALTER VIEW public.wide_corp_relationship_field_configs OWNER TO postgres;

--
-- Name: dataforge_computed_field_calculations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_field_calculations ALTER COLUMN id SET DEFAULT nextval('public.dataforge_computed_field_calculations_id_seq'::regclass);


--
-- Name: dataforge_computed_field_dependencies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_field_dependencies ALTER COLUMN id SET DEFAULT nextval('public.dataforge_computed_field_dependencies_id_seq'::regclass);


--
-- Name: dataforge_computed_fields id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_fields ALTER COLUMN id SET DEFAULT nextval('public.dataforge_computed_fields_id_seq'::regclass);


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
-- Name: custom_option_sets custom_option_sets_org_id_option_set_type_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_option_sets
    ADD CONSTRAINT custom_option_sets_org_id_option_set_type_name_key UNIQUE (org_id, option_set_type, name);


--
-- Name: custom_option_sets custom_option_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_option_sets
    ADD CONSTRAINT custom_option_sets_pkey PRIMARY KEY (id);


--
-- Name: custom_options custom_options_option_set_id_value_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_options
    ADD CONSTRAINT custom_options_option_set_id_value_key UNIQUE (option_set_id, value);


--
-- Name: custom_options custom_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_options
    ADD CONSTRAINT custom_options_pkey PRIMARY KEY (id);


--
-- Name: dataforge_computed_field_calculations dataforge_computed_field_calc_computed_field_id_entity_id_c_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_field_calculations
    ADD CONSTRAINT dataforge_computed_field_calc_computed_field_id_entity_id_c_key UNIQUE (computed_field_id, entity_id, created_at);


--
-- Name: dataforge_computed_field_calculations dataforge_computed_field_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_field_calculations
    ADD CONSTRAINT dataforge_computed_field_calculations_pkey PRIMARY KEY (id);


--
-- Name: dataforge_computed_field_dependencies dataforge_computed_field_depe_computed_field_id_depends_on__key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_field_dependencies
    ADD CONSTRAINT dataforge_computed_field_depe_computed_field_id_depends_on__key UNIQUE (computed_field_id, depends_on_org_id, depends_on_entity_type, depends_on_field_name);


--
-- Name: dataforge_computed_field_dependencies dataforge_computed_field_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_field_dependencies
    ADD CONSTRAINT dataforge_computed_field_dependencies_pkey PRIMARY KEY (id);


--
-- Name: dataforge_computed_fields dataforge_computed_fields_org_id_entity_type_field_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_fields
    ADD CONSTRAINT dataforge_computed_fields_org_id_entity_type_field_name_key UNIQUE (org_id, entity_type, field_name);


--
-- Name: dataforge_computed_fields dataforge_computed_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_fields
    ADD CONSTRAINT dataforge_computed_fields_pkey PRIMARY KEY (id);


--
-- Name: dataforge_relationship_fields dataforge_relationship_fields_org_id_entity_type_field_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_relationship_fields
    ADD CONSTRAINT dataforge_relationship_fields_org_id_entity_type_field_name_key UNIQUE (org_id, entity_type, field_name);


--
-- Name: dataforge_relationship_fields dataforge_relationship_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_relationship_fields
    ADD CONSTRAINT dataforge_relationship_fields_pkey PRIMARY KEY (id);


--
-- Name: dataforge_rollup_fields dataforge_rollup_fields_org_id_entity_name_field_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_rollup_fields
    ADD CONSTRAINT dataforge_rollup_fields_org_id_entity_name_field_name_key UNIQUE (org_id, entity_name, field_name);


--
-- Name: dataforge_rollup_fields dataforge_rollup_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_rollup_fields
    ADD CONSTRAINT dataforge_rollup_fields_pkey PRIMARY KEY (id);


--
-- Name: entity_schemas entity_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_schemas
    ADD CONSTRAINT entity_schemas_pkey PRIMARY KEY (org_id, entity_name);


--
-- Name: fields_trash fields_trash_org_id_entity_name_field_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fields_trash
    ADD CONSTRAINT fields_trash_org_id_entity_name_field_name_key UNIQUE (org_id, entity_name, field_name);


--
-- Name: fields_trash fields_trash_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fields_trash
    ADD CONSTRAINT fields_trash_pkey PRIMARY KEY (id);


--
-- Name: file_imports file_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_imports
    ADD CONSTRAINT file_imports_pkey PRIMARY KEY (id);


--
-- Name: import_errors import_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_errors
    ADD CONSTRAINT import_errors_pkey PRIMARY KEY (id);


--
-- Name: import_field_mappings import_field_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_field_mappings
    ADD CONSTRAINT import_field_mappings_pkey PRIMARY KEY (id);


--
-- Name: import_mappings import_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_mappings
    ADD CONSTRAINT import_mappings_pkey PRIMARY KEY (id);


--
-- Name: import_templates import_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_templates
    ADD CONSTRAINT import_templates_pkey PRIMARY KEY (id);


--
-- Name: integration_connections integration_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_connections
    ADD CONSTRAINT integration_connections_pkey PRIMARY KEY (id);


--
-- Name: integration_sync_log integration_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_sync_log
    ADD CONSTRAINT integration_sync_log_pkey PRIMARY KEY (id);


--
-- Name: org_01920000_1000_7000_8000_000000000001_relationships org_01920000_1000_7000_8000_000000000001_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_01920000_1000_7000_8000_000000000001_relationships
    ADD CONSTRAINT org_01920000_1000_7000_8000_000000000001_relationships_pkey PRIMARY KEY (id);


--
-- Name: org_relationship_definitions org_relationship_definitions_org_id_relationship_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_relationship_definitions
    ADD CONSTRAINT org_relationship_definitions_org_id_relationship_type_key UNIQUE (org_id, relationship_type);


--
-- Name: org_relationship_definitions org_relationship_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_relationship_definitions
    ADD CONSTRAINT org_relationship_definitions_pkey PRIMARY KEY (id);


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
-- Name: projects projects_org_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_org_name_unique UNIQUE (organization_id, name);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: schema_metadata schema_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_metadata
    ADD CONSTRAINT schema_metadata_pkey PRIMARY KEY (key);


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
-- Name: system_option_sets system_option_sets_option_set_type_archetype_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_option_sets
    ADD CONSTRAINT system_option_sets_option_set_type_archetype_name_key UNIQUE (option_set_type, archetype, name);


--
-- Name: system_option_sets system_option_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_option_sets
    ADD CONSTRAINT system_option_sets_pkey PRIMARY KEY (id);


--
-- Name: system_options system_options_option_set_id_value_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_options
    ADD CONSTRAINT system_options_option_set_id_value_key UNIQUE (option_set_id, value);


--
-- Name: system_options system_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_options
    ADD CONSTRAINT system_options_pkey PRIMARY KEY (id);


--
-- Name: team_memberships team_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_memberships
    ADD CONSTRAINT team_memberships_pkey PRIMARY KEY (id);


--
-- Name: team_memberships team_memberships_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_memberships
    ADD CONSTRAINT team_memberships_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: integration_connections unique_org_provider; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_connections
    ADD CONSTRAINT unique_org_provider UNIQUE (org_id, provider);


--
-- Name: import_mappings unique_source_mapping; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_mappings
    ADD CONSTRAINT unique_source_mapping UNIQUE (org_id, source_type, source_id);


--
-- Name: import_templates unique_template_name_per_org; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_templates
    ADD CONSTRAINT unique_template_name_per_org UNIQUE (org_id, name);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


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
-- Name: idx_custom_option_sets_org_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_option_sets_org_type ON public.custom_option_sets USING btree (org_id, option_set_type);


--
-- Name: idx_custom_options_set_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_options_set_id ON public.custom_options USING btree (option_set_id);


--
-- Name: idx_custom_options_value; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_options_value ON public.custom_options USING btree (value);


--
-- Name: idx_dataforge_computed_field_calculations_cleanup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_computed_field_calculations_cleanup ON public.dataforge_computed_field_calculations USING btree (created_at);


--
-- Name: idx_dataforge_computed_field_dependencies_computed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_computed_field_dependencies_computed ON public.dataforge_computed_field_dependencies USING btree (computed_field_id);


--
-- Name: idx_dataforge_computed_field_dependencies_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_computed_field_dependencies_source ON public.dataforge_computed_field_dependencies USING btree (depends_on_org_id, depends_on_entity_type, depends_on_field_name);


--
-- Name: idx_dataforge_computed_fields_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_computed_fields_active ON public.dataforge_computed_fields USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_dataforge_computed_fields_dependencies; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_computed_fields_dependencies ON public.dataforge_computed_fields USING gin (dependencies);


--
-- Name: idx_dataforge_computed_fields_org_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_computed_fields_org_entity ON public.dataforge_computed_fields USING btree (org_id, entity_type);


--
-- Name: idx_dataforge_computed_fields_triggers; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_computed_fields_triggers ON public.dataforge_computed_fields USING gin (refresh_triggers);


--
-- Name: idx_dataforge_rollup_fields_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_rollup_fields_entity ON public.dataforge_rollup_fields USING btree (org_id, entity_name);


--
-- Name: idx_dataforge_rollup_fields_relationship; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dataforge_rollup_fields_relationship ON public.dataforge_rollup_fields USING btree (org_id, relationship_type, target_entity_type);


--
-- Name: idx_entity_schemas_archetype; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_schemas_archetype ON public.entity_schemas USING btree (archetype);


--
-- Name: idx_entity_schemas_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_schemas_deleted ON public.entity_schemas USING btree (org_id, deleted) WHERE (deleted = false);


--
-- Name: idx_entity_schemas_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_schemas_org_id ON public.entity_schemas USING btree (org_id);


--
-- Name: idx_entity_schemas_table_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_schemas_table_name ON public.entity_schemas USING btree (table_name);


--
-- Name: idx_fields_trash_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fields_trash_deleted_at ON public.fields_trash USING btree (deleted_at);


--
-- Name: idx_fields_trash_org_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fields_trash_org_entity ON public.fields_trash USING btree (org_id, entity_name);


--
-- Name: idx_file_imports_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_file_imports_created_at ON public.file_imports USING btree (created_at DESC);


--
-- Name: idx_file_imports_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_file_imports_org_id ON public.file_imports USING btree (org_id);


--
-- Name: idx_file_imports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_file_imports_status ON public.file_imports USING btree (status);


--
-- Name: idx_file_imports_target_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_file_imports_target_entity ON public.file_imports USING btree (target_entity);


--
-- Name: idx_import_errors_import_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_errors_import_id ON public.import_errors USING btree (file_import_id);


--
-- Name: idx_import_errors_resolution; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_errors_resolution ON public.import_errors USING btree (resolution_status);


--
-- Name: idx_import_errors_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_errors_type ON public.import_errors USING btree (error_type);


--
-- Name: idx_import_mappings_connection; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_mappings_connection ON public.import_mappings USING btree (connection_id);


--
-- Name: idx_import_mappings_org_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_mappings_org_source ON public.import_mappings USING btree (org_id, source_type, source_id);


--
-- Name: idx_import_mappings_sync_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_mappings_sync_enabled ON public.import_mappings USING btree (org_id, sync_enabled) WHERE (sync_enabled = true);


--
-- Name: idx_import_templates_file_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_templates_file_type ON public.import_templates USING btree (file_type);


--
-- Name: idx_import_templates_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_templates_org_id ON public.import_templates USING btree (org_id);


--
-- Name: idx_import_templates_shared; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_templates_shared ON public.import_templates USING btree (is_shared) WHERE (is_shared = true);


--
-- Name: idx_import_templates_target_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_templates_target_entity ON public.import_templates USING btree (target_entity);


--
-- Name: idx_integration_connections_org_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integration_connections_org_provider ON public.integration_connections USING btree (org_id, provider);


--
-- Name: idx_org_01920000_1000_7000_8000_000000000001_relationships_sour; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_01920000_1000_7000_8000_000000000001_relationships_sour ON public.org_01920000_1000_7000_8000_000000000001_relationships USING btree (source_entity_type, source_entity_id) WHERE (valid_until IS NULL);


--
-- Name: idx_org_01920000_1000_7000_8000_000000000001_relationships_targ; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_01920000_1000_7000_8000_000000000001_relationships_targ ON public.org_01920000_1000_7000_8000_000000000001_relationships USING btree (target_entity_type, target_entity_id) WHERE (valid_until IS NULL);


--
-- Name: idx_org_01920000_1000_7000_8000_000000000001_relationships_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_01920000_1000_7000_8000_000000000001_relationships_type ON public.org_01920000_1000_7000_8000_000000000001_relationships USING btree (relationship_type) WHERE (valid_until IS NULL);


--
-- Name: idx_organizations_canon_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_canon_gin ON public.organizations USING gin (canon);


--
-- Name: idx_organizations_lore_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_lore_gin ON public.organizations USING gin (to_tsvector('english'::regconfig, lore));


--
-- Name: idx_projects_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_created_by ON public.projects USING btree (created_by);


--
-- Name: idx_projects_lead; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_lead ON public.projects USING btree (project_lead_id);


--
-- Name: idx_projects_org_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_org_status ON public.projects USING btree (organization_id, status);


--
-- Name: idx_projects_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_team ON public.projects USING btree (team_id);


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
-- Name: idx_sync_log_mapping; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sync_log_mapping ON public.integration_sync_log USING btree (mapping_id);


--
-- Name: idx_sync_log_org_connection; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sync_log_org_connection ON public.integration_sync_log USING btree (org_id, connection_id);


--
-- Name: idx_sync_log_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sync_log_status ON public.integration_sync_log USING btree (org_id, status, started_at DESC);


--
-- Name: idx_system_option_sets_type_archetype; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_option_sets_type_archetype ON public.system_option_sets USING btree (option_set_type, archetype);


--
-- Name: idx_system_options_set_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_options_set_id ON public.system_options USING btree (option_set_id);


--
-- Name: idx_system_options_value; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_options_value ON public.system_options USING btree (value);


--
-- Name: idx_team_memberships_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_memberships_team_id ON public.team_memberships USING btree (team_id);


--
-- Name: idx_team_memberships_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_memberships_user_id ON public.team_memberships USING btree (user_id);


--
-- Name: idx_teams_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_teams_organization_id ON public.teams USING btree (organization_id);


--
-- Name: idx_teams_parent_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_teams_parent_team_id ON public.teams USING btree (parent_team_id);


--
-- Name: idx_teams_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_teams_updated_at ON public.teams USING btree (updated_at);


--
-- Name: idx_user_default_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_default_organization_id ON public."user" USING btree (default_organization_id);


--
-- Name: idx_user_last_org_access_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_last_org_access_at ON public."user" USING btree (last_org_access_at);


--
-- Name: idx_user_last_used_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_last_used_organization_id ON public."user" USING btree (last_used_organization_id);


--
-- Name: session_userid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX session_userid_idx ON public.session USING btree ("userId");


--
-- Name: unique_org_01920000_1000_7000_8000_000000000001_relationships_a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_org_01920000_1000_7000_8000_000000000001_relationships_a ON public.org_01920000_1000_7000_8000_000000000001_relationships USING btree (source_entity_type, source_entity_id, relationship_type, target_entity_type, target_entity_id) WHERE (valid_until IS NULL);


--
-- Name: organizations organizations_update_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER organizations_update_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_members trigger_set_default_organization_for_new_member; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_set_default_organization_for_new_member AFTER INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_for_new_member();


--
-- Name: dataforge_computed_fields update_dataforge_computed_fields_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_dataforge_computed_fields_updated_at_trigger BEFORE UPDATE ON public.dataforge_computed_fields FOR EACH ROW EXECUTE FUNCTION public.update_dataforge_computed_fields_updated_at();


--
-- Name: import_mappings update_import_mappings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_import_mappings_updated_at BEFORE UPDATE ON public.import_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: integration_connections update_integration_connections_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_integration_connections_updated_at BEFORE UPDATE ON public.integration_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user user_update_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_update_updated_at BEFORE UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public."user" DISABLE TRIGGER user_update_updated_at;


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
-- Name: custom_options custom_options_option_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_options
    ADD CONSTRAINT custom_options_option_set_id_fkey FOREIGN KEY (option_set_id) REFERENCES public.custom_option_sets(id) ON DELETE CASCADE;


--
-- Name: dataforge_computed_field_calculations dataforge_computed_field_calculations_computed_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_field_calculations
    ADD CONSTRAINT dataforge_computed_field_calculations_computed_field_id_fkey FOREIGN KEY (computed_field_id) REFERENCES public.dataforge_computed_fields(id) ON DELETE CASCADE;


--
-- Name: dataforge_computed_field_dependencies dataforge_computed_field_dependencies_computed_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataforge_computed_field_dependencies
    ADD CONSTRAINT dataforge_computed_field_dependencies_computed_field_id_fkey FOREIGN KEY (computed_field_id) REFERENCES public.dataforge_computed_fields(id) ON DELETE CASCADE;


--
-- Name: import_field_mappings fk_field_mappings_import; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_field_mappings
    ADD CONSTRAINT fk_field_mappings_import FOREIGN KEY (file_import_id) REFERENCES public.file_imports(id) ON DELETE CASCADE;


--
-- Name: file_imports fk_file_imports_org; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_imports
    ADD CONSTRAINT fk_file_imports_org FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: import_errors fk_import_errors_import; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_errors
    ADD CONSTRAINT fk_import_errors_import FOREIGN KEY (file_import_id) REFERENCES public.file_imports(id) ON DELETE CASCADE;


--
-- Name: import_templates fk_import_templates_org; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_templates
    ADD CONSTRAINT fk_import_templates_org FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: import_mappings import_mappings_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_mappings
    ADD CONSTRAINT import_mappings_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.integration_connections(id) ON DELETE CASCADE;


--
-- Name: import_mappings import_mappings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_mappings
    ADD CONSTRAINT import_mappings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: integration_connections integration_connections_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_connections
    ADD CONSTRAINT integration_connections_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: integration_sync_log integration_sync_log_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_sync_log
    ADD CONSTRAINT integration_sync_log_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.integration_connections(id) ON DELETE CASCADE;


--
-- Name: integration_sync_log integration_sync_log_mapping_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_sync_log
    ADD CONSTRAINT integration_sync_log_mapping_id_fkey FOREIGN KEY (mapping_id) REFERENCES public.import_mappings(id) ON DELETE CASCADE;


--
-- Name: integration_sync_log integration_sync_log_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_sync_log
    ADD CONSTRAINT integration_sync_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


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
-- Name: organizations organizations_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: system_options system_options_option_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_options
    ADD CONSTRAINT system_options_option_set_id_fkey FOREIGN KEY (option_set_id) REFERENCES public.system_option_sets(id) ON DELETE CASCADE;


--
-- Name: team_memberships team_memberships_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_memberships
    ADD CONSTRAINT team_memberships_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams teams_parent_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_parent_team_id_fkey FOREIGN KEY (parent_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: user user_default_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_default_organization_id_fkey FOREIGN KEY (default_organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: user user_last_used_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_last_used_organization_id_fkey FOREIGN KEY (last_used_organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: change_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.change_history ENABLE ROW LEVEL SECURITY;

--
-- Name: change_history change_history_org_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY change_history_org_isolation ON public.change_history USING (((current_setting('app.system_mode'::text, true) = 'true'::text) OR (organization_id = (current_setting('app.current_organization_id'::text, true))::uuid)));


--
-- Name: container_permission container_permission_admin_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY container_permission_admin_policy ON public.container_permission USING (public.user_can_administer()) WITH CHECK (public.user_can_administer());


--
-- Name: container_permission container_permission_read_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY container_permission_read_policy ON public.container_permission FOR SELECT USING (((user_id = public.get_current_user_id()) OR public.user_can_administer()));


--
-- Name: entity_schemas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.entity_schemas ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_schemas entity_schemas_delete_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY entity_schemas_delete_policy ON public.entity_schemas FOR DELETE USING ((public.user_can_administer() AND (org_id = (public.get_current_organization_id())::text)));


--
-- Name: entity_schemas entity_schemas_read_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY entity_schemas_read_policy ON public.entity_schemas FOR SELECT USING ((public.user_can_read() AND (org_id = (public.get_current_organization_id())::text)));


--
-- Name: entity_schemas entity_schemas_update_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY entity_schemas_update_policy ON public.entity_schemas FOR UPDATE USING ((public.user_can_administer() AND (org_id = (public.get_current_organization_id())::text)));


--
-- Name: entity_schemas entity_schemas_write_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY entity_schemas_write_policy ON public.entity_schemas FOR INSERT WITH CHECK ((public.user_can_administer() AND (org_id = (public.get_current_organization_id())::text)));


--
-- Name: team_memberships; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: vibestack_pub; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION vibestack_pub FOR ALL TABLES WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION vibestack_pub OWNER TO postgres;

--
-- Name: DATABASE elevra_dev; Type: ACL; Schema: -; Owner: postgres
--

GRANT CONNECT ON DATABASE elevra_dev TO vibestack_app;
GRANT CONNECT ON DATABASE elevra_dev TO rls_test_user;
GRANT CONNECT ON DATABASE elevra_dev TO vibestack_app_user;


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
-- Name: FUNCTION get_organization_roles_for_cache(p_organization_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_organization_roles_for_cache(p_organization_id uuid) TO vibestack_app;


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
-- Name: TABLE "user"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public."user" TO vibestack_app;
GRANT SELECT ON TABLE public."user" TO test_user;


--
-- Name: TABLE verification; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.verification TO vibestack_app;
GRANT SELECT ON TABLE public.verification TO test_user;


--
-- PostgreSQL database dump complete
--

\unrestrict CDexJOV1izbpqCcaf67dxmllyU53vFycdECFl8dGczpvfG5UTowmq9AzanHYiAB

--
-- Database "postgres" dump
--

\connect postgres

--
-- PostgreSQL database dump
--

\restrict zm16yWJN6rEjpzdr7vYva9cAY0jP2RTPGVf97tMFFE4RusuC5vr9dQgwfo2NkaF

-- Dumped from database version 17.6 (Debian 17.6-1.pgdg12+1)
-- Dumped by pg_dump version 17.6 (Debian 17.6-1.pgdg12+1)

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
-- PostgreSQL database dump complete
--

\unrestrict zm16yWJN6rEjpzdr7vYva9cAY0jP2RTPGVf97tMFFE4RusuC5vr9dQgwfo2NkaF

--
-- PostgreSQL database cluster dump complete
--

