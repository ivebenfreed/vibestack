-- Script to add automatic updated_at triggers to all business entity tables
-- This ensures updated_at fields are automatically set on row updates

-- Create the function that updates the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to add updated_at trigger to a table
CREATE OR REPLACE FUNCTION add_updated_at_trigger(table_name TEXT)
RETURNS VOID AS $$
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
$$ language 'plpgsql';

-- Add triggers to Wide Corp organization tables
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_project');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_client');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_contract');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_document');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_expense');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_invoice');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_meeting');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_proposal');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_resource');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_skill');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_timesheet');
SELECT add_updated_at_trigger('org_01920000_1000_7000_8000_000000000001_certification');

-- Add triggers to Demo Corp organization tables
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_activity');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_attachment');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_comment');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_contact');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_custom_field_definitio');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_custom_field_value');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_deal');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_sync_configuration');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_tag');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_tagging');
SELECT add_updated_at_trigger('org_01920000_2000_7000_8000_000000000002_ticket');

-- Add triggers to system tables that have updated_at
SELECT add_updated_at_trigger('organizations');
SELECT add_updated_at_trigger('user');
SELECT add_updated_at_trigger('member');