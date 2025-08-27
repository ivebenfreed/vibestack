#!/bin/bash

# Read the JSON input
INPUT=$(cat)

# Extract the event name from the input
EVENT_NAME=$(echo "$INPUT" | jq -r '.hookEventName // empty')

echo "🔔 NOTIFICATION HOOK TRIGGERED!" >&2
echo "📊 Event: $EVENT_NAME" >&2
echo "⏰ Time: $(date)" >&2
echo "📁 PWD: $(pwd)" >&2

# Return the input unchanged
echo "$INPUT"