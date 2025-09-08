# EmbeddingGemma Implementation Plan for VibeStack

## Strategic Decision: Go Direct to Gemma

Given similar pricing to BGE but superior capabilities, we'll implement EmbeddingGemma (`@cf/google/embeddinggemma-300m`) as our primary embedding model for VibeStack's semantic search system.

## Phase 1: Foundation Implementation (1-2 weeks)

### Database Schema Setup

```sql
-- Add embedding columns (assuming 768 dimensions for Gemma)
-- We'll need to test actual dimensions first
ALTER TABLE organizations ADD COLUMN lore_embedding vector(768);
ALTER TABLE projects ADD COLUMN description_embedding vector(768);
ALTER TABLE teams ADD COLUMN description_embedding vector(768);

-- Add metadata for embedding management
ALTER TABLE organizations ADD COLUMN embedding_updated_at timestamptz;
ALTER TABLE projects ADD COLUMN embedding_updated_at timestamptz;
ALTER TABLE teams ADD COLUMN embedding_updated_at timestamptz;

-- Create vector similarity indexes
CREATE INDEX CONCURRENTLY organizations_lore_embedding_idx 
  ON organizations USING ivfflat (lore_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX CONCURRENTLY projects_description_embedding_idx
  ON projects USING ivfflat (description_embedding vector_cosine_ops) 
  WITH (lists = 100);

CREATE INDEX CONCURRENTLY teams_description_embedding_idx
  ON teams USING ivfflat (description_embedding vector_cosine_ops)
  WITH (lists = 100);
```

### EmbeddingGeneratorDO Implementation

```typescript
// /src/server/actors/EmbeddingGeneratorDO.ts
export class EmbeddingGeneratorDO {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/process-changes':
        return await this.processChanges(await request.json());
      case '/test-embedding':
        return await this.testEmbedding(await request.json());
      case '/status':
        return await this.getStatus();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  // Test endpoint to validate Gemma model and get dimensions
  private async testEmbedding(request: { text: string }): Promise<Response> {
    try {
      const result = await this.env.AI.run('@cf/google/embeddinggemma-300m', {
        text: request.text || "Test embedding generation"
      });
      
      return new Response(JSON.stringify({
        success: true,
        dimensions: result.data[0]?.length || 'unknown',
        embedding: result.data[0]?.slice(0, 5), // First 5 values for inspection
        model: '@cf/google/embeddinggemma-300m'
      }));
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        model: '@cf/google/embeddinggemma-300m'
      }), { status: 500 });
    }
  }

  private async processChanges(request: ChangeRequest): Promise<Response> {
    const { organizationId, changes, timestamp } = request;
    
    // Convert changes to embedding jobs
    const jobs = changes.map(change => this.createEmbeddingJob(change, timestamp));
    
    // Process immediately for Phase 1 (we'll add batching later)
    const results = await Promise.allSettled(
      jobs.map(job => this.processJob(job))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return new Response(JSON.stringify({
      organizationId,
      processed: jobs.length,
      successful,
      failed,
      timestamp
    }));
  }

  private async processJob(job: EmbeddingJob): Promise<void> {
    // Fetch current record content
    const record = await this.fetchRecord(job.table, job.recordId);
    if (!record) return; // Record deleted
    
    // Generate embedding for each text column
    for (const [column, content] of Object.entries(job.textContent)) {
      if (!content?.trim()) continue;
      
      try {
        const embedding = await this.generateEmbedding(content);
        await this.updateEmbedding(job.table, job.recordId, column, embedding);
      } catch (error) {
        console.error(`Failed to generate embedding for ${job.table}:${job.recordId}:${column}`, error);
      }
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.env.AI.run('@cf/google/embeddinggemma-300m', {
      text: text
    });
    
    return response.data[0];
  }

  private async updateEmbedding(
    table: string, 
    recordId: string, 
    column: string, 
    embedding: number[]
  ): Promise<void> {
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(this.env);
    const db = getKysely();
    
    const embeddingColumn = `${column}_embedding`;
    const vectorValue = `[${embedding.join(',')}]`;
    
    await db
      .updateTable(table as any)
      .set({
        [embeddingColumn]: sql`${vectorValue}::vector`,
        embedding_updated_at: new Date()
      } as any)
      .where('id', '=', recordId)
      .execute();
  }
}
```

### ReplicationDO Integration

