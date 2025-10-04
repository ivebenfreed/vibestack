/**
 * ChatAgentDO - Universal Chat Agent Durable Object
 * Provides AI-powered assistance across all areas of the application
 * Uses route-based tool selection and specialized agents
 */

import { DurableObject } from 'cloudflare:workers';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';
import type { Env } from '../types/env';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
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

    // Capture tool execution results outside AI SDK (workaround for Gemini)
    const toolExecutionLog: Array<{ tool: string; args: any; result: any }> = [];

    // Create process tools without wrapper for now - test if they work
    console.log('[ChatAgentDO] Creating process tools (no wrapper)...');
    const rawProcessTools = createProcessTools(this.env, getContext);

    const essentialToolNames = ['process.list', 'process.create'];
    const allTools: Record<string, any> = {};
    for (const toolName of essentialToolNames) {
      if (rawProcessTools[toolName]) {
        allTools[toolName] = rawProcessTools[toolName];
      }
    }

    console.log('[ChatAgentDO] Tools created:', Object.keys(allTools).length, 'process tools');


    // Create Google Gemini provider
    console.log('[ChatAgentDO] Initializing Google Gemini provider...');
    console.log('[ChatAgentDO] API key available?:', !!this.env.GOOGLE_GENERATIVE_AI_API_KEY);
    console.log('[ChatAgentDO] API key length:', this.env.GOOGLE_GENERATIVE_AI_API_KEY?.length || 0);

    if (!this.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');
    }

    const google = createGoogleGenerativeAI({
      apiKey: this.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });

    // Use Gemini 2.5 Flash - better tool calling than Lite version
    const modelName = 'gemini-2.5-flash-preview-09-2025';
    console.log('[ChatAgentDO] Using model:', modelName);
    const model = google(modelName);
    console.log('[ChatAgentDO] Model created:', typeof model);

    // Stream response - simplified without tools for now
    const systemPrompt = context.route.includes('/process-studio')
      ? processAgentSystemPrompt
      : 'You are a helpful assistant for the Elevra platform.';

    console.log('[ChatAgentDO] System prompt selected:', systemPrompt.substring(0, 100) + '...');
    console.log('[ChatAgentDO] Calling streamText with model...');
    console.log('[ChatAgentDO] Tool calling: ENABLED with', Object.keys(allTools).length, 'tools');

    try {
      // Enable tools for AI agent functionality with Gemini
      console.log('[ChatAgentDO] About to call streamText with tools...');
      console.log('[ChatAgentDO] Messages:', messages.length, 'messages');
      console.log('[ChatAgentDO] System prompt length:', systemPrompt.length);

      // Use generateText with tool calling
      const result = await generateText({
        model,
        messages,
        system: systemPrompt,
        tools: allTools,
        maxSteps: 5,
      });

      console.log('[ChatAgentDO] generateText completed');
      console.log('[ChatAgentDO] result.text length:', result.text?.length || 0);
      console.log('[ChatAgentDO] result.toolCalls:', result.toolCalls?.length || 0);
      console.log('[ChatAgentDO] result.toolResults:', result.toolResults?.length || 0);
      console.log('[ChatAgentDO] result.steps:', result.steps?.length || 0);

      // Log steps since top-level calls/results are empty
      if (result.steps) {
        result.steps.forEach((step, i) => {
          console.log(`[ChatAgentDO] Step ${i}: toolCalls=${step.toolCalls?.length || 0}, toolResults=${step.toolResults?.length || 0}, text=${step.text?.length || 0}`);

          if (step.toolCalls) {
            step.toolCalls.forEach((call, j) => {
              console.log(`[ChatAgentDO] Step ${i} tool ${j}:`, call.toolName, 'args:', call.args);
            });
          }
          if (step.toolResults) {
            step.toolResults.forEach((res, j) => {
              console.log(`[ChatAgentDO] Step ${i} result ${j}:`, res.result);
            });
          }
        });
      }

      // Use our execution log since AI SDK doesn't preserve data properly
      let responseText = result.text || '';

      if (!responseText && toolExecutionLog.length > 0) {
        responseText = '✅ Tool Execution Complete!\n\n';

        toolExecutionLog.forEach((execution, i) => {
          responseText += `**Tool ${i + 1}:** \`${execution.tool}\`\n`;
          responseText += `**Arguments:**\n\`\`\`json\n${JSON.stringify(execution.args, null, 2)}\n\`\`\`\n\n`;
          responseText += `**Result:**\n\`\`\`json\n${JSON.stringify(execution.result, null, 2)}\n\`\`\`\n\n`;
        });

        responseText += `_${toolExecutionLog.length} tool(s) executed successfully_\n`;
      }

      return new Response(responseText || 'No response generated', {
        headers: { 'Content-Type': 'text/plain' },
      });
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
