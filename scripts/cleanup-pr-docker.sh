#!/bin/bash

# Cleanup Docker containers and volumes for PR environments
# Usage: ./scripts/cleanup-pr-docker.sh [PR_NUMBER]
# If no PR number provided, shows all PR containers and prompts for cleanup

set -e

PR_NUMBER="$1"

echo "🐳 Docker PR Environment Cleanup"
echo ""

# Function to cleanup specific PR
cleanup_pr() {
    local pr_num=$1
    echo "🧹 Cleaning up PR #${pr_num} Docker resources..."
    
    # Stop and remove containers
    local containers=$(docker ps -a --format "{{.Names}}" | grep -E "vibestack-(postgres|neon-proxy)-${pr_num}$" || true)
    if [ -n "$containers" ]; then
        echo "$containers" | while read container; do
            echo "   Stopping container: $container"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        done
    else
        echo "   No containers found for PR #${pr_num}"
    fi
    
    # Remove volumes
    local volumes=$(docker volume ls --format "{{.Name}}" | grep -E "(issue-${pr_num}|pr.*${pr_num})(_|$)" || true)
    if [ -n "$volumes" ]; then
        echo "$volumes" | while read volume; do
            echo "   Removing volume: $volume"
            docker volume rm "$volume" 2>/dev/null || true
        done
    else
        echo "   No volumes found for PR #${pr_num}"
    fi
    
    # Remove networks
    local networks=$(docker network ls --format "{{.Name}}" | grep -E "issue-${pr_num}" || true)
    if [ -n "$networks" ]; then
        echo "$networks" | while read network; do
            echo "   Removing network: $network"
            docker network rm "$network" 2>/dev/null || true
        done
    else
        echo "   No networks found for PR #${pr_num}"
    fi
    
    echo "✅ Cleanup complete for PR #${pr_num}"
}

# If PR number provided, cleanup that specific PR
if [ -n "$PR_NUMBER" ]; then
    cleanup_pr "$PR_NUMBER"
else
    # Show all PR containers and volumes
    echo "📊 Current PR Docker resources:"
    echo ""
    
    # Find all PR containers
    PR_CONTAINERS=$(docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "vibestack-(postgres|neon-proxy)-[0-9]+" || true)
    if [ -n "$PR_CONTAINERS" ]; then
        echo "Containers:"
        echo "$PR_CONTAINERS"
        echo ""
    else
        echo "No PR containers found."
        echo ""
    fi
    
    # Find all PR volumes
    PR_VOLUMES=$(docker volume ls --format "table {{.Name}}\t{{.Driver}}" | grep -E "(issue-[0-9]+|pr.*[0-9]+)" || true)
    if [ -n "$PR_VOLUMES" ]; then
        echo "Volumes:"
        echo "$PR_VOLUMES"
        echo ""
    else
        echo "No PR volumes found."
        echo ""
    fi
    
    # Extract unique PR numbers from container/volume names
    PR_NUMBERS=$(echo -e "$PR_CONTAINERS\n$PR_VOLUMES" | grep -oE "(vibestack-(postgres|neon-proxy)-|issue-|pr[_-])[0-9]+" | grep -oE "[0-9]+$" | sort -u | grep -v "^$" || true)
    
    if [ -n "$PR_NUMBERS" ]; then
        echo "Found resources for PRs: $(echo $PR_NUMBERS | tr '\n' ' ')"
        echo ""
        read -p "Clean up all PR resources? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for pr in $PR_NUMBERS; do
                cleanup_pr "$pr"
                echo ""
            done
        else
            echo ""
            echo "To cleanup a specific PR, run:"
            echo "  ./scripts/cleanup-pr-docker.sh [PR_NUMBER]"
        fi
    else
        echo "✨ No PR Docker resources to clean up!"
    fi
fi