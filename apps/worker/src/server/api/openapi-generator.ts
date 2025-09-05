import { OpenAPIHono } from '@hono/zod-openapi';
import { OpenAPIObject } from 'openapi3-ts/oas30';
import type { Context } from 'hono';

/**
 * Generates a complete OpenAPI specification by merging specs from multiple OpenAPIHono routers
 * This allows us to have a unified documentation endpoint that includes all API routes
 */
export async function generateCompleteOpenAPISpec(
  routers: { app: OpenAPIHono<any>; basePath?: string }[],
  baseConfig: {
    openapi: string;
    info: {
      title: string;
      version: string;
      description?: string;
    };
    servers?: Array<{
      url: string;
      description?: string;
    }>;
  }
): Promise<OpenAPIObject> {
  // Start with base configuration
  const mergedSpec: OpenAPIObject = {
    openapi: baseConfig.openapi,
    info: baseConfig.info,
    servers: baseConfig.servers || [],
    paths: {},
    components: {
      schemas: {},
      responses: {},
      parameters: {},
      securitySchemes: {},
    },
    tags: [],
  };

  // Collect and merge specs from all routers
  for (const { app, basePath } of routers) {
    if (!app.getOpenAPIDocument) {
      console.warn('Router does not have getOpenAPIDocument method, skipping');
      continue;
    }

    try {
      console.log(`Generating OpenAPI spec for router with basePath: ${basePath || '(root)'}`);
      // Generate OpenAPI document for this router
      const routerSpec = app.getOpenAPIDocument({
        openapi: baseConfig.openapi,
        info: baseConfig.info,
        servers: baseConfig.servers || [],
      });

      // Merge paths (with basePath prefix if provided)
      if (routerSpec.paths) {
        for (const [path, pathItem] of Object.entries(routerSpec.paths)) {
          const fullPath = basePath ? `${basePath}${path}` : path;
          mergedSpec.paths[fullPath] = pathItem;
        }
      }

      // Merge components
      if (routerSpec.components) {
        if (routerSpec.components.schemas) {
          Object.assign(mergedSpec.components!.schemas!, routerSpec.components.schemas);
        }
        if (routerSpec.components.responses) {
          Object.assign(mergedSpec.components!.responses!, routerSpec.components.responses);
        }
        if (routerSpec.components.parameters) {
          Object.assign(mergedSpec.components!.parameters!, routerSpec.components.parameters);
        }
        if (routerSpec.components.securitySchemes) {
          Object.assign(mergedSpec.components!.securitySchemes!, routerSpec.components.securitySchemes);
        }
      }

      // Merge tags (avoiding duplicates)
      if (routerSpec.tags) {
        const existingTagNames = new Set(mergedSpec.tags?.map(t => t.name) || []);
        for (const tag of routerSpec.tags) {
          if (!existingTagNames.has(tag.name)) {
            mergedSpec.tags!.push(tag);
            existingTagNames.add(tag.name);
          }
        }
      }
    } catch (error) {
      console.error(`Error generating OpenAPI spec for router with basePath '${basePath || '(root)'}':`, error);
    }
  }

  return mergedSpec;
}

/**
 * Creates an endpoint handler that generates complete OpenAPI documentation
 */
export function createOpenAPIEndpoint(
  routers: { app: OpenAPIHono<any>; basePath?: string }[],
  config?: Partial<{
    openapi: string;
    info: {
      title: string;
      version: string;
      description?: string;
    };
    servers?: Array<{
      url: string;
      description?: string;
    }>;
  }>
) {
  return async (c: Context) => {
    const baseConfig = {
      openapi: config?.openapi || '3.0.0',
      info: {
        title: config?.info?.title || 'API Documentation',
        version: config?.info?.version || '1.0.0',
        description: config?.info?.description,
      },
      servers: config?.servers || [
        {
          url: 'http://localhost:4000/api',
          description: 'Development server',
        },
      ],
    };

    const spec = await generateCompleteOpenAPISpec(routers, baseConfig);
    return c.json(spec);
  };
}