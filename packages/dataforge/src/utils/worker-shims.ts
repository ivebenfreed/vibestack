/**
 * Worker shims for Node.js dependencies
 * Makes existing code worker-compatible without rewriting
 */

// File system shim - no actual file operations in worker
export const fs = {
  promises: {
    readFile: async (path: string) => {
      throw new Error(`File system access not available in worker: ${path}`);
    },
    writeFile: async (path: string, data: string) => {
      throw new Error(`File system access not available in worker: ${path}`);
    },
    readdir: async (path: string) => {
      throw new Error(`File system access not available in worker: ${path}`);
    },
    stat: async (path: string) => {
      throw new Error(`File system access not available in worker: ${path}`);
    }
  },
  existsSync: (path: string) => {
    // In worker, we assume entities are already imported
    return false;
  },
  readFileSync: (path: string) => {
    throw new Error(`File system access not available in worker: ${path}`);
  }
};

// Path shim - basic path utilities
export const path = {
  join: (...parts: string[]) => parts.join('/'),
  dirname: (filePath: string) => {
    const parts = filePath.split('/');
    return parts.slice(0, -1).join('/') || '/';
  },
  basename: (filePath: string, ext?: string) => {
    let base = filePath.split('/').pop() || '';
    if (ext && base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
    }
    return base;
  },
  extname: (filePath: string) => {
    const match = filePath.match(/\.[^.]*$/);
    return match ? match[0] : '';
  },
  resolve: (...paths: string[]) => {
    // Simple resolution for worker environment
    return paths.join('/').replace(/\/+/g, '/');
  }
};

// URL shim
export const url = {
  fileURLToPath: (url: string) => {
    if (url.startsWith('file://')) {
      return url.slice(7);
    }
    return url;
  },
  pathToFileURL: (path: string) => {
    return `file://${path}`;
  }
};

// Process shim for environment variables
export const process = {
  env: {} as Record<string, string | undefined>,
  cwd: () => '/',
  nextTick: (callback: () => void) => {
    setTimeout(callback, 0);
  }
};

// Console shim that works in workers
export const console = globalThis.console;

// Buffer shim (basic implementation)
export class Buffer {
  private data: Uint8Array;
  
  constructor(data: Uint8Array | string) {
    if (typeof data === 'string') {
      this.data = new TextEncoder().encode(data);
    } else {
      this.data = data;
    }
  }
  
  static from(data: string | Uint8Array): Buffer {
    return new Buffer(data);
  }
  
  toString(encoding: string = 'utf8'): string {
    if (encoding === 'utf8' || encoding === 'utf-8') {
      return new TextDecoder().decode(this.data);
    }
    throw new Error(`Encoding ${encoding} not supported in worker`);
  }
}