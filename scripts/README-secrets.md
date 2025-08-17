# Secure Secrets Management System

This system provides encrypted storage for API keys and sensitive configuration values using PostgreSQL's pgcrypto extension. All secrets are encrypted with a master password and stored in the git-tracked database.

## Quick Start

### 1. Initial Setup

Run the master password setup script to initialize the secure secrets system:

```bash
./scripts/setup-master-password.sh
```

This will:
- Initialize the PostgreSQL encryption schema
- Prompt you to create a master password
- Create initial placeholder secrets
- Save the master password to `.env.local`

### 2. Update Secret Values

Replace placeholder values with your real API keys:

```bash
# Update individual secrets
./scripts/update-secret.sh NEON_API_KEY your-actual-neon-key
./scripts/update-secret.sh GITHUB_TOKEN ghp_your-token-here
./scripts/update-secret.sh OPENAI_API_KEY sk-your-openai-key

# Or prompt for value securely
./scripts/update-secret.sh STRIPE_SECRET_KEY
```

### 3. List and Verify Secrets

```bash
# List all secret keys
./scripts/update-secret.sh --list

# Verify a secret value (for testing)
./scripts/update-secret.sh --get NEON_API_KEY
```

## Architecture

### Database Schema

The system uses PostgreSQL's `pgcrypto` extension to encrypt/decrypt values:

- **`secure_config` table**: Stores encrypted key-value pairs
- **`set_secure_config()`**: Function to safely store encrypted values
- **`get_secure_config()`**: Function to retrieve and decrypt values
- **`list_secure_config_keys()`**: Function to list available keys

### Master Password

The master password is:
- Used to encrypt/decrypt all secrets
- Stored in `.env.local` for development convenience
- Passed to containers via environment variables
- Never committed to git

### Container Integration

Containers automatically load encrypted secrets at startup:

1. Container starts with `VIBESTACK_MASTER_PASSWORD` environment variable
2. `load-secrets.sh` script runs to decrypt secrets from PostgreSQL
3. Decrypted secrets are exported as environment variables
4. Application can access secrets normally (e.g., `process.env.NEON_API_KEY`)

## Security Benefits

### ✅ What This Solves

- **Git Security**: No plaintext secrets in git history
- **Cross-Machine Setup**: Secrets travel with the database
- **Container Isolation**: Each worktree gets access to the same secrets
- **Zero-Setup Deployment**: New environments automatically have secrets
- **Audit Trail**: All secret updates are logged in PostgreSQL

### ⚠️ Security Considerations

- **Master Password**: Keep secure, don't share, rotate periodically
- **Local Storage**: `.env.local` contains master password (gitignored)
- **Container Access**: Containers need master password to decrypt
- **Database Access**: Anyone with database access can see encrypted data

## Scripts Reference

### Core Scripts

- **`setup-master-password.sh`**: Initialize or validate master password
- **`update-secret.sh`**: Manage individual encrypted secrets
- **`load-secrets.sh`**: Load and export secrets (used by containers)

### Usage Examples

```bash
# First-time setup
./scripts/setup-master-password.sh

# Add/update secrets
./scripts/update-secret.sh API_KEY "secret-value"
./scripts/update-secret.sh DATABASE_PASSWORD  # Will prompt securely

# List all secrets
./scripts/update-secret.sh --list

# Get decrypted value (for verification)
./scripts/update-secret.sh --get API_KEY

# Load secrets in different formats
./scripts/load-secrets.sh --env     # .env file format
./scripts/load-secrets.sh --source  # Shell export commands
```

## Worktree Integration

The secure secrets system is fully integrated with the worktree isolation system:

### Automatic Setup

When starting a worktree container:

```bash
./scripts/worktree-start.sh 42
```

The system automatically:
1. Validates/prompts for master password
2. Passes master password to container
3. Loads encrypted secrets from PostgreSQL
4. Exports secrets as environment variables

### Manual Secret Management

Within a worktree environment:

```bash
# Update secrets (affects all worktrees)
./scripts/update-secret.sh NEW_API_KEY "value"

# Restart container to load new secrets
docker restart vibestack-issue-42
```

## Production Deployment

### Environment Variables Required

```bash
# Master password for decrypting secrets
VIBESTACK_MASTER_PASSWORD=your-master-password

# Database connection (contains encrypted secrets)
DATABASE_URL=postgres://user:pass@host:port/db
```

### Docker Secrets (Recommended)

For production, use Docker secrets instead of environment variables:

```bash
# Create secret
echo "your-master-password" | docker secret create vibestack_master_password -

# Use in docker-compose.yml
services:
  app:
    secrets:
      - vibestack_master_password
    # load-secrets.sh automatically reads from /run/secrets/vibestack_master_password
```

## Troubleshooting

### Common Issues

1. **"Invalid master password"**
   - Run `./scripts/setup-master-password.sh` to reset
   - Check `.env.local` file exists and contains correct password

2. **"Secure config table not found"**
   - Run `./scripts/setup-master-password.sh` to initialize schema
   - Verify PostgreSQL has pgcrypto extension enabled

3. **Container can't load secrets**
   - Check `VIBESTACK_MASTER_PASSWORD` environment variable is set
   - Verify PostgreSQL is accessible from container
   - Check container logs for specific error messages

4. **Secrets not updating**
   - Restart container after updating secrets
   - Verify master password hasn't changed

### Manual Database Operations

```sql
-- List all encrypted keys
SELECT key, description, updated_at FROM secure_config ORDER BY key;

-- Manually decrypt a value (replace with your master password)
SELECT get_secure_config('API_KEY', 'your-master-password');

-- Add new encrypted secret
SELECT set_secure_config('NEW_KEY', 'secret-value', 'your-master-password', 'Description');
```

## Migration from Plaintext Secrets

If you have existing plaintext secrets:

1. **Backup current environment**: Save current `.env` files
2. **Run setup**: `./scripts/setup-master-password.sh`
3. **Migrate secrets**: Copy values using `./scripts/update-secret.sh`
4. **Update code**: Remove hardcoded secrets, use environment variables
5. **Test thoroughly**: Verify all services work with encrypted secrets
6. **Clean up**: Remove old `.env` files, update `.gitignore`

## Best Practices

### Security

- Rotate master password periodically
- Use strong, unique master password
- Don't log or print secret values
- Regularly audit secret usage
- Use least-privilege database access

### Development

- Keep placeholder values descriptive
- Document required secrets in README
- Use consistent naming conventions
- Test secret loading in development
- Validate secrets at application startup

### Operations

- Monitor secret access patterns
- Back up encrypted database regularly
- Have master password recovery plan
- Document secret rotation procedures
- Test disaster recovery scenarios