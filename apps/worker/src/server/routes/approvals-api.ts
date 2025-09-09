/**
 * Approvals API Routes - Simple Approval System
 * 
 * Provides basic approval workflow functionality for any entity.
 * Simple now, extensible later.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ApprovalManager } from '../dataforge';
import type { ApprovalRequest } from '../dataforge';
import { createKyselyForPersistentUse } from '../lib/database-manager';

const approvalsRouter = new Hono();

// Validation schemas
const RequestApprovalSchema = z.object({
  entityId: z.string().min(1, 'Entity ID is required'),
  entityType: z.string().min(1, 'Entity type is required'),
  approverId: z.string().min(1, 'Approver ID is required'),
  requestedBy: z.string().min(1, 'Requester ID is required'),
  reason: z.string().optional(),
  dueDate: z.string().datetime().optional().transform(date => date ? new Date(date) : undefined)
});

const RespondToApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().optional()
});

// Request approval for an entity
approvalsRouter.post(
  '/orgs/:orgId/approvals',
  zValidator('json', RequestApprovalSchema),
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const requestData = c.req.valid('json');
      const kysely = createKyselyForPersistentUse(c.env);

      const approvalId = await ApprovalManager.requestApproval(
        kysely,
        orgId,
        requestData as ApprovalRequest
      );

      return c.json({
        success: true,
        message: 'Approval requested successfully',
        data: {
          approvalId,
          ...requestData
        }
      });
    } catch (error) {
      console.error('Error requesting approval:', error);
      return c.json({
        success: false,
        error: 'Failed to request approval',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 400);
    }
  }
);

// Respond to an approval request
approvalsRouter.post(
  '/orgs/:orgId/approvals/:approvalId/respond',
  zValidator('json', RespondToApprovalSchema),
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const approvalId = c.req.param('approvalId');
      const { status, reason } = c.req.valid('json');
      const kysely = createKyselyForPersistentUse(c.env);

      // TODO: Get user ID from auth context
      const approverId = 'current-user'; // Placeholder

      await ApprovalManager.respondToApproval(
        kysely,
        orgId,
        approvalId,
        approverId,
        status,
        reason
      );

      return c.json({
        success: true,
        message: `Approval ${status} successfully`,
        data: {
          approvalId,
          status,
          reason
        }
      });
    } catch (error) {
      console.error('Error responding to approval:', error);
      return c.json({
        success: false,
        error: 'Failed to respond to approval',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 400);
    }
  }
);

// Get pending approvals for current user
approvalsRouter.get(
  '/orgs/:orgId/approvals/pending',
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const kysely = createKyselyForPersistentUse(c.env);

      // TODO: Get user ID from auth context
      const approverId = 'current-user'; // Placeholder

      const pendingApprovals = await ApprovalManager.getPendingApprovals(
        kysely,
        orgId,
        approverId
      );

      return c.json({
        success: true,
        data: pendingApprovals,
        metadata: {
          approverId,
          pendingCount: pendingApprovals.length
        }
      });
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch pending approvals',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Get approval status for an entity
approvalsRouter.get(
  '/orgs/:orgId/approvals/:entityType/:entityId',
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const entityId = c.req.param('entityId');
      const entityType = c.req.param('entityType');
      const kysely = createKyselyForPersistentUse(c.env);

      const approvals = await ApprovalManager.getApprovalStatus(
        kysely,
        orgId,
        entityId,
        entityType
      );

      const isApproved = await ApprovalManager.isEntityApproved(
        kysely,
        orgId,
        entityId,
        entityType
      );

      return c.json({
        success: true,
        data: approvals,
        metadata: {
          entityId,
          entityType,
          isFullyApproved: isApproved,
          approvalCount: approvals.length
        }
      });
    } catch (error) {
      console.error('Error fetching approval status:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch approval status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Cancel an approval request
approvalsRouter.delete(
  '/orgs/:orgId/approvals/:approvalId',
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const approvalId = c.req.param('approvalId');
      const kysely = createKyselyForPersistentUse(c.env);

      // TODO: Get user ID from auth context
      const requesterId = 'current-user'; // Placeholder

      await ApprovalManager.cancelApproval(
        kysely,
        orgId,
        approvalId,
        requesterId
      );

      return c.json({
        success: true,
        message: 'Approval request cancelled successfully',
        data: { approvalId }
      });
    } catch (error) {
      console.error('Error cancelling approval:', error);
      return c.json({
        success: false,
        error: 'Failed to cancel approval request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 400);
    }
  }
);

export default approvalsRouter;