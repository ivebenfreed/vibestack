#!/bin/bash

# Enhanced Claude Code Setup for VibeStack Development Environments
# Integrates session planning system with containerized environment management

set -e

echo "🚀 Claude Code Enhanced Setup for VibeStack Environments"
echo "========================================================="
echo ""

# Get target environment from argument
ENVIRONMENT_NAME="${1:-dev-1}"
ENVIRONMENT_DIR="/home/benfreed/dev/vibestack/environments/$ENVIRONMENT_NAME"

if [ ! -d "$ENVIRONMENT_DIR" ]; then
    echo "❌ Error: Environment directory '$ENVIRONMENT_DIR' does not exist"
    echo "Available environments:"
    ls -1 /home/benfreed/dev/vibestack/environments/dev-* 2>/dev/null | basename -a || echo "No environments found"
    exit 1
fi

echo "📂 Setting up enhanced Claude Code for environment: $ENVIRONMENT_NAME"
echo "📁 Environment directory: $ENVIRONMENT_DIR"
echo ""

# Check if container is running
CONTAINER_NAME="vibestack-devenv$(echo $ENVIRONMENT_NAME | grep -o '[0-9]*')"
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container '$CONTAINER_NAME' is not running"
    echo "Start it first with: cd $ENVIRONMENT_DIR && ./start.sh"
    exit 1
fi

echo "🐳 Installing enhanced Claude Code setup in container '$CONTAINER_NAME'..."

# Install session planning system inside container
docker exec "$CONTAINER_NAME" bash -c "
    # Create .claude directory in workspace
    mkdir -p /workspace/.claude
    
    # Create session-start.sh
    cat > /workspace/.claude/session-start.sh << 'SCRIPT_EOF'
#!/bin/bash

# Get today's date
DATE=\$(date '+%Y-%m-%d')
DATE_DIR=\"/workspace/sessions/\${DATE}\"

# Create date directory if it doesn't exist
mkdir -p \"\$DATE_DIR\"

# Check if we should reuse an existing session
REUSE_WINDOW=7200  # 2 hours in seconds
CURRENT_TIME=\$(date +%s)

# Find the most recent session for today
LAST_SESSION=\$(ls -d \${DATE_DIR}/session-* 2>/dev/null | sort -V | tail -1)

