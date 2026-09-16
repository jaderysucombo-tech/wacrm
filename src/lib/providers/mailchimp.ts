import { resolveMailchimpCredentials } from '@/lib/providers/config';

export interface MailchimpMessagePayload {
  to: string;
  subject: string;
  message: string;
  fromEmail?: string;
  fromName?: string;
  apiKey?: string | null;
}

export async function sendMailchimpEmail({
  to,
  subject,
  message,
  fromEmail,
  fromName,
  apiKey,
}: MailchimpMessagePayload) {
  const credentials = resolveMailchimpCredentials({
    apiKey,
    fromEmail,
    fromName,
    fallbackApiKey: process.env.MAILCHIMP_API_KEY,
    fallbackFromEmail: process.env.MAILCHIMP_FROM_EMAIL,
    fallbackFromName: process.env.MAILCHIMP_FROM_NAME,
  });

  if (!credentials.apiKey || !credentials.fromEmail) {
    throw new Error('Mailchimp is not configured. Set the provider config in Settings or the MAILCHIMP_API_KEY / MAILCHIMP_FROM_EMAIL env vars.');
  }

  const response = await fetch('https://mandrillapp.com/api/1.0/messages/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: credentials.apiKey,
      message: {
        from_email: credentials.fromEmail,
        from_name: credentials.fromName,
        to: [
          {
            email: to,
            type: 'to',
          },
        ],
        subject,
        text: message,
        html: message,
      },
    }),
  });

  const payload = (await response.json()) as Array<{ status?: string; reject_reason?: string; email?: string }>;

  if (!response.ok) {
    throw new Error('Mailchimp request failed');
  }

  const first = payload[0];

  if (!first || first.status !== 'sent') {
    throw new Error(first?.reject_reason || 'Mailchimp rejected the message');
  }

  return {
    provider: 'mailchimp',
    status: first.status,
    recipient: first.email || to,
  };
}
