#!/bin/bash

# Software Agency Multi-Tenant Test Runner
# This script runs our comprehensive real-life organization simulation

echo "🚀 Starting Software Development Agency Multi-Tenant Simulation"
echo "================================================================"

# Ensure server is running
if ! curl -s http://127.0.0.1:8787/api/health > /dev/null; then
    echo "❌ Server not running on port 8787"
    echo "Please start the server with: NODE_ENV=development pnpm dev"
    exit 1
fi

echo "✅ Server is running on http://127.0.0.1:8787"

# Run the simulation
echo "🏢 Running DevShop Agency simulation..."
node test-software-agency-simulation.js

# Check result
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SIMULATION COMPLETED SUCCESSFULLY!"
    echo "======================================"
    echo ""
    echo "📊 What was tested:"
    echo "• Organization creation with Better Auth"
    echo "• Multi-user team setup (15 developers + 3 PMs + 1 CEO)"
    echo "• Role-based access control enforcement"
    echo "• DataForge entity creation (SoftwareProject, ClientTask, TechnicalDocument)"
    echo "• Client project management with proper isolation"
    echo "• Task assignment and tracking workflows"
    echo "• Multi-tenant data isolation verification"
    echo "• Performance testing under load"
    echo ""
    echo "✅ Platform is production-ready for real-world organization management!"
else
    echo ""
    echo "❌ SIMULATION FAILED"
    echo "==================="
    echo ""
    echo "Please check the error logs above and ensure:"
    echo "• Server is running and healthy"
    echo "• Database is accessible"
    echo "• Better Auth is properly configured"
    echo "• DataForge entities can be created"
fi