-- setup-encrypted-secrets.sql - Create encrypted secrets storage
-- This creates a secure table for storing API keys and secrets in the git-tracked database

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create secure configuration table
CREATE TABLE IF NOT EXISTS secure_config (
    key VARCHAR(255) PRIMARY KEY,
    encrypted_value BYTEA NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_secure_config_key ON secure_config(key);

-- Helper function to safely set encrypted values
CREATE OR REPLACE FUNCTION set_secure_config(
    config_key VARCHAR(255),
    config_value TEXT,
    master_password TEXT,
    config_description TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO secure_config (key, encrypted_value, description, updated_at)
    VALUES (config_key, pgp_sym_encrypt(config_value, master_password), config_description, NOW())
    ON CONFLICT (key) 
    DO UPDATE SET 
        encrypted_value = pgp_sym_encrypt(config_value, master_password),
        description = COALESCE(config_description, secure_config.description),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Helper function to safely get decrypted values
CREATE OR REPLACE FUNCTION get_secure_config(
    config_key VARCHAR(255),
    master_password TEXT
) RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

-- Helper function to list all config keys (without values)
CREATE OR REPLACE FUNCTION list_secure_config_keys() 
RETURNS TABLE(config_key VARCHAR(255), config_description TEXT, last_updated TIMESTAMP) AS $$
BEGIN
    RETURN QUERY 
    SELECT key, description, updated_at
    FROM secure_config 
    ORDER BY updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Example: Insert some default encrypted secrets (replace with real values)
-- These will be encrypted with the master password the user provides

COMMENT ON TABLE secure_config IS 'Encrypted storage for API keys and secrets. Values are encrypted with master password.';
COMMENT ON FUNCTION set_secure_config IS 'Safely store encrypted configuration value';
COMMENT ON FUNCTION get_secure_config IS 'Safely retrieve and decrypt configuration value';
COMMENT ON FUNCTION list_secure_config_keys IS 'List all configuration keys without exposing values';