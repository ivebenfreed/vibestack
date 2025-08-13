/**
 * Access Control Event Distributor
 * Distributes real-time events with comprehensive permission filtering and organization isolation
 */

import { 
  ProjectAccessControlService,
  TaskAccessControlService,
  FileAccessControlService,
  DiscussionAccessControlService
} from '@vibestack/dataforge';

export interface AccessControlledEvent {
  id: string;
  type: 'create' | 'update' | 'delete' | 'permission_change' | 'status_change';
  archetype: 'project' | 'task' | 'file' | 'discussion' | 'user' | 'organization';
  entityId: string;
  organizationId: string;
  userId: string; // Who performed the action
  timestamp: Date;
  data: any;
  metadata: EventMetadata;
  accessControl: AccessControlData;
}

export interface EventMetadata {
  version: string;
  source: string;
  correlationId?: string;
  parentEventId?: string;
  batchId?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  tags: string[];
  retryCount?: number;
  expiresAt?: Date;
}

export interface AccessControlData {
  requiredPermissions: string[];
  sensitiveFields: string[];
  visibilityLevel: 'public' | 'internal' | 'restricted' | 'confidential';
  roleRequirements?: string[];
  fieldPermissions?: Record<string, string[]>; // field -> required permissions
  conditionalAccess?: ConditionalAccessRule[];
}

export interface ConditionalAccessRule {
  condition: string;
  requiredPermission: string;
  description: string;
}

export interface EventRecipient {
  connectionId: string;
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: Set<string>;
  subscriptions: EventSubscription[];
}

export interface EventSubscription {
  id: string;
  pattern: string;
  filters: SubscriptionFilter[];
  permissions: string[];
  includeFields?: string[];
  excludeFields?: string[];
  maxEvents?: number;
  rateLimit?: {
    maxEventsPerSecond: number;
    windowSizeMs: number;
  };
}

export interface SubscriptionFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'matches' | 'exists';
  value: any;
  caseSensitive?: boolean;
}

export interface EventDeliveryResult {
  eventId: string;
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  filteredOut: number;
  deliveryTime: number;
  errors: EventDeliveryError[];
}

export interface EventDeliveryError {
  connectionId: string;
  userId: string;
  error: string;
  errorCode: string;
  timestamp: Date;
}

export interface EventDistributionMetrics {
  eventsProcessed: number;
  averageDeliveryTime: number;
  permissionChecks: number;
  averagePermissionCheckTime: number;
  filteringEfficiency: number;
  errorRate: number;
  organizationBreakdown: Record<string, number>;
  archetypeBreakdown: Record<string, number>;
}

export class AccessControlEventDistributor {
  private projectAccessControl = new ProjectAccessControlService();
  private taskAccessControl = new TaskAccessControlService();
  private fileAccessControl = new FileAccessControlService();
  private discussionAccessControl = new DiscussionAccessControlService();

  private metrics: EventDistributionMetrics = {
    eventsProcessed: 0,
    averageDeliveryTime: 0,
    permissionChecks: 0,
    averagePermissionCheckTime: 0,
    filteringEfficiency: 0,
    errorRate: 0,
    organizationBreakdown: {},
    archetypeBreakdown: {}
  };

  private deliveryHistory: Map<string, EventDeliveryResult> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  /**
   * Distribute event to authorized recipients with comprehensive access control
   */
  async distributeEvent(
    event: AccessControlledEvent,
    recipients: EventRecipient[]
  ): Promise<EventDeliveryResult> {
    const startTime = Date.now();
    console.log(`📡 Distributing event ${event.id} to ${recipients.length} potential recipients`);

    const result: EventDeliveryResult = {
      eventId: event.id,
      totalRecipients: recipients.length,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      filteredOut: 0,
      deliveryTime: 0,
      errors: []
    };

    // Filter recipients by organization
    const organizationRecipients = recipients.filter(r => r.organizationId === event.organizationId);
    if (organizationRecipients.length < recipients.length) {
      result.filteredOut += recipients.length - organizationRecipients.length;
      console.log(`🔒 Filtered out ${recipients.length - organizationRecipients.length} recipients from other organizations`);
    }

    // Process each recipient
    for (const recipient of organizationRecipients) {
      try {
        // Check if recipient should receive this event
        const shouldReceive = await this.shouldReceiveEvent(event, recipient);
        if (!shouldReceive) {
          result.filteredOut++;
          continue;
        }

        // Check rate limits
        if (await this.isRateLimited(recipient, event)) {
          result.filteredOut++;
          console.log(`⏱️ Rate limited event for recipient ${recipient.userId}`);
          continue;
        }

        // Filter event data based on recipient permissions
        const filteredEvent = await this.filterEventForRecipient(event, recipient);
        
        // Deliver the event
        await this.deliverEventToRecipient(filteredEvent, recipient);
        result.successfulDeliveries++;

      } catch (error) {
        result.failedDeliveries++;
        result.errors.push({
          connectionId: recipient.connectionId,
          userId: recipient.userId,
          error: String(error),
          errorCode: this.getErrorCode(error),
          timestamp: new Date()
        });
        console.error(`❌ Failed to deliver event to ${recipient.userId}:`, error);
      }
    }

    // Update metrics
    result.deliveryTime = Date.now() - startTime;
    this.updateMetrics(event, result);
    this.deliveryHistory.set(event.id, result);

    console.log(`✅ Event ${event.id} distributed: ${result.successfulDeliveries} delivered, ${result.filteredOut} filtered, ${result.failedDeliveries} failed`);
    return result;
  }

