import type { Kysely } from 'kysely';
import { dbLogger } from '../../middleware/logger';
import { Resend } from 'resend';
import type { 
  OrganizationInvitation, 
  CreateInvitationInput,
  OrganizationServiceResponse,
  InvitationListFilters,
  OrganizationRole
} from '../../types/organization';
import { OrganizationMemberService } from './OrganizationMemberService';

/**
 * Organization Invitation Management Service
 * Handles invitation CRUD operations and email sending
 */
export class OrganizationInvitationService {
  private db: Kysely<any>;
  private env: any;

  constructor(db: Kysely<any>, env: any) {
    this.db = db;
    this.env = env;
  }

  /**
   * Create new invitation
   */
  async createInvitation(
    data: CreateInvitationInput,
    invitedBy: string
  ): Promise<OrganizationServiceResponse<OrganizationInvitation>> {
    try {
      // 1. Validate input
      const validation = this.validateInvitationInput(data);
      if (!validation.success) {
        return validation;
      }

      // 2. Check if user already exists and is a member
      const existingUser = await this.db
        .selectFrom('user')
        .where('email', '=', data.email)
        .executeTakeFirst();

      if (existingUser) {
        const memberService = new OrganizationMemberService(this.db);
        const existingMembership = await memberService.getMembership(
          existingUser.id,
          data.organization_id
        );

        if (existingMembership.success) {
          return {
            success: false,
            error: 'User is already a member of this organization'
          };
        }
      }

      // 3. Check organization limits
      const memberCount = await this.db
        .selectFrom('organization_members')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('organization_id', '=', data.organization_id)
        .where('status', '=', 'active')
        .executeTakeFirst();

      const orgData = await this.db
        .selectFrom('organizations')
        .select(['max_users', 'name'])
        .where('id', '=', data.organization_id)
        .executeTakeFirst();

      if (orgData && Number(memberCount?.count || 0) >= orgData.max_users) {
        return {
          success: false,
          error: 'Organization has reached its member limit'
        };
      }

      // 4. Cancel existing pending invitations for this email
      await this.db
        .updateTable('organization_invitations')
        .set({ 
          status: 'cancelled',
          updated_at: new Date()
        })
        .where('organization_id', '=', data.organization_id)
        .where('email', '=', data.email)
        .where('status', '=', 'pending')
        .execute();

      // 5. Generate secure token
      const token = this.generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (data.expires_in_hours || 48));

      // 6. Store invitation
      const invitation = await this.db
        .insertInto('organization_invitations')
        .values({
          organization_id: data.organization_id,
          email: data.email,
          role: data.role,
          invited_by: invitedBy,
          token: token,
          expires_at: expiresAt,
          personal_message: data.personal_message,
          status: 'pending'
        })
        .returning([
          'id', 'organization_id', 'email', 'role', 'invited_by',
          'token', 'expires_at', 'status', 'accepted_at', 'accepted_by',
          'personal_message', 'created_at', 'updated_at'
        ])
        .executeTakeFirstOrThrow();

      // 7. Send invitation email
      const emailResult = await this.sendInvitationEmail(invitation as OrganizationInvitation);
      if (!emailResult.success) {
        dbLogger.warn('Invitation created but email failed to send', {
          invitationId: invitation.id,
          email: data.email,
          error: emailResult.error
        });
      }

      // 8. Log audit event
      await this.logAuditEvent({
        organization_id: data.organization_id,
        action: 'invitation_created',
        actor_id: invitedBy,
        target_type: 'invitation',
        target_id: invitation.id,
        details: {
          email: data.email,
          role: data.role,
          expires_at: expiresAt
        }
      });

      dbLogger.info('Organization invitation created successfully', {
        invitationId: invitation.id,
        organizationId: data.organization_id,
        email: data.email,
        role: data.role,
        invitedBy
      });

      return {
        success: true,
        data: invitation as OrganizationInvitation
      };

    } catch (error) {
      dbLogger.error('Error creating invitation', error);
      return {
        success: false,
        error: 'Failed to create invitation'
      };
    }
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(
    token: string,
    userId?: string
  ): Promise<OrganizationServiceResponse<any>> {
    try {
      // 1. Validate token and check expiration
      const invitation = await this.db
        .selectFrom('organization_invitations')
        .leftJoin('organizations', 'organizations.id', 'organization_invitations.organization_id')
        .where('organization_invitations.token', '=', token)
        .where('organization_invitations.status', '=', 'pending')
        .where('organization_invitations.expires_at', '>', new Date())
        .select([
          'organization_invitations.id',
          'organization_invitations.organization_id',
          'organization_invitations.email',
          'organization_invitations.role',
          'organization_invitations.invited_by',
          'organization_invitations.expires_at',
          'organizations.name as org_name'
        ])
        .executeTakeFirst();

      if (!invitation) {
        return {
          success: false,
          error: 'Invalid or expired invitation token'
        };
      }

      // 2. Create/link user account
      let acceptingUserId = userId;
      
      if (!acceptingUserId) {
        // Check if user already exists with this email
        const existingUser = await this.db
          .selectFrom('user')
          .where('email', '=', invitation.email)
          .executeTakeFirst();

        if (existingUser) {
          acceptingUserId = existingUser.id;
        } else {
          return {
            success: false,
            error: 'User account required to accept invitation. Please sign up first.'
          };
        }
      }

      // 3. Add to organization
      const memberService = new OrganizationMemberService(this.db);
      const memberResult = await memberService.addMemberDirect(
        invitation.organization_id,
        acceptingUserId,
        invitation.role as OrganizationRole,
        invitation.invited_by
      );

      if (!memberResult.success) {
        return memberResult;
      }

      // 4. Mark invitation as accepted
      await this.db
        .updateTable('organization_invitations')
        .set({
          status: 'accepted',
          accepted_at: new Date(),
          accepted_by: acceptingUserId,
          updated_at: new Date()
        })
        .where('id', '=', invitation.id)
        .execute();

      // 5. Send confirmation emails (TODO: implement)
      // await this.sendWelcomeEmail(acceptingUserId, invitation.organization_id);
      // await this.sendInviterNotification(invitation.invited_by, invitation.email, invitation.org_name);

      // 6. Log audit event
      await this.logAuditEvent({
        organization_id: invitation.organization_id,
        action: 'invitation_accepted',
        actor_id: acceptingUserId,
        target_type: 'invitation',
        target_id: invitation.id,
        details: {
          email: invitation.email,
          role: invitation.role
        }
      });

      return {
        success: true,
        data: {
          member: memberResult.data,
          organization: {
            id: invitation.organization_id,
            name: invitation.org_name
          }
        }
      };

    } catch (error) {
      dbLogger.error('Error accepting invitation', error);
      return {
        success: false,
        error: 'Failed to accept invitation'
      };
    }
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(
    invitationId: string,
    cancelledBy: string
  ): Promise<OrganizationServiceResponse<void>> {
    try {
      // 1. Get invitation details
      const invitation = await this.db
        .selectFrom('organization_invitations')
        .where('id', '=', invitationId)
        .where('status', '=', 'pending')
        .executeTakeFirst();

      if (!invitation) {
        return {
          success: false,
          error: 'Invitation not found or already processed'
        };
      }

      // 2. Cancel invitation
      const result = await this.db
        .updateTable('organization_invitations')
        .set({
          status: 'cancelled',
          updated_at: new Date()
        })
        .where('id', '=', invitationId)
        .executeTakeFirst();

      if (result.numUpdatedRows === 0) {
        return {
          success: false,
          error: 'Invitation not found'
        };
      }

      // 3. Log audit event
      await this.logAuditEvent({
        organization_id: invitation.organization_id,
        action: 'invitation_cancelled',
        actor_id: cancelledBy,
        target_type: 'invitation',
        target_id: invitationId,
        details: {
          email: invitation.email,
          role: invitation.role
        }
      });

      return {
        success: true
      };

    } catch (error) {
      dbLogger.error('Error cancelling invitation', error);
      return {
        success: false,
        error: 'Failed to cancel invitation'
      };
    }
  }

  /**
   * Resend invitation
   */
  async resendInvitation(
    invitationId: string,
    resentBy: string
  ): Promise<OrganizationServiceResponse<OrganizationInvitation>> {
    try {
      // 1. Get invitation
      const invitation = await this.db
        .selectFrom('organization_invitations')
        .where('id', '=', invitationId)
        .where('status', '=', 'pending')
        .executeTakeFirst();

      if (!invitation) {
        return {
          success: false,
          error: 'Invitation not found or already processed'
        };
      }

      // 2. Generate new token and extend expiration
      const newToken = this.generateInvitationToken();
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 48);

      // 3. Update invitation
      const updatedInvitation = await this.db
        .updateTable('organization_invitations')
        .set({
          token: newToken,
          expires_at: newExpiresAt,
          updated_at: new Date()
        })
        .where('id', '=', invitationId)
        .returning([
          'id', 'organization_id', 'email', 'role', 'invited_by',
          'token', 'expires_at', 'status', 'accepted_at', 'accepted_by',
          'personal_message', 'created_at', 'updated_at'
        ])
        .executeTakeFirst();

      if (!updatedInvitation) {
        return {
          success: false,
          error: 'Failed to update invitation'
        };
      }

      // 4. Send email
      const emailResult = await this.sendInvitationEmail(updatedInvitation as OrganizationInvitation);
      if (!emailResult.success) {
        dbLogger.warn('Invitation updated but email failed to send', {
          invitationId,
          error: emailResult.error
        });
      }

      // 5. Log audit event
      await this.logAuditEvent({
        organization_id: invitation.organization_id,
        action: 'invitation_resent',
        actor_id: resentBy,
        target_type: 'invitation',
        target_id: invitationId,
        details: {
          email: invitation.email,
          new_expires_at: newExpiresAt
        }
      });

      return {
        success: true,
        data: updatedInvitation as OrganizationInvitation
      };

    } catch (error) {
      dbLogger.error('Error resending invitation', error);
      return {
        success: false,
        error: 'Failed to resend invitation'
      };
    }
  }

