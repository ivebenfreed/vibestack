/**
 * Generic API Routes
 * 
 * Universal API endpoints that work with any entity
 * Supports CRUD + filtering/sorting/pagination + generated business logic
 */

import { Hono } from 'hono';
import type { ApiEnv } from '../types/api';
import { createGenericAPI } from './generic/GenericApiFactory';
import { entityConfig } from './generic/entity-config';

// Create the generic API router
const generic = createGenericAPI(entityConfig);

export { generic };