-- PostgreSQL Event Trigger for Table Creation/Deletion
-- This captures DDL events and stores them in a log table

-- Create DDL event log table
CREATE TABLE IF NOT EXISTS ddl_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'ddl_command_start', 'ddl_command_end', 'table_rewrite'
  command_tag TEXT NOT NULL, -- 'CREATE TABLE', 'DROP TABLE', etc.
  object_type TEXT, -- 'table', 'index', etc.
  schema_name TEXT,
  object_name TEXT,
  object_identity TEXT,
  in_extension BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_data JSONB
);

-- Function to log DDL events
CREATE OR REPLACE FUNCTION log_ddl_event()
RETURNS event_trigger AS $$
DECLARE
  obj record;
BEGIN
  -- Only log table-related events
  IF tg_tag IN ('CREATE TABLE', 'DROP TABLE', 'ALTER TABLE') THEN
    -- Log the event
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    LOOP
      INSERT INTO ddl_events (
        event_type,
        command_tag,
        object_type,
        schema_name,
        object_name,
        object_identity,
        in_extension,
        event_data
      ) VALUES (
        tg_event,
        tg_tag,
        obj.object_type,
        obj.schema_name,
        obj.object_identity,
        obj.object_identity,
        obj.in_extension,
        jsonb_build_object(
          'classid', obj.classid,
          'objid', obj.objid,
          'objsubid', obj.objsubid
        )
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create event trigger for DDL command end
DROP EVENT TRIGGER IF EXISTS ddl_logger;
CREATE EVENT TRIGGER ddl_logger
  ON ddl_command_end
  EXECUTE FUNCTION log_ddl_event();

-- Create function to check for new org table events
CREATE OR REPLACE FUNCTION check_org_table_ddl_events(since_timestamp TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 minute')
RETURNS TABLE(
  event_id INTEGER,
  command_tag TEXT,
  table_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.command_tag,
    de.object_name,
    de.created_at
  FROM ddl_events de
  WHERE de.created_at > since_timestamp
    AND de.object_type = 'table'
    AND de.object_name LIKE 'org_%'
    AND de.command_tag IN ('CREATE TABLE', 'DROP TABLE')
  ORDER BY de.created_at DESC;
END;
$$ LANGUAGE plpgsql;