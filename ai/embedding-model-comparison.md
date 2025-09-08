# Cloudflare AI Embedding Model Comparison for VibeStack

## Available Models Analysis

### Current Option: `@cf/baai/bge-base-en-v1.5`
**Characteristics:**
- 384 dimensions
- English-focused 
- Proven performance for semantic search
- Well-documented and battle-tested

**Pros:**
- Smaller embedding size (384d = less storage)
- Fast similarity calculations
- Good performance on business/technical content
- Lower memory usage in vector operations

**Cons:**
- English-only (potential limitation for international orgs)
- Smaller model may miss some semantic nuances

### New Option: `@cf/google/embeddinggemma-300m` (Sept 2025)
**Characteristics:**
- 300M parameter model (much larger)
- Multilingual support (100+ languages)
- Built from Gemma 3 and Gemini research
- Designed for RAG and semantic search

**Pros:**
- Multilingual support for global organizations
- Larger model likely captures more semantic nuances
- State-of-the-art architecture from Google
- Optimized specifically for RAG use cases

**Cons:**
- Unknown embedding dimensions (likely 768+ = more storage)
- Potentially higher compute costs
- Newer model = less proven in production
- May be overkill for English-only organizations

## Strategic Recommendation for VibeStack

### **Start with BGE, Add Gemma as Optional Upgrade**

Given VibeStack's architecture flexibility, I recommend a **dual-model approach**:

#### Phase 1: Implement with BGE (Immediate)
```typescript
// Default embedding generation
async function generateEmbedding(text: string, env: any): Promise<number[]> {
  const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: text
  });
  return response.data[0]; // 384-dimensional
}
```

#### Phase 2: Add Gemma Support (Organization-Level Choice)
```typescript
// Enhanced embedding with model selection
async function generateEmbedding(
  text: string, 
  env: any, 
  options: { model?: 'bge' | 'gemma', orgId?: string } = {}
): Promise<number[]> {
  
  const orgSettings = await getOrganizationSettings(options.orgId);
  const model = options.model || orgSettings.embeddingModel || 'bge';
  
  switch (model) {
    case 'gemma':
      const gemmaResponse = await env.AI.run('@cf/google/embeddinggemma-300m', {
        text: text
      });
      return gemmaResponse.data[0]; // Unknown dimensions, likely 768+
      
    case 'bge':
    default:
      const bgeResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: text  
      });
      return bgeResponse.data[0]; // 384 dimensions
  }
}
```

### Database Schema for Multi-Model Support

```sql
-- Add model-specific embedding columns
ALTER TABLE organizations 
  ADD COLUMN lore_embedding_bge vector(384),
  ADD COLUMN lore_embedding_gemma vector(768), -- Assuming 768d for Gemma
  ADD COLUMN embedding_model text DEFAULT 'bge';

ALTER TABLE projects
  ADD COLUMN description_embedding_bge vector(384),
  ADD COLUMN description_embedding_gemma vector(768),
  ADD COLUMN embedding_model text DEFAULT 'bge';

-- Add organization-level embedding preferences
ALTER TABLE organizations 
  ADD COLUMN embedding_preferences jsonb DEFAULT '{
    "model": "bge",
    "autoUpgrade": false,
    "multilingual": false
  }';
```

### Enhanced EmbeddingGeneratorDO

```typescript
class EmbeddingGeneratorDO {
  private async processTableBatch(table: string, jobs: EmbeddingJob[]): Promise<void> {
    const records = await this.fetchRecords(table, jobs.map(j => j.recordId));
    
    // Group jobs by embedding model preference
    const jobsByModel = await this.groupJobsByModel(jobs, records);
    
    // Process each model separately for efficiency
    for (const [model, modelJobs] of Object.entries(jobsByModel)) {
      await this.processModelBatch(model as 'bge' | 'gemma', table, modelJobs, records);
    }
  }

  private async groupJobsByModel(jobs: EmbeddingJob[], records: any[]): Promise<Record<string, EmbeddingJob[]>> {
    const jobsByModel: Record<string, EmbeddingJob[]> = {};
    
    for (const job of jobs) {
      const record = records.find(r => r.id === job.recordId);
      if (!record) continue;
      
      // Determine model based on org preferences or record settings
      const model = await this.determineEmbeddingModel(job.organizationId, record);
      
      if (!jobsByModel[model]) jobsByModel[model] = [];
      jobsByModel[model].push(job);
    }
    
    return jobsByModel;
  }

  private async determineEmbeddingModel(orgId: string, record: any): Promise<'bge' | 'gemma'> {
    // Check organization preferences
    const orgPrefs = await this.getOrgEmbeddingPreferences(orgId);
    
    // Auto-upgrade logic for multilingual content
    if (orgPrefs.autoUpgrade && this.isMultilingualContent(record)) {
      return 'gemma';
    }
    
    return orgPrefs.model || 'bge';
  }

  private isMultilingualContent(record: any): boolean {
    // Simple heuristic - check for non-ASCII characters
    const text = Object.values(record).join(' ');
    return /[^\x00-\x7F]/.test(text);
  }

  private async processModelBatch(
    model: 'bge' | 'gemma',
    table: string, 
    jobs: EmbeddingJob[],
    records: any[]
  ): Promise<void> {
    const embeddingTasks = [];
    
    for (const job of jobs) {
      const record = records.find(r => r.id === job.recordId);
      if (!record) continue;
      
      const textColumns = EMBEDDING_COLUMNS[table];
      for (const column of textColumns) {
        if (record[column]) {
          embeddingTasks.push({
            jobId: job.id,
            table,
            recordId: job.recordId,
            column,
            text: record[column],
            embeddingColumn: `${column}_embedding_${model}`, // Model-specific column
            model
          });
        }
      }
    }
    
    // Generate embeddings with the specified model
    const embeddings = await this.generateEmbeddingsBatchWithModel(
      embeddingTasks.map(task => task.text),
      model
    );
    
    // Update appropriate embedding columns
    await this.updateModelSpecificEmbeddings(embeddingTasks, embeddings, model);
  }
}
```

