# VibeStack MCP Architecture

## Overview

VibeStack implements a Model Context Protocol (MCP) system that provides LLM agents with direct control over the application data and operations. The architecture enables natural language interaction with the entire VibeStack ecosystem while maintaining security, organization-level isolation, and scalability.

## Current Implementation

### Architecture Pattern: Organization-Scoped MCP Integration

Rather than implementing MCP as a separate service, VibeStack integrates MCP capabilities directly into the existing OrganizationActor pattern. This provides several key benefits:

- **Unified Architecture**: No additional Durable Objects or services required
- **Automatic Scoping**: Each organization gets isolated access to their own data
- **Existing Security**: Leverages current authentication and authorization systems
- **Database Integration**: Direct access to Kysely ORM and database connections

### Current Endpoints

#### Status Endpoint
```
GET /api/org-actor/{orgId}/mcp/status
```

Returns agent metadata, available tools, and current context:
```json
{
  "status": "ok",
  "agent": "VibeStack Organization MCP Agent",
  "version": "1.0.0",
  "organizationId": "01920000-1000-7000-8000-000000000001",
  "endpoints": {
    "mcp": "/api/org-actor/{orgId}/mcp/agent",
    "status": "/api/org-actor/{orgId}/mcp/status"
  },
  "tools": ["get_organization_info", "get_projects", "get_teams", "get_members", "get_context"],
  "context": {
    "currentOrganization": "01920000-1000-7000-8000-000000000001",
    "authenticatedUser": {
      "id": "user-id",
      "email": "user@example.com"
    }
  }
}
```

#### Agent Execution Endpoint
```
POST /api/org-actor/{orgId}/mcp/agent
```

Executes MCP tools using JSON-RPC 2.0 format:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "call_tool",
  "params": {
    "name": "get_organization_info"
  }
}
```

### Available MCP Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get_organization_info` | Organization details, tier, lore | Organization metadata |
| `get_projects` | Projects in the organization | List of projects with status, priority |
| `get_teams` | Teams in the organization | List of teams with descriptions |
| `get_members` | Organization members with roles | Member list with permissions |
| `get_context` | Current context and available tools | Context information |

### Implementation Details

#### JSON-RPC 2.0 Compliance
The system supports both MCP standard format and direct method calls:
```javascript
// MCP Standard Format
const toolName = mcpRequest.params?.name || mcpRequest.method;

// Handles both:
// { "method": "call_tool", "params": { "name": "get_projects" } }
// { "method": "get_projects" }
```

#### Database Integration
Uses existing VibeStack database patterns:
```javascript
const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
createDatabaseConnection(env);
const db = getKysely();
```

#### Error Handling
Provides JSON-RPC compliant error responses:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": "Detailed error message"
  }
}
```

## Security Model

### Authentication Flow
1. Standard cookie-based authentication via Better Auth
2. Organization membership verification
3. Role-based permission checking
4. Automatic user context injection

### Data Isolation
- Each organization's MCP agent can only access their own data
- URL-based organization scoping: `/api/org-actor/{orgId}/mcp/agent`
- Database queries automatically filtered by organization ID

### Permission Model
- **Owner**: Full MCP access to all tools
- **Admin**: Full MCP access to all tools  
- **Manager**: Read access to projects, teams, members
- **Member**: Read access to projects and teams only

## Performance Considerations

### Connection Management
- Reuses existing database connections from OrganizationActor
- Kysely connection pooling for optimal performance
- Connection cleanup handled by existing infrastructure

### Caching Strategy
- Organization data cached within OrganizationActor state
- Team and project metadata cached for frequent access
- Context information cached in session storage

### Rate Limiting
- Leverages existing API rate limiting configuration
- Organization-specific quotas can be implemented
- Tool execution limits based on subscription tier

## Current Limitations

1. **Read-Only Operations**: Current tools only read data, no write operations
2. **Limited Scope**: Only covers organizations, projects, teams, and members
3. **No Real-time Updates**: Static responses, no WebSocket integration
4. **Basic Tool Set**: Limited to core entity queries

## Future Enhancement Roadmap

### Phase 1: Write Operations (Immediate - 2-4 weeks)

#### Enhanced Tool Set
```javascript
// Create operations
'create_project': async (args) => { /* Implementation */ },
'create_team': async (args) => { /* Implementation */ },
'create_task': async (args) => { /* Implementation */ },

// Update operations
'update_project': async (args) => { /* Implementation */ },
'update_task_status': async (args) => { /* Implementation */ },
'assign_team_member': async (args) => { /* Implementation */ },

// Delete operations (soft deletes)
'archive_project': async (args) => { /* Implementation */ },
'remove_team_member': async (args) => { /* Implementation */ },
```

#### Input Validation & Schema
```javascript
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  teamId: z.string().uuid(),
  dueDate: z.string().datetime().optional()
});
```

#### Transaction Support
```javascript
// Multi-operation transactions
'bulk_create_tasks': async (args) => {
  return await db.transaction().execute(async (trx) => {
    // Multiple operations in transaction
  });
}
```

### Phase 2: Real-time Integration (4-8 weeks)

#### WebSocket MCP Bridge
```javascript
// Real-time data streams
'subscribe_project_updates': async (orgId, projectId) => {
  // Subscribe to project changes via WebSocket
},

