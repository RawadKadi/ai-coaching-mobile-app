/**
 * Brevo Email Service
 * Handles sending transactional emails via Brevo API using environment variables
 */

const BREVO_API_KEY = process.env.EXPO_PUBLIC_BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export interface SendEmailParams {
    to: {
        email: string;
        name?: string;
    };
    subject: string;
    htmlContent: string;
    sender?: {
        email: string;
        name: string;
    };
}

export interface SubCoachInviteEmailParams {
    inviteEmail: string;
    inviteToken: string;
    parentCoachName: string;
    expiresAt: string;
    isRegistered?: boolean;
}

/**
 * Send email via Brevo API
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!BREVO_API_KEY) {
        console.error('[Brevo] API Key missing');
        return { success: false, error: 'API Key missing' };
    }

    try {
        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: params.sender || {
                    name: 'AI Coaching Platform',
                    email: 'rawadkady@gmail.com',
                },
                to: [{
                    email: params.to.email,
                    name: params.to.name || params.to.email,
                }],
                subject: params.subject,
                htmlContent: params.htmlContent,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Brevo] Email send failed:', errorData);
            return {
                success: false,
                error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        const data = await response.json();
        return {
            success: true,
            messageId: data.messageId,
        };
    } catch (error: any) {
        console.error('[Brevo] Email send error:', error);
        return {
            success: false,
            error: error.message || 'Failed to send email',
        };
    }
}

/**
 * Send sub-coach invite email
 */
export async function sendSubCoachInvite(params: SubCoachInviteEmailParams): Promise<{ success: boolean; error?: string }> {
    // Use custom scheme for deep linking
    const inviteUrl = `coachingapp://join-team?invite=${params.inviteToken}`;

    const expiryDate = new Date(params.expiresAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const title = params.isRegistered
        ? `Join ${params.parentCoachName}'s Coaching Team`
        : `Invitation to Join ${params.parentCoachName}'s Team`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #1f2937; font-size: 28px; font-weight: 700;">
                Join the Team! 🎉
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong>${params.parentCoachName}</strong> has invited you to join their coaching team on the AI Coaching Platform.
              </p>
              
              ${!params.isRegistered ? `
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                You haven't registered on our platform yet. Click the link below to download the app and create your coach account to get started.
              </p>
              ` : ''}

              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                As a team member, you'll be able to:
              </p>
              
              <ul style="margin: 0 0 30px; padding-left: 24px; color: #4b5563; font-size: 16px; line-height: 1.8;">
                <li>Access shared branding and settings</li>
                <li>Manage assigned clients efficiently</li>
                <li>Collaborate with ${params.parentCoachName}</li>
                <li>Utilize AI tools for coaching</li>
              </ul>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${inviteUrl}" 
                       style="display: inline-block; padding: 16px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Accept Invite →
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Expiry Notice -->
              <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.5; text-align: center;">
                ⏰ This invite expires on <strong>${expiryDate}</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

    return sendEmail({
        to: { email: params.inviteEmail },
        subject: `${params.parentCoachName} invited you to join their coaching team`,
        htmlContent,
    });
}
