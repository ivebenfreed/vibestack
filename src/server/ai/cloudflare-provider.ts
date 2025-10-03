/**
 * Cloudflare Workers AI Provider for Vercel AI SDK
 * Custom provider implementation for Cloudflare's AI binding
 */

import type { LanguageModelV1, LanguageModelV1CallWarning, LanguageModelV1FinishReason, LanguageModelV1StreamPart } from 'ai';
import type { Ai } from '@cloudflare/workers-types';

interface CloudflareAIProviderSettings {
  binding: Ai;
  model?: string;
}

export function createCloudflareAI(settings: CloudflareAIProviderSettings) {
  const provider = (modelId: string): LanguageModelV1 => {
    return new CloudflareLanguageModel(settings.binding, modelId);
  };

  return provider;
}

class CloudflareLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly provider = 'cloudflare';
  readonly defaultObjectGenerationMode = 'tool' as const;
  readonly supportsImageUrls = false;

  constructor(
    private ai: Ai,
    public modelId: string
  ) {}

  async doGenerate(options: Parameters<LanguageModelV1['doGenerate']>[0]): Promise<any> {
    const { prompt, mode, ...rest } = options;

    // Convert AI SDK format to Cloudflare AI format
    const messages = prompt.map((msg: any) => ({
      role: msg.role,
      content: msg.content.map((c: any) => c.text || '').join(''),
    }));

    // Handle tool calling mode
    if (mode.type === 'regular' && mode.tools && Object.keys(mode.tools).length > 0) {
      // Cloudflare AI doesn't support tool calling natively yet
      // We'll need to implement this via prompt engineering
      const toolDescriptions = Object.entries(mode.tools).map(([name, tool]) => {
        return `${name}: ${(tool as any).description}`;
      }).join('\n');

      messages.push({
        role: 'system',
        content: `Available tools:\n${toolDescriptions}\n\nTo use a tool, respond with JSON: {"tool": "toolName", "arguments": {...}}`,
      });
    }

    const response = await this.ai.run(this.modelId as any, {
      messages,
      stream: false,
    }) as any;

    const text = response.response || '';
    const finishReason: LanguageModelV1FinishReason = 'stop';
    const usage = {
      promptTokens: 0,
      completionTokens: 0,
    };

    return {
      text,
      finishReason,
      usage,
      rawCall: { rawPrompt: messages, rawSettings: {} },
      rawResponse: { headers: {} },
      warnings: [] as LanguageModelV1CallWarning[],
    };
  }

  async doStream(options: Parameters<LanguageModelV1['doStream']>[0]): Promise<any> {
    const { prompt } = options;

    const messages = prompt.map((msg: any) => ({
      role: msg.role,
      content: msg.content.map((c: any) => c.text || '').join(''),
    }));

    const response = await this.ai.run(this.modelId as any, {
      messages,
      stream: true,
    }) as ReadableStream;

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      async start(controller) {
        const reader = response.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            controller.enqueue({
              type: 'text-delta',
              textDelta: text,
            });
          }

          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { promptTokens: 0, completionTokens: 0 },
          });
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      stream,
      rawCall: { rawPrompt: messages, rawSettings: {} },
      rawResponse: { headers: {} },
      warnings: [] as LanguageModelV1CallWarning[],
    };
  }
}

export { CloudflareLanguageModel };