  /**
   * List invitations
   */
  async listInvitations(
    filters: InvitationListFilters
  ): Promise<OrganizationServiceResponse<OrganizationInvitation[]>> {
    try {
      let query = this.db
        .selectFrom('organization_invitations')
        .leftJoin('user', 'user.id', 'organization_invitations.invited_by')
        .where('organization_invitations.organization_id', '=', filters.organization_id);

      // Apply filters
      if (filters.status) {
        query = query.where('organization_invitations.status', '=', filters.status);
      }

      if (filters.role) {
        query = query.where('organization_invitations.role', '=', filters.role);
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      const invitations = await query
        .select([
          'organization_invitations.id',
          'organization_invitations.organization_id',
          'organization_invitations.email',
          'organization_invitations.role',
          'organization_invitations.invited_by',
          'organization_invitations.token',
          'organization_invitations.expires_at',
          'organization_invitations.status',
          'organization_invitations.accepted_at',
          'organization_invitations.accepted_by',
          'organization_invitations.personal_message',
          'organization_invitations.created_at',
          'organization_invitations.updated_at',
          'user.name as inviter_name',
          'user.email as inviter_email'
        ])
        .orderBy('organization_invitations.created_at', 'desc')
        .execute();

      const formattedInvitations: OrganizationInvitation[] = invitations.map(inv => ({
        id: inv.id,
        organization_id: inv.organization_id,
        email: inv.email,
        role: inv.role as OrganizationRole,
        invited_by: inv.invited_by,
        token: inv.token,
        expires_at: inv.expires_at,
        status: inv.status as any,
        accepted_at: inv.accepted_at,
        accepted_by: inv.accepted_by,
        personal_message: inv.personal_message,
        created_at: inv.created_at,
        updated_at: inv.updated_at,
        inviter: inv.inviter_name ? {
          id: inv.invited_by,
          name: inv.inviter_name,
          email: inv.inviter_email || ''
        } : undefined
      }));

      return {
        success: true,
        data: formattedInvitations
      };

    } catch (error) {
      dbLogger.error('Error listing invitations', error);
      return {
        success: false,
        error: 'Failed to list invitations'
      };
    }
  }

  /**
   * Private helper methods
   */
  private validateInvitationInput(data: CreateInvitationInput): OrganizationServiceResponse<void> {
    const errors: string[] = [];

    if (!data.organization_id?.trim()) {
      errors.push('Organization ID is required');
    }

    if (!data.email?.trim()) {
      errors.push('Email is required');
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Invalid email format');
    }

    if (!data.role || !['owner', 'admin', 'manager', 'member', 'viewer'].includes(data.role)) {
      errors.push('Valid role is required');
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors
      };
    }

    return { success: true };
  }

