-- Fast insert with correct column names
INSERT INTO org_01920000_1000_7000_8000_000000000001_clients (
    organization_id, name, email, phone, record_type, status, company_name, contact_person, industry, description
)
SELECT 
    '01920000-1000-7000-8000-000000000001',
    'FastCorp ' || i::text,
    'contact' || i::text || '@fastcorp.com',
    '+1-555-' || (1000 + i)::text,
    CASE (i % 4) 
        WHEN 0 THEN 'client' 
        WHEN 1 THEN 'customer' 
        WHEN 2 THEN 'prospect' 
        ELSE 'lead' 
    END,
    CASE (i % 3) 
        WHEN 0 THEN 'active' 
        WHEN 1 THEN 'inactive' 
        ELSE 'pending' 
    END,
    'FastCorp Company ' || i::text,
    'Contact Person ' || i::text,
    CASE (i % 5)
        WHEN 0 THEN 'Technology'
        WHEN 1 THEN 'Finance'
        WHEN 2 THEN 'Healthcare'
        WHEN 3 THEN 'Manufacturing'
        ELSE 'Services'
    END,
    'Bulk inserted record ' || i::text || ' for performance testing'
FROM generate_series(10000, 12999) AS i;

SELECT COUNT(*) as total_records FROM org_01920000_1000_7000_8000_000000000001_clients;