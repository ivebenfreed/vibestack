-- Direct SQL insert for maximum speed
-- Generate 7000 more records to reach 10k+ total

INSERT INTO org_01920000_1000_7000_8000_000000000001_clients (
    id, organization_id, name, email, phone, address, city, state, zip_code, country, website,
    record_type, status, notes, metadata, created_by, updated_by, created_at, updated_at, deleted_at
)
SELECT 
    gen_random_uuid(),
    '01920000-1000-7000-8000-000000000001',
    'SpeedCorp ' || i::text,
    'contact' || i::text || '@speedcorp.com',
    '+1-' || (random() * 900 + 100)::int::text || '-' || (random() * 900 + 100)::int::text || '-' || (random() * 9000 + 1000)::int::text,
    (random() * 9999 + 1)::int::text || ' Speed Street',
    'City' || (random() * 100 + 1)::int::text,
    'ST' || (random() * 50 + 1)::int::text,
    (random() * 90000 + 10000)::int::text,
    'USA',
    'https://www.speedcorp' || i::text || '.com',
    CASE (i % 4) 
        WHEN 0 THEN 'client'::text 
        WHEN 1 THEN 'customer'::text 
        WHEN 2 THEN 'prospect'::text 
        ELSE 'lead'::text 
    END,
    CASE (i % 3) 
        WHEN 0 THEN 'active'::text 
        WHEN 1 THEN 'inactive'::text 
        ELSE 'pending'::text 
    END,
    'SQL bulk insert record ' || i::text || ' - maximum performance',
    '{"test_data": true, "sql_bulk": true, "generated_at": "' || now()::text || '"}',
    'sql-bulk-script',
    'sql-bulk-script',
    now(),
    now(),
    null
FROM generate_series(5000, 11999) AS i;

-- Show final count
SELECT COUNT(*) as total_records FROM org_01920000_1000_7000_8000_000000000001_clients;