'get_live_team_activity': async (orgId, teamId) => {
  // Real-time team activity feed
}
```

#### Event-Driven Updates
- Integration with existing WebSocket sync system
- MCP tool results update in real-time
- Notification system for long-running operations

### Phase 3: Advanced Analytics & AI (8-12 weeks)

#### Analytics Tools
```javascript
'get_project_analytics': async (args) => {
  // Project completion rates, timeline analysis
},

'get_team_performance': async (args) => {
  // Team productivity metrics, workload distribution
},

'get_organization_insights': async (args) => {
  // High-level organizational health metrics
}
```

#### AI-Powered Tools
```javascript
'suggest_project_optimizations': async (args) => {
  // AI analysis of project bottlenecks
},

'recommend_team_structure': async (args) => {
  // Team composition recommendations
},

'predict_delivery_timeline': async (args) => {
  // ML-based timeline predictions
}
```

### Phase 4: Integration Ecosystem (12-16 weeks)

#### External Service Integration
```javascript
// Integration with external tools
'sync_with_github': async (args) => { /* GitHub integration */ },
'create_slack_channel': async (args) => { /* Slack integration */ },
'schedule_calendar_event': async (args) => { /* Calendar integration */ },
```

#### Custom Tool Framework
```javascript
// Plugin system for custom MCP tools
class CustomMCPTool {
  name: string;
  description: string;
  schema: ZodSchema;
  execute: (args: any, context: MCPContext) => Promise<any>;
}
```

### Phase 5: Enterprise Features (16-20 weeks)

#### Multi-Organization Tools
```javascript
'get_cross_org_insights': async (args) => {
  // Insights across multiple organizations
},

'transfer_resources': async (args) => {
  // Move projects/teams between orgs
}
```

#### Advanced Security
- Audit logging for all MCP operations
- Fine-grained permission system
- IP allowlisting and geographic restrictions
- API key management for external integrations

#### Governance & Compliance
```javascript
'generate_compliance_report': async (args) => {
  // GDPR, SOX, HIPAA compliance reporting
},

'audit_data_access': async (args) => {
  // Data access audit trails
}
```

## Technical Implementation Guidelines

### Tool Development Pattern
```javascript
async function executeMCPTool(orgId: string, mcpRequest: any, user: any, env: any) {
  // 1. Authentication & authorization
  await validatePermissions(user, orgId, mcpRequest.params.name);
  
  // 2. Input validation
  const args = validateToolArguments(mcpRequest.params.name, mcpRequest.params.arguments);
  
  // 3. Database connection
  const db = getKysely();
  
  // 4. Tool execution with error handling
  try {
    const result = await executeSpecificTool(toolName, args, db, user, orgId);
    return formatMCPResponse(result);
  } catch (error) {
    return formatMCPError(error);
  }
}
```

### Error Handling Standards
```javascript
// Standard MCP error codes
const MCPErrorCodes = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601, 
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PERMISSION_DENIED: -32000,
  RESOURCE_NOT_FOUND: -32001,
  QUOTA_EXCEEDED: -32002
};
```

### Performance Monitoring
```javascript
// Tool execution metrics
const toolMetrics = {
  executionTime: Date.now() - startTime,
  databaseQueries: queryCount,
  memoryUsage: process.memoryUsage(),
  organizationId: orgId,
  toolName: mcpRequest.params.name
};
```

## Deployment Considerations

### Cloudflare Workers Optimization
- Minimize cold start impact with connection pooling
- Use Durable Objects for stateful MCP sessions
- Leverage Cloudflare AI for on-worker AI operations

### Database Performance
- Index optimization for MCP query patterns
- Connection pooling with Hyperdrive
- Query caching for frequently accessed data

### Monitoring & Observability
- MCP tool usage analytics
- Error rate monitoring per organization
- Performance metrics for each tool
- User activity tracking

## Integration Examples

### Example 1: Project Management Workflow
```bash
# Natural language: "Create a high-priority mobile app project for the frontend team"

# Translates to MCP calls:
1. GET /mcp/agent - get_teams (find frontend team)
2. POST /mcp/agent - create_project({
     name: "Mobile App Project",
     priority: "high",
     teamId: "frontend-team-id"
   })
3. POST /mcp/agent - create_task({
     projectId: "new-project-id",
     name: "Setup development environment",
     assigneeId: "team-lead-id"
   })
```

### Example 2: Team Analytics
```bash
# Natural language: "Show me the performance metrics for the development team this quarter"

# Translates to MCP calls:
1. GET /mcp/agent - get_team_performance({
     teamName: "Development Team",
     timeframe: "Q1-2024"
   })
2. GET /mcp/agent - get_project_analytics({
     teamId: "dev-team-id",
     startDate: "2024-01-01",
     endDate: "2024-03-31"
   })
```

## Conclusion

The VibeStack MCP architecture provides a solid foundation for LLM-driven application control while maintaining security, performance, and scalability. The phased enhancement roadmap ensures systematic expansion of capabilities while preserving the core architectural benefits.

The organization-scoped approach ensures data isolation and security, while the integration with existing infrastructure minimizes complexity and maintenance overhead. Future enhancements will build upon this foundation to create a comprehensive AI-driven application management system.