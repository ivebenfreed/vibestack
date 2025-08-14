/**
 * Base Entities - Foundation Layer
 * 
 * Enhanced foundation entities adapted from archived DataForge.
 * Provides UUIDv7, audit trails, container access control, and Better Auth compatibility.
 */

export * from './BaseSystemEntity';
export * from './BaseDomainEntity';
export * from './BaseAuthEntity';

export type {
  BaseSystemEntityFields,
  BaseDomainEntityFields,
  BaseAuthEntityFields
} from './BaseSystemEntity';

// Re-export utilities
export {
  UUIDv7Generator,
  AuditTrail,
  ContainerAssignment,
  BetterAuthIntegration
} from './BaseSystemEntity';