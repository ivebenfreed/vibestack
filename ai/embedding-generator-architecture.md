# EmbeddingGeneratorDO: WAL-Based Embedding Pipeline

## Overview

The `EmbeddingGeneratorDO` integrates with VibeStack's existing WAL polling replication system to automatically generate embeddings for text-rich content as it changes in the database. This ensures embeddings are always current without blocking user operations.

## Architecture Integration

### Leveraging Existing WAL Infrastructure

```
PostgreSQL WAL → ReplicationDO → EmbeddingGeneratorDO → pgvector columns
                     ↓
              OrganizationActor (for MCP queries)
```

The `EmbeddingGeneratorDO` sits downstream of the existing `ReplicationDO`, receiving filtered change notifications for embedding-relevant content.

### Durable Object Design

```typescript
export class EmbeddingGeneratorDO {
  private state: DurableObjectState;
  private env: Env;
  private processingQueue: Map<string, EmbeddingJob> = new Map();
  private batchProcessor: BatchProcessor;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.batchProcessor = new BatchProcessor(this.processBatch.bind(this), {
      maxSize: 10,        // Process up to 10 embeddings at once
      maxWait: 2000,      // Wait max 2 seconds before processing batch
      maxRetries: 3
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/process-changes':
        return await this.processChanges(await request.json());
      case '/status':
        return await this.getStatus();
      case '/retry-failed':
        return await this.retryFailed();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
}
```

## WAL Integration Points

### ReplicationDO Enhancement

```typescript
// Enhanced ReplicationDO to forward embedding-relevant changes
export class ReplicationDO {
  async processChanges(changes: WALChange[]) {
    // Existing sync processing
    await this.processSyncChanges(changes);
    
    // NEW: Forward embedding-relevant changes
    const embeddingChanges = this.filterEmbeddingRelevantChanges(changes);
    if (embeddingChanges.length > 0) {
      await this.forwardToEmbeddingGenerator(embeddingChanges);
    }
  }

  private filterEmbeddingRelevantChanges(changes: WALChange[]): EmbeddingChange[] {
    return changes
      .filter(change => EMBEDDING_TABLES.includes(change.table))
      .filter(change => EMBEDDING_COLUMNS[change.table].some(col => 
        change.columnnames?.includes(col)
      ))
      .map(change => ({
        table: change.table,
        id: change.columnvalues[change.columnnames.indexOf('id')],
        organizationId: this.extractOrgId(change),
        textColumns: this.extractTextColumns(change),
        operation: change.kind, // INSERT, UPDATE, DELETE
        lsn: change.lsn
      }));
  }

  private async forwardToEmbeddingGenerator(changes: EmbeddingChange[]) {
    // Group changes by organization for efficient processing
    const changesByOrg = groupBy(changes, 'organizationId');
    
    for (const [orgId, orgChanges] of Object.entries(changesByOrg)) {
      const embeddingGenId = this.env.EMBEDDING_GENERATOR.idFromName(`org:${orgId}`);
      const embeddingGen = this.env.EMBEDDING_GENERATOR.get(embeddingGenId);
      
      await embeddingGen.fetch(new Request('https://internal/process-changes', {
        method: 'POST',
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

### Embedding Configuration

```typescript
// Tables and columns that need embeddings
const EMBEDDING_TABLES = [
  'organizations',
  'projects', 
  'teams',
  'tasks',
  'user_notes',
  'comments'
];

const EMBEDDING_COLUMNS = {
  'organizations': ['lore'],
  'projects': ['description', 'name'],
  'teams': ['description', 'name'],
  'tasks': ['description', 'content'],
  'user_notes': ['content'],
  'comments': ['content']
};

const EMBEDDING_COLUMN_MAP = {
  'organizations': { 
    'lore': 'lore_embedding' 
  },
  'projects': { 
    'description': 'description_embedding',
    'name': 'name_embedding'
  },
  'teams': { 
    'description': 'description_embedding',
    'name': 'name_embedding' 
  }
};
```

## EmbeddingGeneratorDO Implementation

### Core Processing Logic

```typescript
interface EmbeddingJob {
  id: string;
  table: string;
  recordId: string;
  organizationId: string;
  textContent: Record<string, string>;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  priority: number;
  attempts: number;
  createdAt: number;
  scheduledFor: number;
}

