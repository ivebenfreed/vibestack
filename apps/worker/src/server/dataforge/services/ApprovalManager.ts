/**
 * Approval Manager - Simple Approval System
 * 
 * Provides basic approval workflow functionality for any entity.
 * Designed to be simple now, extensible later.
 * 
 * Uses the relationship system to store approval requests and responses.
 */

import type { Kysely } from 'kysely';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalRequest {
  entityId: string;           // What needs approval
  entityType: string;         // Type of entity needing approval
  approverId: string;         // Who needs to approve
  requestedBy: string;        // Who requested the approval
  reason?: string;            // Why approval is needed
  dueDate?: Date;             // Optional deadline
}

export interface ApprovalResponse {
  approvalId: string;
  status: ApprovalStatus;
  approverId: string;
  entityId: string;
  entityType: string;
  reason?: string;
  respondedAt: Date;
  requestedBy: string;
  createdAt: Date;
}

export class ApprovalManager {
  /**
   * Request approval for an entity
   */
  static async requestApproval(
    kysely: Kysely<any>,
    orgId: string,
    request: ApprovalRequest
  ): Promise<string> {
    const tableName = this.getRelationshipTableName(orgId);

    const result = await kysely
      .insertInto(tableName)
      .values({
        source_entity_type: request.entityType,
        source_entity_id: request.entityId,
        target_entity_type: 'User',
        target_entity_id: request.approverId,
        relationship_type: 'requires_approval_from',
        field_name: 'approval_request',
        properties: {
          status: 'pending',
          reason: request.reason,
          due_date: request.dueDate?.toISOString(),
          requested_by: request.requestedBy
        },
        valid_from: new Date(),
        valid_until: null, // Active until responded to
        created_at: new Date(),
        created_by: request.requestedBy
      })
      .returning('id')
      .executeTakeFirst();

    return result?.id || '';
  }

  /**
   * Respond to an approval request
   */
  static async respondToApproval(
    kysely: Kysely<any>,
    orgId: string,
    approvalId: string,
    approverId: string,
    status: 'approved' | 'rejected',
    reason?: string
  ): Promise<void> {
    const tableName = this.getRelationshipTableName(orgId);

    // Verify the approver is authorized to respond
    const approval = await kysely
      .selectFrom(tableName)
      .selectAll()
      .where('id', '=', approvalId)
      .where('target_entity_id', '=', approverId)
      .where('relationship_type', '=', 'requires_approval_from')
      .where('valid_until', 'is', null)
      .executeTakeFirst();

    if (!approval) {
      throw new Error('Approval request not found or you are not authorized to respond');
    }

    if (approval.properties?.status !== 'pending') {
      throw new Error('Approval request has already been responded to');
    }

    // Update the approval with response
    await kysely
      .updateTable(tableName)
      .set({
        properties: {
          ...approval.properties,
          status,
          response_reason: reason,
          responded_at: new Date().toISOString(),
          responded_by: approverId
        },
        valid_until: new Date() // Mark as complete
      })
      .where('id', '=', approvalId)
      .execute();
  }

  /**
   * Get pending approvals for a user
   */
  static async getPendingApprovals(
    kysely: Kysely<any>,
    orgId: string,
    approverId: string
  ): Promise<ApprovalResponse[]> {
    const tableName = this.getRelationshipTableName(orgId);

    const results = await kysely
      .selectFrom(tableName)
      .selectAll()
      .where('relationship_type', '=', 'requires_approval_from')
      .where('target_entity_id', '=', approverId)
      .where('valid_until', 'is', null) // Still active
      .where((eb) => 
        eb('properties', '->', 'status', '=', '"pending"')
      )
      .execute();

    return results.map(result => ({
      approvalId: result.id,
      status: result.properties?.status as ApprovalStatus,
      approverId: result.target_entity_id,
      entityId: result.source_entity_id,
      entityType: result.source_entity_type,
      reason: result.properties?.reason,
      respondedAt: result.properties?.responded_at ? new Date(result.properties.responded_at) : new Date(),
      requestedBy: result.properties?.requested_by || result.created_by || 'unknown',
      createdAt: result.created_at
    }));
  }

  /**
   * Get approval status for an entity
   */
  static async getApprovalStatus(
    kysely: Kysely<any>,
    orgId: string,
    entityId: string,
    entityType: string
  ): Promise<ApprovalResponse[]> {
    const tableName = this.getRelationshipTableName(orgId);

    const results = await kysely
      .selectFrom(tableName)
      .selectAll()
      .where('relationship_type', '=', 'requires_approval_from')
      .where('source_entity_id', '=', entityId)
      .where('source_entity_type', '=', entityType)
      .orderBy('created_at', 'desc')
      .execute();

    return results.map(result => ({
      approvalId: result.id,
      status: result.properties?.status as ApprovalStatus,
      approverId: result.target_entity_id,
      entityId: result.source_entity_id,
      entityType: result.source_entity_type,
      reason: result.properties?.reason,
      respondedAt: result.properties?.responded_at ? new Date(result.properties.responded_at) : new Date(),
      requestedBy: result.properties?.requested_by || result.created_by || 'unknown',
      createdAt: result.created_at
    }));
  }

  /**
   * Check if entity is fully approved (all pending approvals are approved)
   */
  static async isEntityApproved(
    kysely: Kysely<any>,
    orgId: string,
    entityId: string,
    entityType: string
  ): Promise<boolean> {
    const tableName = this.getRelationshipTableName(orgId);

    // Check for any pending or rejected approvals
    const pendingOrRejected = await kysely
      .selectFrom(tableName)
      .select('id')
      .where('relationship_type', '=', 'requires_approval_from')
      .where('source_entity_id', '=', entityId)
      .where('source_entity_type', '=', entityType)
      .where((eb) => 
        eb.or([
          eb('properties', '->', 'status', '=', '"pending"'),
          eb('properties', '->', 'status', '=', '"rejected"')
        ])
      )
      .executeTakeFirst();

    return !pendingOrRejected; // Approved if no pending/rejected approvals exist
  }

  /**
   * Cancel approval request (if not yet responded to)
   */
  static async cancelApproval(
    kysely: Kysely<any>,
    orgId: string,
    approvalId: string,
    requesterId: string
  ): Promise<void> {
    const tableName = this.getRelationshipTableName(orgId);

    // Verify requester can cancel
    const approval = await kysely
      .selectFrom(tableName)
      .selectAll()
      .where('id', '=', approvalId)
      .where('created_by', '=', requesterId)
      .where('relationship_type', '=', 'requires_approval_from')
      .where('valid_until', 'is', null)
      .executeTakeFirst();

    if (!approval) {
      throw new Error('Approval request not found or you are not authorized to cancel');
    }

    if (approval.properties?.status !== 'pending') {
      throw new Error('Cannot cancel approval request that has already been responded to');
    }

    // Mark as cancelled (expired)
    await kysely
      .updateTable(tableName)
      .set({
        properties: {
          ...approval.properties,
          status: 'expired',
          cancelled_at: new Date().toISOString(),
          cancelled_by: requesterId
        },
        valid_until: new Date()
      })
      .where('id', '=', approvalId)
      .execute();
  }

  /**
   * Get the relationship table name for an organization
   */
  private static getRelationshipTableName(orgId: string): string {
    return `org_${orgId.replace(/-/g, '_')}_relationships`;
  }
}