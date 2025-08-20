# API Testing Authentication Guide

## Overview

This guide provides a clear approach to authenticate and obtain session tokens for testing backend APIs using curl commands. The authentication system uses Better Auth with cookie-based sessions.

## Authentication Endpoints

Base URL: `http://localhost:8787/api/auth`

### Key Endpoints
- **Sign In**: `POST /api/auth/sign-in`
- **Session Info**: `GET /api/auth/session`
- **Sign Out**: `POST /api/auth/sign-out`
- **Organization Session**: `GET /api/org-session/active-organization`

## Step-by-Step Authentication Flow

### 1. Sign In and Capture Session Cookie

```bash
# Sign in and save cookies to a file (CORRECT ENDPOINT: /sign-in/email)
curl -X POST "http://localhost:8787/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"ceo@widecorp.com\", \"password\": \"WideCorp2024!CEO\"}" \
  -c cookies.txt

# Expected response:
# {"redirect":false,"token":"...","user":{"id":"...","email":"ceo@widecorp.com","name":"Alice CEO",...}}
```

**What this does:**
- Authenticates the user
- Saves authentication cookies to `cookies.txt`
- Returns user information and session data

### 2. Verify Session

```bash
# Check current session using saved cookies
curl -X GET "http://localhost:8787/api/auth/session" \
  -b cookies.txt \
  -H "Content-Type: application/json"
```

### 3. Use Session for API Calls

```bash
# Example: Call any protected API endpoint
curl -X GET "http://localhost:8787/api/organizations" \
  -b cookies.txt \
  -H "Content-Type: application/json"
```

## Test User Credentials

### Wide Corp Solutions (Test Organization)
**Organization ID:** `01920000-1000-7000-8000-000000000001`

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| **Owner** | ceo@widecorp.com | WideCorp2024!CEO | Full org access (Alice CEO) |
| **Admin** | cto@widecorp.com | WideCorp2024!CTO | Tech admin (Bob CTO) |
| **Manager** | pm1@widecorp.com | WideCorp2024!PM1 | Project management (Carol PM) |
| **Member** | dev1@widecorp.com | WideCorp2024!DEV1 | Developer access (Eve Developer) |

## Complete Testing Script

### Auto-Login Script for Different Users

```bash
#!/bin/bash

# Function to login and test API access for a specific user
test_user_api() {
  local email=$1
  local password=$2
  local role=$3
  local cookie_file="cookies_${role,,}.txt"
  
  echo "=== Testing API Access for $role ($email) ==="
  
  # Step 1: Sign in
  echo "1. Signing in..."
  curl -s -X POST "http://localhost:8787/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"$password\"
    }" \
    -c "$cookie_file" | jq '.'
  
  # Step 2: Verify session
  echo "2. Verifying session..."
  curl -s -X GET "http://localhost:8787/api/auth/session" \
    -b "$cookie_file" | jq '.'
  
  # Step 3: Test protected API
  echo "3. Testing protected API..."
  curl -s -X GET "http://localhost:8787/api/organizations" \
    -b "$cookie_file" | jq '.'
  
  echo "Cookie file saved as: $cookie_file"
  echo "Use this file for subsequent API calls"
  echo ""
}

# Test different users
test_user_api "ceo@widecorp.com" "WideCorp2024!CEO" "CEO"
test_user_api "cto@widecorp.com" "WideCorp2024!CTO" "CTO" 
test_user_api "pm1@widecorp.com" "WideCorp2024!PM1" "Manager"
test_user_api "dev1@widecorp.com" "WideCorp2024!DEV1" "Developer"
```

### Save and Run the Script

```bash
# Save the script
chmod +x test-api-auth.sh

# Run it
./test-api-auth.sh
```

## Individual API Testing Examples

### Example 1: CEO Full Access Test

