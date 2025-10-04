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
    const startTime = Date.now();
    console.log('[ChatAgentDO] ===== NEW CHAT REQUEST =====');
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
    console.log('[ChatAgentDO] Request context:', {
      orgId: context.orgId,
      route: context.route,
      userId: context.userId,
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]?.content.substring(0, 100)
    });

    // Get context function for tools
    const getContext = () => ({
      orgId: context.orgId,
      userId: context.userId,
    });

    // Create all tools
    console.log('[ChatAgentDO] Creating process tools...');
    const processTools = createProcessTools(this.env, getContext);
    const allTools = {
      ...orchestratorTools,
      ...processTools,
    };
    console.log('[ChatAgentDO] Tools created:', Object.keys(allTools).length, 'tools available');
    console.log('[ChatAgentDO] Tool list:', Object.keys(allTools).join(', '));

    // Create Cloudflare AI provider (official v2-compatible provider)
    console.log('[ChatAgentDO] Initializing Workers AI provider...');
    console.log('[ChatAgentDO] AI binding available?:', !!this.env.AI);
    console.log('[ChatAgentDO] AI binding type:', typeof this.env.AI);

    const workersai = createWorkersAI({ binding: this.env.AI });
    console.log('[ChatAgentDO] WorkersAI provider created:', typeof workersai);
    console.log('[ChatAgentDO] Has .chat() method?:', typeof workersai.chat);

    // Use llama-3.3-70b-instruct-fp8-fast - supports tool calling and is v2-compatible
    const modelName = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    console.log('[ChatAgentDO] Using model:', modelName);
    // IMPORTANT: Use .chat() method for AI SDK v5 compatibility
    const model = workersai.chat(modelName);
    console.log('[ChatAgentDO] Model created:', typeof model);
    console.log('[ChatAgentDO] Model specificationVersion:', model.specificationVersion);
    console.log('[ChatAgentDO] Model provider:', model.provider);

    // Stream response - simplified without tools for now
    const systemPrompt = context.route.includes('/process-studio')
      ? processAgentSystemPrompt
      : 'You are a helpful assistant for the Elevra platform.';

    console.log('[ChatAgentDO] System prompt selected:', systemPrompt.substring(0, 100) + '...');
    console.log('[ChatAgentDO] Calling streamText with model...');
    console.log('[ChatAgentDO] Tool calling: ENABLED with', Object.keys(allTools).length, 'tools');

    try {
      // Enable tools for AI agent functionality
      console.log('[ChatAgentDO] About to call streamText...');
      const result = await streamText({
        model,
        messages,
        system: systemPrompt,
        tools: allTools,
        maxSteps: 15,
      });

      console.log('[ChatAgentDO] streamText completed successfully');
      console.log('[ChatAgentDO] Result keys:', Object.keys(result));
      console.log('[ChatAgentDO] Has toTextStreamResponse?:', typeof result.toTextStreamResponse);
      console.log('[ChatAgentDO] Creating stream response...');

      // Use AI SDK text stream response for streaming
      const response = result.toTextStreamResponse({
        headers: {
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });

      console.log('[ChatAgentDO] Response created:', response.constructor.name);
      console.log('[ChatAgentDO] Response headers:', Object.fromEntries(response.headers.entries()));

      const elapsed = Date.now() - startTime;
      console.log('[ChatAgentDO] Request completed in', elapsed, 'ms');
      console.log('[ChatAgentDO] ===== RESPONSE STREAMING (with tools) =====');

      return response;
    } catch (error) {
      console.error('[ChatAgentDO] ERROR in streamText:', error);
      console.error('[ChatAgentDO] Error type:', error?.constructor?.name);
      console.error('[ChatAgentDO] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[ChatAgentDO] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      // Return error as JSON
      return new Response(JSON.stringify({
        error: 'AI processing failed',
        message: error instanceof Error ? error.message : String(error),
        type: error?.constructor?.name || 'UnknownError'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}