### Smart Model Selection in MCP Tools

```typescript
// Enhanced semantic search with automatic model selection
'search_projects_semantic': async (args) => {
  const { query, limit = 10, threshold = 0.7 } = args;
  const orgPrefs = await getOrgEmbeddingPreferences(orgId);
  
  // Generate query embedding with org's preferred model
  const queryEmbedding = await generateEmbedding(query, env, { 
    model: orgPrefs.model,
    orgId 
  });
  
  // Search against the appropriate embedding column
  const embeddingColumn = `description_embedding_${orgPrefs.model}`;
  
  const results = await db
    .selectFrom('projects')
    .select([
      'id', 'name', 'description', 'organization_id', 'embedding_model',
      sql<number>`1 - (${sql.identifier([embeddingColumn])} <=> ${queryEmbedding}) as similarity`
    ])
    .where('organization_id', '=', orgId)
    .where(sql.identifier([embeddingColumn]), 'is not', null)
    .where(sql`1 - (${sql.identifier([embeddingColumn])} <=> ${queryEmbedding})`, '>', threshold)
    .orderBy('similarity', 'desc')
    .limit(limit)
    .execute();
    
  return formatSemanticResults(results, orgPrefs.model);
}
```

### Organization-Level Embedding Configuration

```typescript
// New MCP tool for embedding management
'configure_embeddings': async (args) => {
  const { model, autoUpgrade, reprocessAll } = args;
  
  // Validate model
  if (!['bge', 'gemma'].includes(model)) {
    throw new Error('Invalid model. Choose "bge" or "gemma"');
  }
  
  // Update organization preferences
  await db
    .updateTable('organizations')
    .set({
      embedding_preferences: JSON.stringify({
        model,
        autoUpgrade: autoUpgrade || false,
        multilingual: model === 'gemma'
      })
    })
    .where('id', '=', orgId)
    .execute();
  
  // Optionally reprocess all existing content with new model
  if (reprocessAll) {
    await this.triggerBulkReprocessing(orgId, model);
  }
  
  return {
    success: true,
    model,
    message: `Embedding model updated to ${model}${reprocessAll ? ', reprocessing initiated' : ''}`
  };
}
```

## Cost Considerations

### BGE Model (`@cf/baai/bge-base-en-v1.5`)
- **Storage**: 384 dimensions × 4 bytes = 1.5KB per embedding
- **Performance**: Fast similarity calculations
- **Compute**: ~$0.001 per 1K tokens

### Gemma Model (`@cf/google/embeddinggemma-300m`)
- **Storage**: Unknown dimensions (likely 768+) = ~3KB+ per embedding
- **Performance**: More compute for similarity (larger vectors)
- **Compute**: Unknown pricing (likely higher due to 300M parameters)

### Hybrid Approach Benefits
- **Flexibility**: Organizations can choose based on needs
- **Cost Control**: Start with BGE, upgrade to Gemma only when needed
- **Migration Path**: Easy upgrade without losing existing embeddings
- **A/B Testing**: Compare model performance on same content

## Implementation Phases

### Phase 1: BGE Foundation (2-3 weeks)
- Implement EmbeddingGeneratorDO with BGE model
- Add basic semantic search MCP tools
- Validate WAL integration pipeline

### Phase 2: Gemma Integration (3-4 weeks)
- Add Gemma model support to embedding pipeline
- Implement organization-level model preferences
- Create model comparison and migration tools

### Phase 3: Intelligent Selection (4-6 weeks)
- Auto-detection of multilingual content
- Performance benchmarking dashboard
- Cost optimization recommendations

## Recommendation

**Start with BGE** for immediate value and proven performance, then **add Gemma as a premium option** for organizations that need multilingual support or want cutting-edge semantic understanding. This approach provides:

1. **Fast time-to-value** with BGE
2. **Future-proofing** with Gemma option  
3. **Cost control** through intelligent selection
4. **Flexibility** for diverse organizational needs

The dual-model approach aligns perfectly with VibeStack's organization-scoped architecture and provides a clear upgrade path as needs evolve.