```typescript
// Enhance existing ReplicationDO to forward embedding changes
export class ReplicationDO {
  async processChanges(changes: WALChange[]) {
    // Existing sync processing
    await this.processSyncChanges(changes);
    
    // NEW: Forward embedding-relevant changes
    const embeddingChanges = this.filterEmbeddingChanges(changes);
    if (embeddingChanges.length > 0) {
      await this.forwardToEmbeddingGenerator(embeddingChanges);
    }
  }

  private filterEmbeddingChanges(changes: WALChange[]): EmbeddingChange[] {
    const EMBEDDING_TABLES = ['organizations', 'projects', 'teams'];
    const EMBEDDING_COLUMNS = {
      'organizations': ['lore'],
      'projects': ['description'],
      'teams': ['description']
    };

    return changes
      .filter(change => EMBEDDING_TABLES.includes(change.table))
      .filter(change => {
        const relevantColumns = EMBEDDING_COLUMNS[change.table] || [];
        return relevantColumns.some(col => change.columnnames?.includes(col));
      })
      .map(change => ({
        table: change.table,
        id: change.columnvalues[change.columnnames.indexOf('id')],
        organizationId: this.extractOrgId(change),
        textColumns: this.extractTextColumns(change, EMBEDDING_COLUMNS[change.table]),
        operation: change.kind,
        lsn: change.lsn
      }));
  }

  private async forwardToEmbeddingGenerator(changes: EmbeddingChange[]) {
    // Group by organization for efficient processing
    const changesByOrg = this.groupBy(changes, 'organizationId');
    
    for (const [orgId, orgChanges] of Object.entries(changesByOrg)) {
      const embeddingGenId = this.env.EMBEDDING_GENERATOR.idFromName(`org:${orgId}`);
      const embeddingGen = this.env.EMBEDDING_GENERATOR.get(embeddingGenId);
      
      await embeddingGen.fetch(new Request('https://internal/process-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          changes: orgChanges,
          timestamp: Date.now()
        })
      }));
    }
  }
}
```

## Phase 2: MCP Integration (Week 2-3)

### Enhanced MCP Tools with Semantic Search

```typescript
// Add to existing organizationActorRouter
async function executeMCPTool(orgId: string, mcpRequest: any, user: any, env: any) {
  const toolName = mcpRequest.params?.name || mcpRequest.method;
  
  // Existing tools...
  switch (toolName) {
    // NEW: Semantic search tools
    case 'search_content_semantic':
      return await executeSemanticSearch(orgId, mcpRequest.params?.arguments, env);
      
    case 'find_similar_projects':
      return await findSimilarProjects(orgId, mcpRequest.params?.arguments, env);
      
    case 'discover_organizations_by_concept':
      return await discoverOrganizations(mcpRequest.params?.arguments, env);
      
    // Existing tools unchanged...
    case 'get_organization_info':
      // ... existing implementation
  }
}

async function executeSemanticSearch(orgId: string, args: any, env: any): Promise<any> {
  const { query, types = ['projects'], limit = 10, threshold = 0.6 } = args;
  
  if (!query?.trim()) {
    throw new Error('Search query is required');
  }
  
  // Generate query embedding
  const embeddingGen = env.EMBEDDING_GENERATOR.get(
    env.EMBEDDING_GENERATOR.idFromName(`org:${orgId}`)
  );
  
  const embeddingResponse = await embeddingGen.fetch(new Request('https://internal/test-embedding', {
    method: 'POST',
    body: JSON.stringify({ text: query })
  }));
  
  const embeddingResult = await embeddingResponse.json();
  if (!embeddingResult.success) {
    throw new Error(`Failed to generate query embedding: ${embeddingResult.error}`);
  }
  
  const queryEmbedding = `[${embeddingResult.embedding.join(',')}]`;
  
  // Search across requested types
  const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
  createDatabaseConnection(env);
  const db = getKysely();
  
  const results = [];
  
  if (types.includes('projects')) {
    const projects = await db
      .selectFrom('projects')
      .select([
        'id', 'name', 'description', 'status', 'priority',
        sql<number>`1 - (description_embedding <=> ${queryEmbedding}::vector) as similarity`,
        sql<string>`'project' as type`
      ])
      .where('organization_id', '=', orgId)
      .where('description_embedding', 'is not', null)
      .where(sql`1 - (description_embedding <=> ${queryEmbedding}::vector)`, '>', threshold)
      .orderBy('similarity', 'desc')
      .limit(Math.ceil(limit * 0.7)) // Allocate 70% to projects
      .execute();
      
    results.push(...projects);
  }
  
  if (types.includes('teams')) {
    const teams = await db
      .selectFrom('teams')
      .select([
        'id', 'name', 'description',
        sql<number>`1 - (description_embedding <=> ${queryEmbedding}::vector) as similarity`,
        sql<string>`'team' as type`
      ])
      .where('organization_id', '=', orgId)
      .where('description_embedding', 'is not', null)
      .where(sql`1 - (description_embedding <=> ${queryEmbedding}::vector)`, '>', threshold)
      .orderBy('similarity', 'desc')
      .limit(Math.ceil(limit * 0.3)) // Allocate 30% to teams
      .execute();
      
    results.push(...teams);
  }
  
  // Sort all results by similarity
  results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  
  return {
    content: [{
      type: "text",
      text: formatSemanticSearchResults(results.slice(0, limit), query)
    }]
  };
}

function formatSemanticSearchResults(results: any[], query: string): string {
  if (results.length === 0) {
    return `No results found for "${query}"`;
  }
  
  let output = `Found ${results.length} results for "${query}":\n\n`;
  
  results.forEach((result, index) => {
    const similarity = (result.similarity * 100).toFixed(1);
    output += `${index + 1}. **${result.name}** (${result.type}) - ${similarity}% match\n`;
    if (result.description) {
      output += `   ${result.description.substring(0, 100)}${result.description.length > 100 ? '...' : ''}\n`;
    }
    output += `   ID: ${result.id}\n\n`;
  });
  
  return output;
}
```