class EmbeddingGeneratorDO {
  async processChanges(request: ChangeRequest): Promise<Response> {
    const { organizationId, changes, timestamp } = request;
    
    // Convert WAL changes to embedding jobs
    const jobs = changes.map(change => this.createEmbeddingJob(change, timestamp));
    
    // Queue jobs for batch processing
    for (const job of jobs) {
      await this.queueJob(job);
    }
    
    return new Response(JSON.stringify({ 
      queued: jobs.length,
      organizationId 
    }));
  }

  private createEmbeddingJob(change: EmbeddingChange, timestamp: number): EmbeddingJob {
    return {
      id: `${change.table}:${change.id}:${timestamp}`,
      table: change.table,
      recordId: change.id,
      organizationId: change.organizationId,
      textContent: change.textColumns,
      operation: change.operation,
      priority: this.calculatePriority(change.table, change.operation),
      attempts: 0,
      createdAt: timestamp,
      scheduledFor: timestamp + this.getDelay(change.table)
    };
  }

  private calculatePriority(table: string, operation: string): number {
    // Higher priority for user-visible content
    const tablePriority = {
      'organizations': 5,
      'projects': 4,
      'teams': 3,
      'tasks': 2,
      'comments': 1
    };
    
    // Updates get higher priority than inserts
    const operationBonus = operation === 'UPDATE' ? 1 : 0;
    
    return (tablePriority[table] || 1) + operationBonus;
  }

  private getDelay(table: string): number {
    // Delay embedding generation to batch similar operations
    return {
      'organizations': 0,      // Immediate - rare updates
      'projects': 5000,        // 5 second delay
      'teams': 10000,          // 10 second delay  
      'tasks': 30000,          // 30 second delay
      'comments': 60000        // 1 minute delay
    }[table] || 30000;
  }
}
```

### Batch Processing Engine

```typescript
class BatchProcessor {
  private queue: EmbeddingJob[] = [];
  private processing = false;

  async processBatch(jobs: EmbeddingJob[]): Promise<void> {
    const jobsByTable = groupBy(jobs, 'table');
    
    for (const [table, tableJobs] of Object.entries(jobsByTable)) {
      await this.processTableBatch(table, tableJobs);
    }
  }

  private async processTableBatch(table: string, jobs: EmbeddingJob[]): Promise<void> {
    // Fetch current content from database
    const records = await this.fetchRecords(table, jobs.map(j => j.recordId));
    
    // Generate embeddings for all text content
    const embeddingTasks = [];
    
    for (const job of jobs) {
      const record = records.find(r => r.id === job.recordId);
      if (!record) continue; // Record might have been deleted
      
      const textColumns = EMBEDDING_COLUMNS[table];
      for (const column of textColumns) {
        if (record[column]) {
          embeddingTasks.push({
            jobId: job.id,
            table,
            recordId: job.recordId,
            column,
            text: record[column],
            embeddingColumn: EMBEDDING_COLUMN_MAP[table][column]
          });
        }
      }
    }
    
    // Batch generate embeddings using Cloudflare AI
    const embeddings = await this.generateEmbeddingsBatch(
      embeddingTasks.map(task => task.text)
    );
    
    // Update database with embeddings
    await this.updateEmbeddings(embeddingTasks, embeddings);
  }

