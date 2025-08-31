import { Resend } from 'resend';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';

export class EmailService {
  private resend: Resend;
  private env: Env;

  constructor(env: Env) {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.resend = new Resend(env.RESEND_API_KEY);
    this.env = env;
  }

  /**
   * Send email verification link for trial signup
   */
  async sendEmailVerification(data: {
    user: { email: string; id: string; name?: string };
    url: string;
    token: string;
  }): Promise<void> {
    const emailSubject = 'Verify your VibeStack account - Start your 14-day trial';
    const emailHtml = this.getEmailVerificationTemplate(data);

    try {
      // FOR TESTING: Log email details in development
      if (this.env.ENVIRONMENT === 'development') {
        console.log('📧 EMAIL VERIFICATION - Sending email via Resend:');
        console.log('  To:', data.user.email);
        console.log('  Subject:', emailSubject);
        console.log('  🔗 Verification URL:', data.url);
        console.log('  📝 HTML preview (first 200 chars):', emailHtml.substring(0, 200) + '...');
      }

      await this.resend.emails.send({
        from: 'VibeStack <noreply@codevibesmatter.com>',
        to: data.user.email,
        subject: emailSubject,
        html: emailHtml
      });

      dbLogger.info('Email verification link sent successfully', {
        email: data.user.email,
        userId: data.user.id,
        linkExpiration: '24 hours',
        verificationUrl: data.url // Include the URL in logs
      }, 'auth');
    } catch (error) {
      dbLogger.error('Failed to send email verification link', {
        email: data.user.email,
        userId: data.user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'auth');
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(data: {
    user: { email: string; id: string };
    url: string;
  }): Promise<void> {
    const emailSubject = 'Reset Your VibeStack Password';
    const emailHtml = this.getPasswordResetTemplate(data);

    try {
      await this.resend.emails.send({
        from: 'VibeStack Security <noreply@codevibesmatter.com>',
        to: data.user.email,
        subject: emailSubject,
        html: emailHtml
      });

      dbLogger.info('Password reset email sent successfully', {
        email: data.user.email,
        userId: data.user.id
      }, 'auth');
    } catch (error) {
      dbLogger.error('Failed to send password reset email', {
        email: data.user.email,
        userId: data.user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'auth');
      throw error;
    }
  }

  /**
   * Get email verification HTML template
   */
  private getEmailVerificationTemplate(data: {
    user: { email: string; name?: string };
    url: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your VibeStack Account</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 300;">VibeStack</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Start Your 14-Day Trial</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2c3e50; margin-top: 0;">Welcome to VibeStack!</h2>
          
          <p>Click the button below to verify your email and start your <strong>free 14-day trial</strong>:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.url}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 50px; 
                      font-weight: 600; 
                      font-size: 16px;
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                      transition: all 0.3s ease;">
              Verify Email & Start Trial
            </a>
          </div>
          
          <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #155724; margin: 0 0 10px 0; font-size: 16px;">🎉 Your Trial Includes:</h3>
            <ul style="color: #155724; margin: 5px 0; padding-left: 20px;">
              <li>14 days of full access</li>
              <li>Up to 25 team members</li>
              <li>10GB storage</li>
              <li>50,000 API calls/month</li>
              <li>Unlimited projects & tasks</li>
            </ul>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 25px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${data.url}" style="color: #667eea; word-break: break-all;">${data.url}</a>
          </p>
          
          <p style="font-size: 12px; color: #999; margin-top: 20px;">
            <strong>Security Note:</strong> This verification link will expire in 24 hours. If you didn't create a VibeStack account, you can safely ignore this email.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get password reset HTML template
   */
  private getPasswordResetTemplate(data: {
    user: { email: string };
    url: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your VibeStack Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">VibeStack</h1>
        </div>
        
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="color: #dc2626; margin-top: 0;">
            🔒 Password Reset Request
          </h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            We received a request to reset the password for your VibeStack account: <strong>${data.user.email}</strong>
          </p>
          
          <p style="font-size: 16px; margin-bottom: 25px;">
            If this was you, click the button below to reset your password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.url}" style="background-color: #dc2626; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Reset My Password
            </a>
          </div>
          
          <p style="color: #7f1d1d; font-size: 14px; margin-bottom: 15px;">
            ⏰ <strong>This link will expire in 15 minutes</strong> for security.
          </p>
          
          <p style="color: #7f1d1d; font-size: 14px; margin-bottom: 0;">
            🔗 If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="word-break: break-all; font-family: 'Courier New', monospace; font-size: 12px;">${data.url}</span>
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
          <p><strong>🚨 Security Notice:</strong></p>
          <ul style="margin: 10px 0;">
            <li>If you didn't request this password reset, you can safely ignore this email</li>
            <li>Your current password remains unchanged until you click the link above</li>
            <li>Never share this reset link with anyone</li>
            <li>This link can only be used once</li>
          </ul>
          
          <p style="margin: 20px 0 0 0;">
            Need help? Reply to this email or contact our support team.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Helper to get base URL for email links based on environment
   */
  private getBaseUrl(): string {
    const webPort = this.env.WEB_PORT || '5173';
    
    if (this.env.ENVIRONMENT === "development" || this.env.ENVIRONMENT === "local") {
      return `http://localhost:${webPort}`;
    } else if (this.env.ENVIRONMENT === "staging") {
      return "https://dev.codevibesmatter.com";
    } else {
      return "https://app.codevibesmatter.com";
    }
  }

  /**
   * Fix URLs for development environment (replace 127.0.0.1 with localhost)
   */
  fixUrlForEnvironment(url: string): string {
    const webPort = this.env.WEB_PORT || '5173';
    
    if (this.env.ENVIRONMENT === "development" && url.includes('http://127.0.0.1/')) {
      return url.replace('http://127.0.0.1/', `http://localhost:${webPort}/`);
    }
    
    return url;
  }
}

/**
 * Factory function to create EmailService instance
 */
export function createEmailService(env: Env): EmailService {
  return new EmailService(env);
}