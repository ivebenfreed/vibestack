/**
 * Test Parser Route - Development Only
 * 
 * Bypasses authentication to test file parsing functionality directly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ApiEnv } from '../types/api';
import { parseFile, detectFileType } from '../services/file-import/FileParser';

const app = new OpenAPIHono<ApiEnv>();

// Test JSON parsing endpoint
const testJsonRoute = createRoute({
  method: 'post',
  path: '/test-json',
  description: 'Test JSON file parsing (development only)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.string().describe('JSON data as string'),
            filename: z.string().optional().default('test.json')
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Parse result',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            headers: z.array(z.string()),
            total_rows: z.number(),
            detected_columns: z.array(z.object({
              name: z.string(),
              type: z.string(),
              sample_values: z.array(z.string()),
              nullable: z.boolean(),
              confidence: z.number().optional()
            })),
            sample_data: z.array(z.record(z.any())),
            parsing_errors: z.array(z.string()).optional()
          })
        }
      }
    },
    400: {
      description: 'Parsing error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().default(false),
            error: z.string()
          })
        }
      }
    }
  },
  tags: ['Test']
});

app.openapi(testJsonRoute, async (c) => {
  try {
    const { data, filename } = c.req.valid('json');
    
    // Convert string to ArrayBuffer
    const encoder = new TextEncoder();
    const arrayBuffer = encoder.encode(data).buffer;
    
    // Parse the JSON
    const result = await parseFile('json', arrayBuffer, filename);
    
    return c.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Parse test failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    }, 400);
  }
});

// Test CSV parsing endpoint
const testCsvRoute = createRoute({
  method: 'post',
  path: '/test-csv',
  description: 'Test CSV file parsing (development only)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.string().describe('CSV data as string'),
            filename: z.string().optional().default('test.csv')
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Parse result',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            headers: z.array(z.string()),
            total_rows: z.number(),
            detected_columns: z.array(z.object({
              name: z.string(),
              type: z.string(),
              sample_values: z.array(z.string()),
              nullable: z.boolean(),
              confidence: z.number().optional()
            })),
            sample_data: z.array(z.record(z.any())),
            parsing_errors: z.array(z.string()).optional()
          })
        }
      }
    },
    400: {
      description: 'Parsing error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().default(false),
            error: z.string()
          })
        }
      }
    }
  },
  tags: ['Test']
});

app.openapi(testCsvRoute, async (c) => {
  try {
    const { data, filename } = c.req.valid('json');
    
    // Convert string to ArrayBuffer
    const encoder = new TextEncoder();
    const arrayBuffer = encoder.encode(data).buffer;
    
    // Parse the CSV
    const result = await parseFile('csv', arrayBuffer, filename);
    
    return c.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Parse test failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    }, 400);
  }
});

export default app;