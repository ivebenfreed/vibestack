-- Migration: Update client entity schema - simplified approach
-- Add priority field and update status field for client entity

-- First, let's add the priority field to the fields array
UPDATE entity_schemas 
SET business_metadata = jsonb_set(
    business_metadata,
    '{fields}',
    (business_metadata->'fields') || '[{
        "name": "priority", 
        "type": "select", 
        "cellType": "select", 
        "required": false, 
        "syncable": true, 
        "serverOnly": false, 
        "defaultValue": "medium", 
        "enumOptions": [
            {"value": "low", "label": "Low", "color": "#10B981"}, 
            {"value": "medium", "label": "Medium", "color": "#F59E0B"}, 
            {"value": "high", "label": "High", "color": "#F97316"}, 
            {"value": "critical", "label": "Critical", "color": "#EF4444"}
        ]
    }]'::jsonb
),
updated_at = now()
WHERE entity_name = 'Client' 
AND org_id = '01920000-1000-7000-8000-000000000001';

-- Update the status field to have proper enum options
UPDATE entity_schemas 
SET business_metadata = jsonb_set(
    business_metadata,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE 
                WHEN field->>'name' = 'status' THEN 
                    jsonb_build_object(
                        'name', 'status',
                        'type', 'select',
                        'cellType', 'select', 
                        'required', true,
                        'syncable', true,
                        'serverOnly', false,
                        'defaultValue', 'active',
                        'enumOptions', jsonb_build_array(
                            jsonb_build_object('value', 'active', 'label', 'Active', 'color', '#10B981'),
                            jsonb_build_object('value', 'inactive', 'label', 'Inactive', 'color', '#6B7280'),
                            jsonb_build_object('value', 'pending', 'label', 'Pending', 'color', '#F59E0B'),
                            jsonb_build_object('value', 'on_hold', 'label', 'On Hold', 'color', '#8B5CF6'),
                            jsonb_build_object('value', 'archived', 'label', 'Archived', 'color', '#6B7280'),
                            jsonb_build_object('value', 'deleted', 'label', 'Deleted', 'color', '#EF4444')
                        )
                    )
                ELSE field
            END
        )
        FROM jsonb_array_elements(business_metadata->'fields') AS field
    )
),
updated_at = now()
WHERE entity_name = 'Client' 
AND org_id = '01920000-1000-7000-8000-000000000001';