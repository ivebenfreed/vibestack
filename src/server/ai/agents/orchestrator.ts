/**
 * Orchestrator Agent - Route Detection and Tool Selection
 * Detects the user's current context and activates appropriate specialized agents
 */

import { tool } from 'ai';
import { z } from 'zod';

export const orchestratorTools = {
  'route.detect': tool({
    description: 'Detect the current application route and user intent to determine which specialized tools to use. This should be the first tool called in every conversation.',
    parameters: z.object({
      url: z.string().describe('Current URL path (e.g., "/org/123/process-studio")'),
      userMessage: z.string().describe('The user\'s message to analyze for intent'),
    }),
    execute: async ({ url, userMessage }) => {
      // Detect route from URL
      let route = 'general';
      let toolSet: string[] = [];
      let systemPrompt = '';

      if (url.includes('/process-studio')) {
        route = 'process';
        toolSet = [
          'process.list', 'process.get', 'process.create', 'process.update', 'process.publish', 'process.delete',
          'node.list', 'node.create', 'node.update', 'node.delete',
          'connection.list', 'connection.create', 'connection.delete',
          'lane.list', 'lane.create', 'lane.delete',
        ];
        systemPrompt = `You are a BPMN process modeling expert assistant. You help users create, modify, and optimize business processes using BPMN 2.0 notation.

Key capabilities:
- Create and manage process definitions
- Add nodes (tasks, events, gateways) to process diagrams
- Connect nodes with sequence flows
- Organize processes with swimlanes
- Explain BPMN concepts and best practices

When creating processes:
1. Start with a start_event node
2. Add task nodes for each step
3. Use gateways for decision points (exclusive_gateway for OR, parallel_gateway for AND)
4. End with an end_event node
5. Connect all nodes with sequence flows

Be conversational and helpful. Ask clarifying questions when needed.`;
      } else if (url.includes('/dataforge') || url.includes('/entities')) {
        route = 'dataforge';
        toolSet = []; // DataForge tools will be added later
        systemPrompt = 'You are a DataForge assistant helping with dynamic entity management.';
      } else if (url.includes('/analytics')) {
        route = 'analytics';
        toolSet = []; // Analytics tools will be added later
        systemPrompt = 'You are an analytics assistant helping with data insights and reports.';
      } else {
        route = 'general';
        toolSet = [];
        systemPrompt = 'You are a helpful assistant for the Elevra platform.';
      }

      return {
        route,
        toolSet,
        systemPrompt,
        detectedIntent: userMessage.toLowerCase().includes('create') ? 'create' :
                       userMessage.toLowerCase().includes('update') ? 'update' :
                       userMessage.toLowerCase().includes('delete') ? 'delete' :
                       userMessage.toLowerCase().includes('list') || userMessage.toLowerCase().includes('show') ? 'read' :
                       'general',
      };
    },
  }),
};

export const orchestratorSystemPrompt = `You are an intelligent routing assistant. Your job is to:

1. First, call the route.detect tool to understand the user's context
2. Based on the detected route, use the appropriate specialized tools
3. Provide helpful, context-aware responses

Always start by detecting the route, then proceed with the specialized tools.`;
