#!/bin/bash

# Check if API key is already set
if [ -n "$GEMINI_API_KEY" ]; then
    echo "✅ GEMINI_API_KEY already configured"
    exit 0
fi

echo "🤖 Gemini setup required for session tracking"
echo ""
echo "Get API key: https://aistudio.google.com/app/apikey"
echo "Add to ~/.bashrc: export GEMINI_API_KEY=\"your-key\""
echo ""

read -p "Set API key for this session? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "API key: " -s TEMP_KEY
    echo ""
    if [ -n "$TEMP_KEY" ]; then
        export GEMINI_API_KEY="$TEMP_KEY"
        echo "✅ Set for this session"
    fi
fi