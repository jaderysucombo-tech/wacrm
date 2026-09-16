import { resolveTwilioCredentials } from '@/lib/providers/config';

export interface TwilioSmsPayload {
  to: string;
  body: string;
  from?: string;
  accountSid?: string | null;
  authToken?: string | null;
}

export async function sendTwilioSms({
  to,
  body,
  from,
  accountSid,
  authToken,
}: TwilioSmsPayload) {
  const credentials = resolveTwilioCredentials({
    accountSid,
    authToken,
    from,
    fallbackAccountSid: process.env.TWILIO_ACCOUNT_SID,
    fallbackAuthToken: process.env.TWILIO_AUTH_TOKEN,
    fallbackFrom: process.env.TWILIO_FROM_NUMBER,
  });

  if (!credentials.accountSid || !credentials.authToken || !credentials.from) {
    throw new Error('Twilio is not configured. Set the provider config in Settings or the TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER env vars.');
  }

  const params = new URLSearchParams({
    From: credentials.from,
    To: to,
    Body: body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  );

  const payload = (await response.json()) as {
    sid?: string;
    status?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message || 'Twilio request failed');
  }

  return {
    provider: 'twilio',
    status: payload.status || 'queued',
    sid: payload.sid,
    recipient: to,
  };
}
