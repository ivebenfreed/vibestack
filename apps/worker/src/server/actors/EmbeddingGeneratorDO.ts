import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types/env';
import { serverLogger } from '../middleware/logger';
import { sql } from 'kysely';

const log = serverLogger;

interface EmbeddingJob {
  id: string;
  table: string;
  recordId: string;
  organizationId: string;
  textContent: Record<string, string>;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  attempts: number;
  createdAt: number;
}

interface ChangeRequest {
  organizationId: string;
  changes: Array<{
    table: string;
    id: string;
    organizationId: string;
    textColumns: Record<string, string>;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    lsn: string;
  }>;
  timestamp: number;
}

/**
 * EmbeddingGeneratorDO - Generates embeddings for text content using Cloudflare AI
 * Integrates with WAL replication to process content changes automatically
 */
export class EmbeddingGeneratorDO extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      switch (url.pathname) {
        case '/process-changes':
          return await this.processChanges(await request.json());
        case '/test-embedding':
          return await this.testEmbedding(await request.json());
        case '/status':
          return await this.getStatus();
        case '/generate-for-project':
          return await this.generateForProject(await request.json());
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      log.error('EmbeddingGeneratorDO error', { 
        error: error instanceof Error ? error.message : String(error),
        pathname: url.pathname 
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Test endpoint to validate EmbeddingGemma model and get dimensions
   */
  private async testEmbedding(request: { text: string }): Promise<Response> {
    const text = request.text || "Testing EmbeddingGemma model with VibeStack content analysis";
    
    log.info('Testing EmbeddingGemma model', { textLength: text.length });
    
    try {
      const startTime = Date.now();
      
      // Test EmbeddingGemma model
      const result = await this.env.AI.run('@cf/google/embeddinggemma-300m', {
        text: text
      });
      
      const duration = Date.now() - startTime;
      const embedding = result.data[0];
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from model');
      }
      
      log.info('EmbeddingGemma test successful', {
        dimensions: embedding.length,
        duration,
        sampleValues: embedding.slice(0, 3)
      });
      
      return new Response(JSON.stringify({
        success: true,
        model: '@cf/google/embeddinggemma-300m',
        dimensions: embedding.length,
        duration,
        textLength: text.length,
        sampleEmbedding: embedding.slice(0, 5), // First 5 values for inspection
        stats: {
          min: Math.min(...embedding),
          max: Math.max(...embedding),
          mean: embedding.reduce((a, b) => a + b, 0) / embedding.length
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      log.error('EmbeddingGemma test failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return new Response(JSON.stringify({
        success: false,
        model: '@cf/google/embeddinggemma-300m',
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Generate embedding for a specific project (for testing)
   */
  private async generateForProject(request: { 
    projectId: string; 
    organizationId: string;
    updateDatabase?: boolean;
  }): Promise<Response> {
    const { projectId, organizationId, updateDatabase = false } = request;
    
    log.info('Generating embedding for project', { projectId, organizationId, updateDatabase });
    
    try {
      // Fetch project content
      const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
      createDatabaseConnection(this.env);
      const db = getKysely();
      
      const project = await db
        .selectFrom('projects')
        .select(['id', 'name', 'description', 'organization_id'])
        .where('id', '=', projectId)
        .where('organization_id', '=', organizationId)
        .executeTakeFirst();
      
      if (!project) {
        return new Response(JSON.stringify({
          success: false,
          error: `Project ${projectId} not found in organization ${organizationId}`
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!project.description?.trim()) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Project has no description to embed'
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Generate embedding
      const startTime = Date.now();
      const embedding = await this.generateEmbedding(project.description);
      const duration = Date.now() - startTime;
      
      let databaseUpdated = false;
      if (updateDatabase) {
        // First, we need to add the embedding column if it doesn't exist
        // For now, we'll just return the embedding without updating
        log.info('Database update requested but embedding column may not exist yet');
      }
      
      return new Response(JSON.stringify({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          descriptionLength: project.description.length
        },
        embedding: {
          dimensions: embedding.length,
          duration,
          databaseUpdated,
          sampleValues: embedding.slice(0, 5)
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      log.error('Failed to generate embedding for project', { 
        projectId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Process WAL changes (for future integration)
   */
  private async processChanges(request: ChangeRequest): Promise<Response> {
    const { organizationId, changes, timestamp } = request;
    
    log.info('Processing embedding changes', { 
      organizationId, 
      changeCount: changes.length,
      timestamp 
    });
    
    // For now, just log the changes - we'll implement actual processing later
    const processedChanges = [];
    
    for (const change of changes) {
      if (change.table === 'projects' && change.textColumns.description) {
        try {
          const embedding = await this.generateEmbedding(change.textColumns.description);
          processedChanges.push({
            id: change.id,
            table: change.table,
            embeddingGenerated: true,
            dimensions: embedding.length
          });
          
          log.info('Generated embedding for project change', {
            projectId: change.id,
            dimensions: embedding.length
          });
        } catch (error) {
          log.error('Failed to generate embedding for change', {
            changeId: change.id,
            error: error instanceof Error ? error.message : String(error)
          });
          
          processedChanges.push({
            id: change.id,
            table: change.table,
            embeddingGenerated: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    return new Response(JSON.stringify({
      organizationId,
      processed: processedChanges.length,
      timestamp: Date.now(),
      changes: processedChanges
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get status of embedding generator
   */
  private async getStatus(): Promise<Response> {
    return new Response(JSON.stringify({
      status: 'active',
      service: 'EmbeddingGeneratorDO',
      model: '@cf/google/embeddinggemma-300m',
      supportedTables: ['projects'],
      supportedColumns: {
        projects: ['description']
      },
      endpoints: {
        testEmbedding: '/test-embedding',
        generateForProject: '/generate-for-project',
        processChanges: '/process-changes',
        status: '/status'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Generate embedding using EmbeddingGemma
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!text?.trim()) {
      throw new Error('Text content is required for embedding generation');
    }
    
    const response = await this.env.AI.run('@cf/google/embeddinggemma-300m', {
      text: text.trim()
    });
    
    const embedding = response.data?.[0];
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from EmbeddingGemma model');
    }
    
    return embedding;
  }
}