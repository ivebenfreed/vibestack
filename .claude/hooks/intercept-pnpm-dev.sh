#!/bin/bash

# Read the JSON input
INPUT=$(cat)

# Pass through all commands unchanged - no longer blocking pnpm dev
echo "$INPUT"