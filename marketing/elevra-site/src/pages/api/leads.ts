import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
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

    // Get MailerLite API key from environment (Cloudflare Workers way)
    const MAILERLITE_API_KEY = locals.runtime.env.MAILERLITE_API_KEY || import.meta.env.MAILERLITE_API_KEY;
    
    if (!MAILERLITE_API_KEY) {
      console.error('MailerLite API key not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Add subscriber to MailerLite
    const mailerLiteResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        fields: {
          name: company, // Use company name as the name field
          last_name: '', // Leave empty or add if you collect first/last name separately
          company: company,
          pain_point: pain || '',
          signup_date: new Date().toISOString()
        },
        groups: ['165378573047170340'] // Add to Landing group for automation
      })
    });

    if (!mailerLiteResponse.ok) {
      const errorData = await mailerLiteResponse.json().catch(() => ({}));
      console.error('MailerLite API error:', errorData);
      
      // Don't expose MailerLite errors to the user, but log them
      if (mailerLiteResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable. Please try again.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to subscribe. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subscriberData = await mailerLiteResponse.json();
    console.log('Successfully added subscriber:', subscriberData.data?.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Successfully subscribed! Check your email for a welcome message.' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Lead capture error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process subscription. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};