  /**
   * Check if recipient should receive the event based on permissions and subscriptions
   */
  private async shouldReceiveEvent(
    event: AccessControlledEvent,
    recipient: EventRecipient
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Check subscription matching
      const hasMatchingSubscription = this.hasMatchingSubscription(event, recipient);
      if (!hasMatchingSubscription) {
        return false;
      }

      // Check base access permissions
      const hasBaseAccess = await this.checkBaseAccess(event, recipient);
      if (!hasBaseAccess) {
        console.log(`🚫 User ${recipient.userId} lacks base access to ${event.archetype}:${event.entityId}`);
        return false;
      }

      // Check archetype-specific permissions
      const hasArchetypeAccess = await this.checkArchetypeAccess(event, recipient);
      if (!hasArchetypeAccess) {
        console.log(`🔐 User ${recipient.userId} lacks archetype access to ${event.archetype}:${event.entityId}`);
        return false;
      }

      // Check conditional access rules
      const meetsConditionalRules = await this.checkConditionalAccess(event, recipient);
      if (!meetsConditionalRules) {
        console.log(`📋 User ${recipient.userId} doesn't meet conditional access rules for event ${event.id}`);
        return false;
      }

      return true;

    } finally {
      this.metrics.permissionChecks++;
      this.metrics.averagePermissionCheckTime = this.updateRunningAverage(
        this.metrics.averagePermissionCheckTime,
        Date.now() - startTime,
        this.metrics.permissionChecks
      );
    }
  }

  /**
   * Check if recipient has matching subscriptions for this event
   */
  private hasMatchingSubscription(event: AccessControlledEvent, recipient: EventRecipient): boolean {
    return recipient.subscriptions.some(subscription => {
      // Check pattern matching
      const patternMatches = this.matchesPattern(event, subscription.pattern);
      if (!patternMatches) return false;

      // Check subscription filters
      const filtersMatch = this.matchesFilters(event, subscription.filters);
      if (!filtersMatch) return false;

      // Check subscription permissions
      const hasSubPermissions = subscription.permissions.every(perm => 
        recipient.permissions.has(perm)
      );
      
      return hasSubPermissions;
    });
  }

  /**
   * Check base access permissions
   */
  private async checkBaseAccess(event: AccessControlledEvent, recipient: EventRecipient): Promise<boolean> {
    // Check if user has required permissions for this event
    return event.accessControl.requiredPermissions.every(permission =>
      recipient.permissions.has(permission)
    );
  }

  /**
   * Check archetype-specific access permissions
   */
  private async checkArchetypeAccess(event: AccessControlledEvent, recipient: EventRecipient): Promise<boolean> {
    const mockEntity = {
      id: event.entityId,
      organizationId: event.organizationId,
      archetype: event.archetype
    };

    try {
      switch (event.archetype) {
        case 'project':
          return await this.projectAccessControl.canRead(recipient.userId, mockEntity as any);
        case 'task':
          return await this.taskAccessControl.canRead(recipient.userId, mockEntity as any);
        case 'file':
          return await this.fileAccessControl.canRead(recipient.userId, mockEntity as any);
        case 'discussion':
          return await this.discussionAccessControl.canRead(recipient.userId, mockEntity as any);
        case 'user':
          // Users can see their own events and events they have permission to see
          return event.userId === recipient.userId || recipient.permissions.has('user.read');
        case 'organization':
          // Organization members can see organization events
          return recipient.permissions.has('organization.read');
        default:
          console.warn(`Unknown archetype for access check: ${event.archetype}`);
          return false;
      }
    } catch (error) {
      console.error(`Error checking archetype access for ${event.archetype}:`, error);
      return false;
    }
  }

  /**
   * Check conditional access rules
   */
  private async checkConditionalAccess(event: AccessControlledEvent, recipient: EventRecipient): Promise<boolean> {
    if (!event.accessControl.conditionalAccess?.length) {
      return true;
    }

    for (const rule of event.accessControl.conditionalAccess) {
      const conditionMet = this.evaluateCondition(rule.condition, event, recipient);
      if (conditionMet && !recipient.permissions.has(rule.requiredPermission)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Filter event data based on recipient permissions
   */
  private async filterEventForRecipient(
    event: AccessControlledEvent,
    recipient: EventRecipient
  ): Promise<AccessControlledEvent> {
    // Create filtered copy
    const filteredEvent: AccessControlledEvent = {
      ...event,
      data: { ...event.data }
    };

    // Remove sensitive fields if user doesn't have permission
    for (const sensitiveField of event.accessControl.sensitiveFields) {
      if (!this.canAccessField(sensitiveField, recipient, event)) {
        delete filteredEvent.data[sensitiveField];
      }
    }

    // Apply field-level permissions
    if (event.accessControl.fieldPermissions) {
      for (const [field, requiredPerms] of Object.entries(event.accessControl.fieldPermissions)) {
        const hasFieldAccess = requiredPerms.every(perm => recipient.permissions.has(perm));
        if (!hasFieldAccess && filteredEvent.data[field] !== undefined) {
          delete filteredEvent.data[field];
        }
      }
    }

    // Apply subscription field filters
    const matchingSubscription = recipient.subscriptions.find(sub => 
      this.matchesPattern(event, sub.pattern)
    );
    
    if (matchingSubscription) {
      // Include only specified fields if includeFields is set
      if (matchingSubscription.includeFields?.length) {
        const allowedData: any = {};
        for (const field of matchingSubscription.includeFields) {
          if (filteredEvent.data[field] !== undefined) {
            allowedData[field] = filteredEvent.data[field];
          }
        }
        filteredEvent.data = allowedData;
      }

      // Exclude specified fields
      if (matchingSubscription.excludeFields?.length) {
        for (const field of matchingSubscription.excludeFields) {
          delete filteredEvent.data[field];
        }
      }
    }

    return filteredEvent;
  }

  /**
   * Deliver event to specific recipient
   */
  private async deliverEventToRecipient(
    event: AccessControlledEvent,
    recipient: EventRecipient
  ): Promise<void> {
    // In a real implementation, this would send the event through the WebSocket connection
    // For now, we'll simulate delivery
    console.log(`📨 Delivering event ${event.id} to user ${recipient.userId} via connection ${recipient.connectionId}`);
    
    // Update rate limiter
    this.updateRateLimiter(recipient, event);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
  }

  /**
   * Check if recipient is rate limited
   */
  private async isRateLimited(recipient: EventRecipient, event: AccessControlledEvent): Promise<boolean> {
    const matchingSubscription = recipient.subscriptions.find(sub => 
      this.matchesPattern(event, sub.pattern)
    );

    if (!matchingSubscription?.rateLimit) {
      return false;
    }

    const rateLimitKey = `${recipient.connectionId}:${matchingSubscription.id}`;
    const rateLimiter = this.rateLimiters.get(rateLimitKey);

    if (!rateLimiter) {
      return false;
    }

    return rateLimiter.isLimited();
  }

  /**
   * Update rate limiter for recipient
   */
  private updateRateLimiter(recipient: EventRecipient, event: AccessControlledEvent): void {
    const matchingSubscription = recipient.subscriptions.find(sub => 
      this.matchesPattern(event, sub.pattern)
    );

    if (!matchingSubscription?.rateLimit) {
      return;
    }

    const rateLimitKey = `${recipient.connectionId}:${matchingSubscription.id}`;
    let rateLimiter = this.rateLimiters.get(rateLimitKey);

    if (!rateLimiter) {
      rateLimiter = new RateLimiter(
        matchingSubscription.rateLimit.maxEventsPerSecond,
        matchingSubscription.rateLimit.windowSizeMs
      );
      this.rateLimiters.set(rateLimitKey, rateLimiter);
    }

    rateLimiter.recordEvent();
  }

  /**
   * Check if user can access specific field
   */
  private canAccessField(field: string, recipient: EventRecipient, event: AccessControlledEvent): boolean {
    // Check visibility level
    switch (event.accessControl.visibilityLevel) {
      case 'public':
        return true;
      case 'internal':
        return recipient.permissions.has('internal.read');
      case 'restricted':
        return recipient.permissions.has('restricted.read');
      case 'confidential':
        return recipient.permissions.has('confidential.read');
      default:
        return false;
    }
  }

  /**
   * Pattern matching for event subscriptions
   */
  private matchesPattern(event: AccessControlledEvent, pattern: string): boolean {
    // Support wildcard patterns
    if (pattern === '*') return true;
    if (pattern === `${event.archetype}.*`) return true;
    if (pattern === `${event.archetype}.${event.type}`) return true;
    if (pattern === `${event.archetype}.${event.entityId}`) return true;
    
    // Support regex patterns
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      const regex = new RegExp(pattern.slice(1, -1));
      return regex.test(`${event.archetype}.${event.type}.${event.entityId}`);
    }

    return pattern === `${event.archetype}.${event.type}.${event.entityId}`;
  }

  /**
   * Check if event matches subscription filters
   */
  private matchesFilters(event: AccessControlledEvent, filters: SubscriptionFilter[]): boolean {
    return filters.every(filter => this.matchesFilter(event, filter));
  }

  /**
   * Check if event matches a single filter
   */
  private matchesFilter(event: AccessControlledEvent, filter: SubscriptionFilter): boolean {
    const fieldValue = this.getFieldValue(event, filter.field);
    
    switch (filter.operator) {
      case 'equals':
        return fieldValue === filter.value;
      case 'not_equals':
        return fieldValue !== filter.value;
      case 'contains':
        return String(fieldValue).includes(String(filter.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(filter.value));
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
      case 'matches':
        return new RegExp(String(filter.value)).test(String(fieldValue));
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }

  /**
   * Get field value from event
   */
  private getFieldValue(event: AccessControlledEvent, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let current = event as any;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Evaluate conditional access condition
   */
  private evaluateCondition(condition: string, event: AccessControlledEvent, recipient: EventRecipient): boolean {
    // Simple condition evaluation - in production this would be more sophisticated
    try {
      // Replace placeholders with actual values
      const evaluableCondition = condition
        .replace(/\$event\.(\w+)/g, (_, field) => JSON.stringify(this.getFieldValue(event, field)))
        .replace(/\$recipient\.(\w+)/g, (_, field) => JSON.stringify((recipient as any)[field]))
        .replace(/\$user\./g, '$recipient.');

      // Note: In production, use a safe expression evaluator instead of eval
      return Boolean(eval(evaluableCondition));
    } catch (error) {
      console.warn(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }

  /**
   * Update distribution metrics
   */
  private updateMetrics(event: AccessControlledEvent, result: EventDeliveryResult): void {
    this.metrics.eventsProcessed++;
    this.metrics.averageDeliveryTime = this.updateRunningAverage(
      this.metrics.averageDeliveryTime,
      result.deliveryTime,
      this.metrics.eventsProcessed
    );

    this.metrics.errorRate = this.updateRunningAverage(
      this.metrics.errorRate,
      result.failedDeliveries / result.totalRecipients,
      this.metrics.eventsProcessed
    );

    this.metrics.filteringEfficiency = this.updateRunningAverage(
      this.metrics.filteringEfficiency,
      result.filteredOut / result.totalRecipients,
      this.metrics.eventsProcessed
    );

    // Update organization breakdown
    this.metrics.organizationBreakdown[event.organizationId] = 
      (this.metrics.organizationBreakdown[event.organizationId] || 0) + 1;

    // Update archetype breakdown
    this.metrics.archetypeBreakdown[event.archetype] = 
      (this.metrics.archetypeBreakdown[event.archetype] || 0) + 1;
  }

  /**
   * Update running average
   */
  private updateRunningAverage(currentAverage: number, newValue: number, count: number): number {
    return (currentAverage * (count - 1) + newValue) / count;
  }

  /**
   * Get error code from error
   */
  private getErrorCode(error: any): string {
    if (error.code) return error.code;
    if (error.name) return error.name;
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get distribution metrics
   */
  getMetrics(): EventDistributionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get event delivery history
   */
  getDeliveryHistory(): Map<string, EventDeliveryResult> {
    return new Map(this.deliveryHistory);
  }

  /**
   * Clear metrics and history
   */
  clearMetrics(): void {
    this.metrics = {
      eventsProcessed: 0,
      averageDeliveryTime: 0,
      permissionChecks: 0,
      averagePermissionCheckTime: 0,
      filteringEfficiency: 0,
      errorRate: 0,
      organizationBreakdown: {},
      archetypeBreakdown: {}
    };
    this.deliveryHistory.clear();
    this.rateLimiters.clear();
  }
}

/**
 * Simple rate limiter implementation
 */
class RateLimiter {
  private events: number[] = [];

  constructor(
    private maxEventsPerSecond: number,
    private windowSizeMs: number
  ) {}

  recordEvent(): void {
    const now = Date.now();
    this.events.push(now);
    this.cleanupOldEvents(now);
  }

  isLimited(): boolean {
    const now = Date.now();
    this.cleanupOldEvents(now);
    return this.events.length >= this.maxEventsPerSecond;
  }

  private cleanupOldEvents(now: number): void {
    const cutoff = now - this.windowSizeMs;
    this.events = this.events.filter(timestamp => timestamp > cutoff);
  }
}

export default AccessControlEventDistributor;