/**
 * Specialized error types for sync operations
 */
export class DatabaseError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class CRDTConflictError extends Error {
  constructor(message: string, public readonly details: any) {
    super(message);
    this.name = 'CRDTConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
} 