// Minimal worker entry point - no complex imports in top-level scope
import { DurableObject } from 'cloudflare:workers';

// Simple Durable Object classes that don't extend from problematic base classes
export class SyncDO extends DurableObject {
  private state: DurableObjectState;
  private env: any;
  
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    // Dynamic import to avoid top-level scope issues
    const { SyncDO: SyncDOImpl } = await import('./src/server/sync/SyncDO');
    const impl = new SyncDOImpl(this.state, this.env);
    return impl.fetch(request);
  }
}

export class ReplicationDO extends DurableObject {
  private state: DurableObjectState;
  private env: any;
  
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const { ReplicationDO: ReplicationDOImpl } = await import('./src/server/replication/ReplicationDO');
    const impl = new ReplicationDOImpl(this.state, this.env);
    return impl.fetch(request);
  }
}

export class OrganizationActor extends DurableObject {
  private state: DurableObjectState;
  private env: any;
  
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const { OrganizationActor: OrganizationActorImpl } = await import('./src/server/actors/OrganizationActor');
    const impl = new OrganizationActorImpl(this.state, this.env);
    return impl.fetch(request);
  }
}

export class EmbeddingGeneratorDO extends DurableObject {
  private state: DurableObjectState;
  private env: any;
  
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const { EmbeddingGeneratorDO: EmbeddingGeneratorDOImpl } = await import('./src/server/actors/EmbeddingGeneratorDO');
    const impl = new EmbeddingGeneratorDOImpl(this.state, this.env);
    return impl.fetch(request);
  }
}

// Dynamic import for main worker to avoid top-level scope issues
const worker = {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const workerModule = await import('./src/server/index');
    return workerModule.default.fetch(request, env, ctx);
  }
};

export default worker