  private generateInvitationToken(): string {
    // Generate a secure random token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private async sendInvitationEmail(
    invitation: OrganizationInvitation
  ): Promise<OrganizationServiceResponse<void>> {
    try {
      if (!this.env.RESEND_API_KEY) {
        return {
          success: false,
          error: 'Email service not configured'
        };
      }

      const resend = new Resend(this.env.RESEND_API_KEY);

      // Get organization and inviter details
      const details = await this.db
        .selectFrom('organizations')
        .leftJoin('user', 'user.id', '=', invitation.invited_by)
        .where('organizations.id', '=', invitation.organization_id)
        .select([
          'organizations.name as org_name',
          'user.name as inviter_name'
        ])
        .executeTakeFirst();

      const inviteUrl = `${this.getBaseUrl()}/accept-invitation?token=${invitation.token}`;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You're invited to join ${details?.org_name}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">VibeStack</h1>
          </div>
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin-top: 0;">
              🎉 You're invited to join ${details?.org_name}!
            </h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${details?.inviter_name || 'Someone'} has invited you to join <strong>${details?.org_name}</strong> as a <strong>${invitation.role}</strong>.
            </p>
            
            ${invitation.personal_message ? `
              <div style="background-color: #e5e7eb; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-style: italic;">"${invitation.personal_message}"</p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="background-color: #2563eb; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-bottom: 15px;">
              ⏰ This invitation will expire in 48 hours for security.
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">
              🔗 If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="word-break: break-all; font-family: 'Courier New', monospace; font-size: 12px;">${inviteUrl}</span>
            </p>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
            <p><strong>What happens next?</strong></p>
            <ul style="margin: 10px 0;">
              <li>Click the invitation link above</li>
              <li>Sign in to your VibeStack account (or create one)</li>
              <li>Start collaborating with your team!</li>
            </ul>
            
            <p style="margin: 20px 0 0 0;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `;

      await resend.emails.send({
        from: 'VibeStack <noreply@codevibesmatter.com>',
        to: invitation.email,
        subject: `Invitation to join ${details?.org_name}`,
        html: emailHtml
      });

      return { success: true };

    } catch (error) {
      dbLogger.error('Failed to send invitation email', error);
      return {
        success: false,
        error: 'Failed to send invitation email'
      };
    }
  }

  private getBaseUrl(): string {
    // This should match the frontend URL
    if (this.env.ENVIRONMENT === 'development') {
      return `http://localhost:${this.env.WEB_PORT || '5173'}`;
    } else if (this.env.ENVIRONMENT === 'staging') {
      return 'https://dev.codevibesmatter.com';
    } else {
      return 'https://app.codevibesmatter.com';
    }
  }

  private async logAuditEvent(event: {
    organization_id: string;
    action: string;
    actor_id?: string;
    target_type?: string;
    target_id?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.db
        .insertInto('organization_audit_logs')
        .values({
          organization_id: event.organization_id,
          action: event.action,
          actor_id: event.actor_id,
          target_type: event.target_type,
          target_id: event.target_id,
          details: JSON.stringify(event.details || {})
        })
        .execute();
    } catch (error) {
      dbLogger.error('Failed to log audit event', error);
    }
  }
}