if [ -n \"\$LAST_SESSION\" ]; then
    # Check if the session is recent enough to reuse
    SESSION_TIME=\$(stat -c %Y \"\$LAST_SESSION\" 2>/dev/null)
    if [ -n \"\$SESSION_TIME\" ]; then
        TIME_DIFF=\$((CURRENT_TIME - SESSION_TIME))
        
        if [ \$TIME_DIFF -lt \$REUSE_WINDOW ]; then
            # Reuse existing session
            echo \"[\$(date '+%Y-%m-%d %H:%M:%S')] SESSION REUSE - Directory: \$LAST_SESSION\" >> \"/workspace/.claude/sessions.log\"
            echo \"\$LAST_SESSION\" > \"/workspace/.claude/current-session\"
            echo \"🔄 Reusing existing session: \$LAST_SESSION\"
            exit 0
        fi
    fi
fi

# Create new session if none exists or last one is too old
SESSION_NUM=1
if [ -n \"\$LAST_SESSION\" ]; then
    # Extract the session number and increment
    LAST_NUM=\$(basename \"\$LAST_SESSION\" | sed 's/session-//')
    SESSION_NUM=\$((LAST_NUM + 1))
fi

# Create the new session directory
NEW_SESSION_DIR=\"\${DATE_DIR}/session-\${SESSION_NUM}\"
mkdir -p \"\$NEW_SESSION_DIR\"

# Create initial plan.md with VibeStack-specific template
cat > \"\$NEW_SESSION_DIR/plan.md\" << 'PLAN_EOF'
# Session \${SESSION_NUM} Plan - VibeStack Development

## Environment Info
- **Container**: $CONTAINER_NAME
- **Web**: http://localhost:5175 → http://localhost:5173 (container)
- **API**: http://localhost:8789 → http://localhost:8787 (container) 
- **Database**: PostgreSQL in container

## Session Goals
- [ ] Define primary objective for this session
- [ ] Set up development servers if needed
- [ ] Review current codebase state
- [ ] Plan implementation approach

## Notes
Update this plan as you work on the VibeStack project.

**Common Commands:**
\`\`\`bash
pnpm dev          # Start both web and API servers
pnpm dev:web      # Web app only
pnpm dev:server   # API server only
pnpm type-check   # TypeScript validation
\`\`\`

Created: \$(date '+%Y-%m-%d %H:%M')
PLAN_EOF

# Log the session start
echo \"[\$(date '+%Y-%m-%d %H:%M:%S')] SESSION START - Directory: \$NEW_SESSION_DIR\" >> \"/workspace/.claude/sessions.log\"

# Save current session info for other hooks to use
echo \"\$NEW_SESSION_DIR\" > \"/workspace/.claude/current-session\"

echo \"📋 Created new session: \$NEW_SESSION_DIR\"
SCRIPT_EOF

    # Create planning-context.sh
    cat > /workspace/.claude/planning-context.sh << 'SCRIPT_EOF'
#!/bin/bash

# Planning Context Hook - Injects session planning context for VibeStack development

SESSION_DIR=\"/workspace/sessions/\$(date +%Y-%m-%d)\"
LATEST_SESSION=\$(ls -d \$SESSION_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z \"\$LATEST_SESSION\" ]; then
    echo '{\"shouldBlock\": false}'
    exit 0
fi

PLAN_FILE=\"\$LATEST_SESSION/plan.md\"
WORK_LOG=\"\$LATEST_SESSION/work-log.md\"
SESSION_NAME=\$(basename \"\$LATEST_SESSION\")

# Read current session state
CURRENT_GOALS=\"\"
if [ -f \"\$PLAN_FILE\" ]; then
    # Extract current goals and status
    CURRENT_GOALS=\$(grep -E \"^- \\[.\\]\" \"\$PLAN_FILE\" 2>/dev/null | head -5)
    COMPLETED_COUNT=\$(grep -c \"✅\\|☑\\|\\[x\\]\" \"\$PLAN_FILE\" 2>/dev/null || echo 0)
    TOTAL_COUNT=\$(grep -c \"- \\[\" \"\$PLAN_FILE\" 2>/dev/null || echo 0)
else
    CURRENT_GOALS=\"No plan file exists yet\"
    COMPLETED_COUNT=0
    TOTAL_COUNT=0
fi

# VibeStack-specific context
VIBESTACK_CONTEXT=\"📦 **VibeStack Development Environment**

**Container**: $CONTAINER_NAME
**Session**: \$SESSION_NAME (\$COMPLETED_COUNT/\$TOTAL_COUNT goals completed)

**Current Goals:**
\$CURRENT_GOALS

**VibeStack Resources:**
- Web: http://localhost:5175 (→5173 container)
- API: http://localhost:8789 (→8787 container)
- Test User: ceo@widecorp.com / WideCorp2024!CEO
- Session Plan: \$PLAN_FILE

**Planning Reminders:**
- Update session plan as you work on VibeStack features
- Mark goals completed (✅) when finished
- Add new goals for discovered tasks
- Consider database sync needs for testing\"

# Output context injection
cat <<EOF
{
    \"shouldBlock\": false,
    \"additionalContext\": \"\$VIBESTACK_CONTEXT\"
}
EOF
SCRIPT_EOF

    # Create session-summary.sh
    cat > /workspace/.claude/session-summary.sh << 'SCRIPT_EOF'
#!/bin/bash

# Simple session summary script for VibeStack development

SESSION_DIR=\"/workspace/sessions/\$(date +%Y-%m-%d)\"
LATEST_SESSION=\$(ls -d \$SESSION_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z \"\$LATEST_SESSION\" ]; then
    exit 0
fi

PLAN_FILE=\"\$LATEST_SESSION/plan.md\"
SUMMARY_FILE=\"\$LATEST_SESSION/session-summary.md\"
SESSION_NAME=\$(basename \"\$LATEST_SESSION\")

# Create basic summary
cat > \"\$SUMMARY_FILE\" << 'SUMMARY_EOF'
# \$SESSION_NAME Summary

**Environment**: $CONTAINER_NAME
**Completed**: \$(date '+%Y-%m-%d %H:%M')

## Accomplishments
- Session completed in VibeStack development environment
- Container ports: 5175→5173 (web), 8789→8787 (API)

## Next Steps
- Review plan.md for remaining goals
- Consider database sync if working with test data

Generated: \$(date '+%Y-%m-%d %H:%M:%S')
SUMMARY_EOF

echo \"📄 Created session summary: \$SUMMARY_FILE\"
SCRIPT_EOF

    # Make scripts executable
    chmod +x /workspace/.claude/*.sh
    
    # Create settings.json with VibeStack-specific hooks
    cat > /workspace/.claude/settings.json << 'SETTINGS_EOF'
{
  \"hooks\": {
    \"SessionStart\": [
      {
        \"hooks\": [
          {
            \"type\": \"command\",
            \"command\": \"/workspace/.claude/session-start.sh\"
          }
        ]
      }
    ],
    \"UserPromptSubmit\": [
      {
        \"hooks\": [
          {
            \"type\": \"command\",
            \"command\": \"/workspace/.claude/planning-context.sh\"
          }
        ]
      }
    ],
    \"Stop\": [
      {
        \"hooks\": [
          {
            \"type\": \"command\",
            \"command\": \"/workspace/.claude/session-summary.sh\",
            \"timeout\": 10
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF

    # Create initial sessions directory structure
    mkdir -p /workspace/sessions/\$(date '+%Y-%m-%d')
    
    # Add sessions to .gitignore if not already there
    if [ -f /workspace/.gitignore ] && ! grep -q 'sessions/' /workspace/.gitignore; then
        echo '' >> /workspace/.gitignore
        echo '# Claude Code sessions' >> /workspace/.gitignore
        echo 'sessions/' >> /workspace/.gitignore
        echo '.claude/sessions.log' >> /workspace/.gitignore
    fi
    
    # Ensure Claude Code is available
    if [ ! -f /home/developer/.local/bin/claude ]; then
        echo '🔽 Installing Claude Code in container...'
        curl -fsSL https://claude.ai/install.sh | bash
    fi
    
    # Update PATH in bashrc
    if ! grep -q '.local/bin' /home/developer/.bashrc; then
        echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> /home/developer/.bashrc
    fi
    
    echo '✅ Enhanced Claude Code setup complete!'
    echo '📋 Session planning system installed'
    echo '🔧 Claude Code available at: /home/developer/.local/bin/claude'
    echo '📁 Sessions will be saved to: /workspace/sessions/'
    echo '⚙️  Settings configured at: /workspace/.claude/settings.json'
" 

# Update the enter.sh script to directly run claude with --dangerously-skip-permissions
if [ -f "$ENVIRONMENT_DIR/enter.sh" ]; then
    echo "🔧 Updating enter.sh to automatically start Claude Code..."
    
    # Check if it already has the claude exec command
    if ! grep -q "exec claude --dangerously-skip-permissions" "$ENVIRONMENT_DIR/enter.sh"; then
        # Replace the bash exec with claude exec
        sed -i 's/exec bash -l$/exec claude --dangerously-skip-permissions/' "$ENVIRONMENT_DIR/enter.sh"
        
        # Update the message
        sed -i 's/Ready to code! Type.*claude.*/🚀 Starting Claude Code with enhanced session planning.../' "$ENVIRONMENT_DIR/enter.sh"
        
        echo "✅ Updated enter.sh to auto-start Claude Code"
    else
        echo "✅ enter.sh already configured to auto-start Claude Code"
    fi
fi

echo ""
echo "✅ Enhanced Claude Code setup completed for environment: $ENVIRONMENT_NAME"
echo ""
echo "🎯 Next Steps:"
echo "1. Enter the container: cd $ENVIRONMENT_DIR && ./enter.sh"
echo "2. Start Claude Code: claude"
echo "3. Session planning will be automatically active"
echo ""
echo "📋 Features Installed:"
echo "   • Automatic session creation and reuse"
echo "   • Planning context injection on every prompt"  
echo "   • Session summaries on exit"
echo "   • VibeStack-specific development templates"
echo "   • Integration with container port mappings"
echo ""