import type { Env } from './env';

/**
 * Service error types for API responses
 */
export enum ServiceErrorType {
  INTERNAL = 'INTERNAL',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN'
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T> {
  ok: true;
  data: T;
}

/**
 * Error response wrapper
 */
export interface ErrorResponse {
  ok: false;
  error: {
    type: ServiceErrorType;
    message: string;
  };
}

/**
 * Helper to create a success response
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    ok: true,
    data
  };
}

/**
 * Helper to create an error response
 */
export function createErrorResponse(type: ServiceErrorType, message: string): ErrorResponse {
  return {
    ok: false,
    error: {
      type,
      message
    }
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Paged response wrapper
 */
export interface PagedResponse<T> {
  ok: true;
  data: T[];
  meta: PaginationMeta;
}

/**
 * Helper to create a paged response
 */
export function createPagedResponse<T>(data: T[], meta: PaginationMeta): PagedResponse<T> {
  return {
    ok: true,
    data,
    meta
  };
}

/**
 * API environment type for Hono routes
 */
import type { AppBindings } from './hono'; // Import AppBindings

/**
 * API environment type for Hono routes
 */
export type ApiEnv = AppBindings;