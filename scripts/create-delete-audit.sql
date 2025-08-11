-- Create audit table for tracking ALL deletes
CREATE TABLE IF NOT EXISTS delete_audit_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    deleted_data JSONB,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_by TEXT DEFAULT current_user,
    application_name TEXT DEFAULT current_setting('application_name'),
    client_addr INET DEFAULT inet_client_addr(),
    query TEXT,
    stack_trace TEXT
);

-- Create trigger function that logs ALL deletes
CREATE OR REPLACE FUNCTION audit_delete_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO delete_audit_log (
        table_name,
        operation,
        deleted_data,
        query,
        stack_trace
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        row_to_json(OLD),
        current_query(),
        (SELECT string_agg(query, E'\n') 
         FROM pg_stat_activity 
         WHERE pid = pg_backend_pid())
    );
    
    -- Also raise a notice so we can see it in logs
    RAISE NOTICE 'DELETE DETECTED: Table=%, Data=%', TG_TABLE_NAME, row_to_json(OLD);
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to critical tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'accounts', 'sessions', 'tasks', 'projects', 'tags', 'comments')
    LOOP
        -- Drop existing trigger if exists
        EXECUTE format('DROP TRIGGER IF EXISTS audit_delete_%I ON %I', tbl, tbl);
        
        -- Create new trigger
        EXECUTE format('
            CREATE TRIGGER audit_delete_%I
            BEFORE DELETE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION audit_delete_trigger_func()',
            tbl, tbl
        );
        
        RAISE NOTICE 'Created delete audit trigger for table: %', tbl;
    END LOOP;
END $$;

-- Create a view to easily check recent deletes
CREATE OR REPLACE VIEW recent_deletes AS
SELECT 
    deleted_at,
    table_name,
    deleted_data->>'id' as deleted_id,
    deleted_data->>'email' as email,
    deleted_data->>'name' as name,
    deleted_by,
    application_name,
    client_addr,
    substring(query, 1, 100) as query_preview
FROM delete_audit_log
ORDER BY deleted_at DESC
LIMIT 100;

-- Grant permissions
GRANT ALL ON delete_audit_log TO postgres;
GRANT ALL ON delete_audit_log_id_seq TO postgres;

RAISE NOTICE 'Delete audit system installed successfully!';