```bash
# Login as CEO
curl -X POST "http://localhost:8787/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ceo@widecorp.com",
    "password": "WideCorp2024!CEO"
  }' \
  -c ceo_cookies.txt

# Test organization management
curl -X GET "http://localhost:8787/api/organizations" \
  -b ceo_cookies.txt

# Test user management (admin endpoint)
curl -X GET "http://localhost:8787/api/auth/admin/users" \
  -b ceo_cookies.txt

# Test setting active organization
curl -X POST "http://localhost:8787/api/org-session/set-active-organization" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "01920000-1000-7000-8000-000000000001"}' \
  -b ceo_cookies.txt
```

### Example 2: Developer Limited Access Test

```bash
# Login as Developer
curl -X POST "http://localhost:8787/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev1@widecorp.com", 
    "password": "WideCorp2024!DEV1"
  }' \
  -c dev_cookies.txt

# Test regular API access
curl -X GET "http://localhost:8787/api/organizations" \
  -b dev_cookies.txt

# Test admin endpoint (should fail)
curl -X GET "http://localhost:8787/api/auth/admin/users" \
  -b dev_cookies.txt
```

## Organization Context Testing

### Set Active Organization

```bash
# First login
curl -X POST "http://localhost:8787/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}' \
  -c cookies.txt

# Set active organization
curl -X POST "http://localhost:8787/api/org-session/set-active-organization" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "01920000-1000-7000-8000-000000000001"}' \
  -b cookies.txt

# Verify active organization
curl -X GET "http://localhost:8787/api/org-session/active-organization" \
  -b cookies.txt

# Get user's organizations
curl -X GET "http://localhost:8787/api/org-session/user-organizations" \
  -b cookies.txt
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Session expired or invalid cookies
   - Re-run the login command
   - Check if cookies file exists and is readable

2. **403 Forbidden**: Insufficient permissions
   - Use a user with appropriate role (CEO/CTO for admin endpoints)
   - Check user role in the organization

3. **Cookie File Issues**:
   ```bash
   # Check if cookies are saved
   cat cookies.txt
   
   # Manual cookie inspection
   curl -X GET "http://localhost:8787/api/auth/session" \
     -b cookies.txt -v
   ```

### Debugging Session Issues

```bash
# Get detailed session information
curl -X GET "http://localhost:8787/api/auth/session" \
  -b cookies.txt \
  -H "Content-Type: application/json" | jq '.'

# Check if session has organization context
curl -X GET "http://localhost:8787/api/org-session/active-organization" \
  -b cookies.txt | jq '.'
```

## Advanced Usage

### Using with API Testing Tools

#### Postman Collection Import
1. Export cookies from curl: `curl -b cookies.txt --cookie-jar postman_cookies.txt`
2. Import cookies into Postman environment

#### Automated Testing Scripts
```bash
# Test suite runner
for user in "ceo@widecorp.com:WideCorp2024!CEO:CEO" \
           "dev1@widecorp.com:WideCorp2024!DEV1:DEV"; do
  IFS=':' read -r email password role <<< "$user"
  ./test-api-auth.sh "$email" "$password" "$role"
done
```

### Session Management

```bash
# Sign out (clear session)
curl -X POST "http://localhost:8787/api/auth/sign-out" \
  -b cookies.txt

# Remove cookies file
rm cookies.txt
```

## Security Notes

- **Development only**: This approach is for development/testing environments
- **Cookie files**: Keep cookie files secure and delete after testing
- **Production**: Use proper API keys or OAuth tokens in production
- **HTTPS**: Production should always use HTTPS for authentication

## Quick Reference Commands

```bash
# Quick login (CEO)
curl -X POST "http://localhost:8787/api/auth/sign-in" -H "Content-Type: application/json" -d '{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}' -c cookies.txt

# Quick API test
curl -X GET "http://localhost:8787/api/organizations" -b cookies.txt

# Quick session check
curl -X GET "http://localhost:8787/api/auth/session" -b cookies.txt | jq '.user.email'
```