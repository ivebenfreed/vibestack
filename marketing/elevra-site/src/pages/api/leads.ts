import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json() as any;
    const { email, company, pain, timestamp } = data;

    // Validate required fields
    if (!email || !company) {
      return new Response(
        JSON.stringify({ error: 'Email and company are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Resend (or your preferred email service)
    const resend = new Resend(import.meta.env.RESEND_API_KEY);

    // Send notification email to your team
    await resend.emails.send({
      from: 'leads@elevra.com',
      to: 'team@elevra.com', // Your team email
      subject: `New Elevra Lead: ${company}`,
      html: `
        <h2>New Lead Captured</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Pain Point:</strong> ${pain || 'Not specified'}</p>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
      `
    });

    // Send welcome email to the lead
    await resend.emails.send({
      from: 'welcome@elevra.com',
      to: email,
      subject: 'Welcome to Elevra Early Access!',
      html: `
        <h2>Thanks for joining the Elevra speed revolution!</h2>
        <p>Hi there,</p>
        <p>We're excited to have ${company} on board for early access to Elevra.</p>
        <p>Here's what happens next:</p>
        <ul>
          <li>🚀 We'll notify you when early access opens (Q1 2024)</li>
          <li>💰 You'll get 3 months free + lifetime early adopter pricing</li>
          <li>⚡ First access to database relationships that actually work</li>
        </ul>
        <p>In the meantime, follow our progress:</p>
        <p><a href="https://twitter.com/elevra">Twitter</a> | <a href="https://elevra.com/blog">Blog</a></p>
        <p>Thanks,<br>The Elevra Team</p>
      `
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Lead captured successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Lead capture error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process lead' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};