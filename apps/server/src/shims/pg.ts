// Shim for pg package to prevent bundling issues in Cloudflare Workers
// We use Neon's serverless driver instead of the standard pg package

export default {};
export const Pool = class Pool {
  constructor() {
    throw new Error('pg.Pool is not supported in Cloudflare Workers. Use @neondatabase/serverless instead.');
  }
};

export const Client = class Client {
  constructor() {
    throw new Error('pg.Client is not supported in Cloudflare Workers. Use @neondatabase/serverless instead.');
  }
};