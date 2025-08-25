-- Migration: Add priority and status options for record archetype
-- This will provide dropdown options for all entities using the 'record' archetype, including clients

-- Get the option set IDs
DO $$
DECLARE
    priority_set_id uuid;
    status_set_id uuid;
BEGIN
    -- Get priority option set ID
    SELECT id INTO priority_set_id 
    FROM system_option_sets 
    WHERE archetype = 'record' AND option_set_type = 'priority';
    
    -- Get status option set ID  
    SELECT id INTO status_set_id 
    FROM system_option_sets 
    WHERE archetype = 'record' AND option_set_type = 'status';
    
    -- Insert priority options
    IF priority_set_id IS NOT NULL THEN
        INSERT INTO system_options (option_set_id, value, label, description, color, sort_order) VALUES
        (priority_set_id, 'low', 'Low', 'Low priority item', '#10B981', 10),
        (priority_set_id, 'medium', 'Medium', 'Medium priority item', '#F59E0B', 20),
        (priority_set_id, 'high', 'High', 'High priority item', '#F97316', 30),
        (priority_set_id, 'critical', 'Critical', 'Critical priority item', '#EF4444', 40);
    END IF;
    
    -- Insert status options
    IF status_set_id IS NOT NULL THEN
        INSERT INTO system_options (option_set_id, value, label, description, color, sort_order) VALUES
        (status_set_id, 'active', 'Active', 'Active and operational', '#10B981', 10),
        (status_set_id, 'inactive', 'Inactive', 'Currently inactive', '#6B7280', 20),
        (status_set_id, 'pending', 'Pending', 'Awaiting action or approval', '#F59E0B', 30),
        (status_set_id, 'on_hold', 'On Hold', 'Temporarily on hold', '#8B5CF6', 40),
        (status_set_id, 'archived', 'Archived', 'Archived for reference', '#6B7280', 50),
        (status_set_id, 'deleted', 'Deleted', 'Marked for deletion', '#EF4444', 60);
    END IF;
END $$;