  private async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    // Use Cloudflare AI batch processing for efficiency
    const batchSize = 10;
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(text => this.env.AI.run('@cf/baai/bge-base-en-v1.5', { text }))
      );
      
      results.push(...batchResults.map(r => r.data[0]));
    }
    
    return results;
  }

  private async updateEmbeddings(tasks: EmbeddingTask[], embeddings: number[][]): Promise<void> {
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(this.env);
    const db = getKysely();
    
    // Group updates by table for efficient batch updates
    const updatesByTable = groupBy(tasks, 'table');
    
    for (const [table, tableTasks] of Object.entries(updatesByTable)) {
      const cases = tableTasks.map((task, index) => 
        `WHEN id = '${task.recordId}' THEN '[${embeddings[index].join(',')}]'::vector`
      ).join(' ');
      
      const ids = tableTasks.map(task => `'${task.recordId}'`).join(',');
      const embeddingColumn = tableTasks[0].embeddingColumn;
      
      await db.executeQuery(sql`
        UPDATE ${sql.identifier([table])}
        SET ${sql.identifier([embeddingColumn])} = CASE ${sql.raw(cases)} END
        WHERE id IN (${sql.raw(ids)})
      `);
    }
  }
}
```

### Error Handling and Retry Logic

```typescript
class EmbeddingGeneratorDO {
  private async handleFailedJob(job: EmbeddingJob, error: Error): Promise<void> {
    job.attempts++;
    
    const maxRetries = 3;
    const backoffMs = Math.pow(2, job.attempts) * 1000; // Exponential backoff
    
    if (job.attempts < maxRetries) {
      // Schedule retry
      job.scheduledFor = Date.now() + backoffMs;
      await this.requeueJob(job);
      
      console.warn(`Embedding job ${job.id} failed, scheduling retry ${job.attempts}/${maxRetries}:`, error);
    } else {
      // Move to dead letter queue
      await this.state.storage.put(`failed:${job.id}`, job);
      
      console.error(`Embedding job ${job.id} permanently failed after ${maxRetries} attempts:`, error);
    }
  }

  private async retryFailed(): Promise<Response> {
    const failed = await this.state.storage.list({ prefix: 'failed:' });
    const retried = [];
    
    for (const [key, job] of failed) {
      job.attempts = 0;
      job.scheduledFor = Date.now();
      await this.queueJob(job);
      await this.state.storage.delete(key);
      retried.push(job.id);
    }
    
    return new Response(JSON.stringify({ retriedJobs: retried.length }));
  }
}
```

## Database Schema Changes

```sql
-- Add embedding columns to existing tables
ALTER TABLE organizations ADD COLUMN lore_embedding vector(384);
ALTER TABLE projects ADD COLUMN description_embedding vector(384), 
                           ADD COLUMN name_embedding vector(384);
ALTER TABLE teams ADD COLUMN description_embedding vector(384),
                        ADD COLUMN name_embedding vector(384);

-- Add metadata tracking
ALTER TABLE organizations ADD COLUMN embedding_updated_at timestamptz;
ALTER TABLE projects ADD COLUMN embedding_updated_at timestamptz;
ALTER TABLE teams ADD COLUMN embedding_updated_at timestamptz;

-- Indexes for vector similarity search
CREATE INDEX CONCURRENTLY organizations_lore_embedding_idx 
  ON organizations USING ivfflat (lore_embedding vector_cosine_ops) 
  WITH (lists = 100);

