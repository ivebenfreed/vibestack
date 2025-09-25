#!/bin/bash

# Rapid-fire notification test using direct database updates
echo "🚀 Starting rapid-fire database notification test..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
NUM_TESTS=10
DELAY_BETWEEN_TESTS=0.2  # 200ms between updates

echo -e "${YELLOW}Running $NUM_TESTS rapid updates with ${DELAY_BETWEEN_TESTS}s delay${NC}"
echo "----------------------------------------"

# Run rapid updates
for i in $(seq 1 $NUM_TESTS); do
    TIMESTAMP=$(date +%s.%N)
    UPDATE_NAME="RAPID TEST $i - $TIMESTAMP"

    echo -e "${GREEN}[Test $i/$NUM_TESTS]${NC} Updating client at $(date +%H:%M:%S.%3N)..."

    # Update directly in database
    psql postgres://postgres:postgres@localhost:5432/elevra_dev -q -c \
        "UPDATE org_01920000_1000_7000_8000_000000000001_client
         SET name = '$UPDATE_NAME', updated_at = NOW()
         WHERE id = 'ba575163-5ab4-4f38-9aeb-7bc2005d7cc1';" 2>/dev/null

    echo "  ✅ Updated: $UPDATE_NAME"

    # Small delay between updates
    if [ $i -lt $NUM_TESTS ]; then
        sleep $DELAY_BETWEEN_TESTS
    fi
done

echo "----------------------------------------"
echo -e "${GREEN}✅ Rapid-fire test complete!${NC}"
echo "Total time: ~$(echo "$NUM_TESTS * $DELAY_BETWEEN_TESTS" | bc)s"
echo "Check chrome-remote console for notifications"