interface Env {
  ENVIRONMENT: string;
  API_BASE_URL: string;
  // Add other environment variables as needed
  // If you set up bindings in your wrangler.toml, define their types here.
  // For example, if you have a KV namespace:
  // MY_KV_NAMESPACE: KVNamespace;
  // Or if you have a Durable Object:
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  // Or if you have an R2 bucket:
  // MY_BUCKET: R2Bucket;
  // Note: When using Static Assets, you need to define the ASSETS binding:
  ASSETS: Fetcher;
}

export default {
  // The fetch handler is invoked when a request is made to the Worker.
  // It requires parameters for the request object, environment bindings, and execution context.
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle API requests - proxy to backend worker
    if (url.pathname.startsWith("/api/")) {
      const backendUrl = `${env.API_BASE_URL}${url.pathname}${url.search}`;
      
      return fetch(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }

    // Handle static assets and SPA routing
    // Use the ASSETS binding to serve static files and handle SPA routing
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>; 