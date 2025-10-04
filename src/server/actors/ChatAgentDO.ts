/**
 * ChatAgentDO - Universal Chat Agent Durable Object
 * Provides AI-powered assistance across all areas of the application
 * Uses route-based tool selection and specialized agents
 */

import { DurableObject } from 'cloudflare:workers';
import { streamText } from 'ai';
import type { Env } from '../types/env';
import { createWorkersAI } from 'workers-ai-provider';
import { orchestratorTools, orchestratorSystemPrompt } from '../ai/agents/orchestrator';
import { processAgentSystemPrompt, processToolKeys } from '../ai/agents/process-agent';
import { createProcessTools } from '../ai/tools/process-tools';

export class ChatAgentDO extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      // Handle chat endpoint
      if (url.pathname === '/chat' && request.method === 'POST') {
        return await this.handleChat(request);
      }

      // Handle status endpoint
      if (url.pathname === '/status' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'active',
          service: 'ChatAgentDO',
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          capabilities: ['process-modeling', 'dataforge', 'analytics', 'tool-calling'],
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('ChatAgentDO error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleChat(request: Request): Promise<Response> {
    console.log('[ChatAgentDO] handleChat called - version: v3.3-70b-fp8-fast');

    const body = await request.json() as {
      messages: Array<{ role: string; content: string }>;
      context: {
        orgId: string;
        userId?: string;
        route: string;
      };
    };

    const { messages, context } = body;
    console.log('[ChatAgentDO] Request context:', { orgId: context.orgId, route: context.route, messageCount: messages.length });

    // Get context function for tools
    const getContext = () => ({
      orgId: context.orgId,
      userId: context.userId,
    });

    // Create all tools
    const processTools = createProcessTools(this.env, getContext);
    const allTools = {
      ...orchestratorTools,
      ...processTools,
    };

    // Create Cloudflare AI provider (official v2-compatible provider)
    const workersai = createWorkersAI({ binding: this.env.AI });
    // Use llama-3.3-70b-instruct-fp8-fast - supports tool calling and is v2-compatible
    const modelName = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    console.log('[ChatAgentDO] Using model:', modelName);
    const model = workersai(modelName);

    // Stream response - simplified without tools for now
    const systemPrompt = context.route.includes('/process-studio')
      ? processAgentSystemPrompt
      : 'You are a helpful assistant for the Elevra platform.';

    console.log('[ChatAgentDO] Calling streamText with model...');

    // Test without tools first to verify model works
    const result = await streamText({
      model,
      messages,
      system: systemPrompt,
      // tools: allTools,
      // maxSteps: 15,
    });

    console.log('[ChatAgentDO] streamText completed, creating response...');

    // Create a Response with the text stream
    // Using textStream for simple streaming (will add data stream protocol later for tools)
    const stream = result.textStream;

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    });
  }
}
