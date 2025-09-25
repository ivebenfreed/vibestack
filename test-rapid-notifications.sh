#!/bin/bash

# Rapid-fire notification test using API
echo "🚀 Starting rapid-fire notification test..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API configuration
API_URL="http://localhost:4000/api"
ORG_ID="01920000-1000-7000-8000-000000000001"
CLIENT_ID="ba575163-5ab4-4f38-9aeb-7bc2005d7cc1"

# Test configuration
NUM_TESTS=5
DELAY_BETWEEN_TESTS=0.5  # seconds

echo -e "${YELLOW}Running $NUM_TESTS updates with ${DELAY_BETWEEN_TESTS}s delay${NC}"
echo "Target: Client $CLIENT_ID in org $ORG_ID"
echo "----------------------------------------"

# Run rapid updates
for i in $(seq 1 $NUM_TESTS); do
    TIMESTAMP=$(date +%s.%N)
    UPDATE_NAME="RAPID TEST $i - $TIMESTAMP"

    echo -e "${GREEN}[Test $i/$NUM_TESTS]${NC} Updating client..."

    # Update via API
    RESPONSE=$(curl -s -X PATCH \
        "$API_URL/dataforge/orgs/$ORG_ID/entities/client/$CLIENT_ID" \
        -H "Content-Type: application/json" \
        -b cookies.txt \
        -d "{
            \"name\": \"$UPDATE_NAME\",
            \"description\": \"Rapid notification test $i at $TIMESTAMP\"
        }")

    # Check if update was successful
    if echo "$RESPONSE" | grep -q '"id"'; then
        echo -e "  ✅ Update successful: $UPDATE_NAME"
    else
        echo -e "  ${RED}❌ Update failed${NC}"
        echo "  Response: $RESPONSE"
    fi

    # Small delay between updates
    if [ $i -lt $NUM_TESTS ]; then
        sleep $DELAY_BETWEEN_TESTS
    fi
done

echo "----------------------------------------"
echo -e "${GREEN}✅ Rapid-fire test complete!${NC}"
echo "Check chrome-remote console for notifications"