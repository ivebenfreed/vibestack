-- Bootstrap admin user for fresh system
-- This creates a user directly in the database bypassing auth

-- Create the user first
INSERT INTO users (
    id,
    email,
    name,
    email_verified,
    role,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'admin@vibestack.com',
    'Admin User',
    true,
    'super_admin',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING
RETURNING id, email, name, role;

-- Create the account entry (required for auth)
INSERT INTO accounts (
    id,
    user_id,
    account_id,
    provider_id,
    password,
    created_at,
    updated_at
) 
SELECT 
    gen_random_uuid(),
    u.id,
    u.id, -- For credential provider, account_id = user_id
    'credential',
    -- Password hash for 'Admin123!' using bcrypt
    -- This is a placeholder - we'll need to generate this properly
    '$2a$10$K5L.2NMg.pE5.y5.0J5.5eO5.5.5.5.5.5.5.5.5.5.5.5.5.5.5.5.',
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'admin@vibestack.com'
AND NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.user_id = u.id 
    AND a.provider_id = 'credential'
);

-- Create a session for immediate login (optional)
-- Sessions should really be created through the auth flow

SELECT 'Admin user created successfully!' as status;