## Phase 3: Testing & Validation (Week 3-4)

### Embedding Model Validation

```typescript
// Test script to validate Gemma dimensions and performance
async function validateEmbeddingModel(): Promise<void> {
  const testTexts = [
    "Building innovative solutions for enterprise clients",
    "Machine learning and artificial intelligence research",
    "Frontend development with React and TypeScript",
    "Database optimization and performance tuning"
  ];
  
  for (const text of testTexts) {
    const response = await env.AI.run('@cf/google/embeddinggemma-300m', { text });
    console.log(`Text: ${text}`);
    console.log(`Dimensions: ${response.data[0].length}`);
    console.log(`Sample values: ${response.data[0].slice(0, 5)}`);
    console.log('---');
  }
}
```

### MCP Tool Testing

```bash
# Test semantic search via MCP
curl -X POST "http://localhost:4000/api/org-actor/01920000-1000-7000-8000-000000000001/mcp/agent" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call_tool", 
    "params": {
      "name": "search_content_semantic",
      "arguments": {
        "query": "machine learning and AI projects",
        "types": ["projects"],
        "limit": 5
      }
    }
  }'
```

## Wrangler Configuration Update

```toml
# Add EmbeddingGeneratorDO
[[durable_objects.bindings]]
name = "EMBEDDING_GENERATOR"
class_name = "EmbeddingGeneratorDO"

# Update migrations
[[migrations]]
tag = "v3"
new_sqlite_classes = ["EmbeddingGeneratorDO"]
```

## Success Metrics

### Phase 1 Success Criteria
- [ ] EmbeddingGeneratorDO successfully generates embeddings for test content
- [ ] WAL changes trigger embedding generation
- [ ] Database correctly stores vector embeddings
- [ ] Basic semantic search returns relevant results

### Phase 2 Success Criteria  
- [ ] MCP semantic search tools work via API
- [ ] Results relevance is good (subjective evaluation)
- [ ] Performance is acceptable (<500ms for searches)
- [ ] Integration with existing MCP tools is seamless

### Phase 3 Success Criteria
- [ ] Embedding pipeline handles realistic content volumes  
- [ ] Error handling and retry logic work correctly
- [ ] Monitoring and observability provide good insights
- [ ] Cost analysis shows reasonable usage patterns

## Next Steps

1. **Immediate**: Test EmbeddingGemma model to determine actual dimensions
2. **Week 1**: Implement basic EmbeddingGeneratorDO with test endpoints
3. **Week 2**: Integrate with ReplicationDO and add MCP semantic search tools
4. **Week 3**: End-to-end testing and performance optimization
5. **Week 4**: Production deployment and monitoring setup

This plan leverages EmbeddingGemma's superior capabilities while building on VibeStack's existing architecture for a seamless semantic search implementation.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Create implementation plan for EmbeddingGemma integration with VibeStack MCP", "status": "completed", "activeForm": "Creating implementation plan for EmbeddingGemma integration with VibeStack MCP"}]