CREATE INDEX CONCURRENTLY projects_description_embedding_idx
  ON projects USING ivfflat (description_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX CONCURRENTLY projects_name_embedding_idx  
  ON projects USING ivfflat (name_embedding vector_cosine_ops)
  WITH (lists = 100);
```

## Wrangler Configuration

```toml
# Add EmbeddingGeneratorDO binding
[[durable_objects.bindings]]
name = "EMBEDDING_GENERATOR"
class_name = "EmbeddingGeneratorDO"

# Update migrations
[[migrations]]
tag = "v3"
new_sqlite_classes = ["EmbeddingGeneratorDO"]
```

## Benefits of This Architecture

### **Seamless Integration**
- Leverages existing WAL infrastructure
- No changes needed to application code
- Automatic embedding updates on data changes

### **Performance Optimized**
- Batched embedding generation
- Delayed processing to batch similar operations  
- Organization-scoped processing for isolation

### **Reliable & Resilient**
- Retry logic with exponential backoff
- Dead letter queue for permanently failed jobs
- Status monitoring and manual retry capabilities

### **Cost Efficient**
- Batched API calls to Cloudflare AI
- Intelligent delays to reduce redundant embeddings
- Only processes changed content

## Usage in MCP Tools

```typescript
// Enhanced semantic search with WAL-synced embeddings
'search_projects_semantic': async (args) => {
  const { query, limit = 10, threshold = 0.7 } = args;
  
  const queryEmbedding = await generateEmbedding(query, env);
  
  const results = await db
    .selectFrom('projects')
    .select([
      'id', 'name', 'description', 'organization_id',
      'embedding_updated_at',
      sql<number>`1 - (description_embedding <=> ${queryEmbedding}) as similarity`
    ])
    .where('organization_id', '=', orgId)
    .where('description_embedding', 'is not', null) // Only search records with embeddings
    .where(sql`1 - (description_embedding <=> ${queryEmbedding})`, '>', threshold)
    .orderBy('similarity', 'desc')
    .limit(limit)
    .execute();
    
  return formatSemanticResults(results);
}
```

This architecture ensures that semantic search is always working with current data while being completely non-blocking for user operations. The embeddings are generated asynchronously and efficiently through the existing WAL pipeline.

## Implementation Status & Test Results

### ✅ Current Implementation (September 2025)

**EmbeddingGeneratorDO Successfully Implemented** using **EmbeddingGemma** model (`@cf/google/embeddinggemma-300m`) instead of the originally planned BGE model.

#### Key Implementation Changes:
- **Model**: `@cf/google/embeddinggemma-300m` (768 dimensions vs planned 384)
- **Architecture**: Organization-scoped DOs with direct HTTP API access
- **Integration**: Connected via OrganizationActor router for seamless MCP integration

#### Live Test Results (Wide Corp Organization)

**Test Date**: September 8, 2025  
**Environment**: Local development (localhost:4000)  
**Authentication**: CEO role (ceo@widecorp.com)

| Project | Description Length | Generation Time | Embedding Dimensions | Status |
|---------|-------------------|-----------------|---------------------|---------|
| Client Project Alpha | 36 chars | 1,452ms | 768 | ✅ Success |
| Sales Pipeline Q4 | 36 chars | 466ms | 768 | ✅ Success |  
| Mobile App Development | 49 chars | 699ms | 768 | ✅ Success |

#### Performance Characteristics:
- **Average Generation Time**: ~870ms for typical project descriptions
- **Embedding Quality**: High-quality 768-dimensional vectors with consistent output
- **API Response Format**:
  ```json
  {
    "success": true,
    "projectId": "01920000-1003-7003-8003-000000000003",
    "organizationId": "01920000-1000-7000-8000-000000000001", 
    "generationResult": {
      "project": {
        "id": "01920000-1003-7003-8003-000000000003",
        "name": "Client Project Alpha",
        "descriptionLength": 36
      },
      "embedding": {
        "dimensions": 768,
        "duration": 1452,
        "databaseUpdated": false,
        "sampleValues": [-0.1768959, 0.0130951, 0.0051200, -0.0068501, -0.0089383]
      }
    }
  }
  ```

#### API Endpoints Available:
- `GET /api/org-actor/{orgId}/test-embedding` - Basic embedding test
- `GET /api/org-actor/{orgId}/generate-for-project/{projectId}` - Generate embeddings for specific projects

#### Architecture Benefits Realized:
- **Organization Isolation**: Each org has its own EmbeddingGeneratorDO instance
- **Authentication Integration**: Seamless integration with existing Better Auth system
- **MCP Ready**: Direct integration path for semantic search MCP tools
- **Development Friendly**: Real-time testing and debugging capabilities

### Next Steps for Full WAL Integration:
1. **Database Schema**: Add vector columns to projects table (768 dimensions)
2. **WAL Integration**: Connect ReplicationDO to automatically trigger embeddings
3. **Semantic Search**: Implement MCP tools using pgvector similarity search
4. **Batch Processing**: Enable `updateDatabase: true` for persistent storage
5. **Performance Optimization**: Implement batching for multiple projects

The foundation is solid and ready for production-scale semantic search capabilities.