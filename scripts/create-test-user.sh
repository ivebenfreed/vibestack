#!/bin/bash

# Simple test to create one user via bootstrap

SERVER_URL="http://localhost:8787"
BOOTSTRAP_SECRET="c1a7b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1"

echo "Creating test user..."

curl -X POST "${SERVER_URL}/api/bootstrap/create-super-admin" \
  -H "Content-Type: application/json" \
  -H "X-Bootstrap-Key: ${BOOTSTRAP_SECRET}" \
  -d '{"email":"admin@test.com","password":"Test123!","name":"Admin"}' \
  -v