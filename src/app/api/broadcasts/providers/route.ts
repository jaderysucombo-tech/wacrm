import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sendMailchimpEmail } from '@/lib/providers/mailchimp';
import { sendTwilioSms } from '@/lib/providers/twilio';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      channel,
      to,
      recipients,
      subject,
      message,
      fromEmail,
      fromName,
      fromNumber,
    } = body as {
      channel: 'email' | 'sms';
      to?: string;
      recipients?: string[];
      subject?: string;
      message: string;
      fromEmail?: string;
      fromName?: string;
      fromNumber?: string;
    };

    const destinationList = Array.from(
      new Set(
        (recipients && recipients.length > 0 ? recipients : to ? [to] : []).filter(
          (value): value is string => Boolean(value && typeof value === 'string' && value.trim()),
        ),
      ),
    );

    if (!channel || destinationList.length === 0 || !message) {
      return NextResponse.json(
        { error: 'channel, recipients and message are required' },
        { status: 400 },
      );
    }

    const { supabase, accountId } = await getCurrentAccount();
    const { data: providerConfig } = await supabase
      .from('broadcast_provider_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    const savedMailchimpApiKey = providerConfig?.mailchimp_api_key
      ? decrypt(providerConfig.mailchimp_api_key)
      : undefined;
    const savedMailchimpFromEmail = providerConfig?.mailchimp_from_email || undefined;
    const savedMailchimpFromName = providerConfig?.mailchimp_from_name || undefined;
    const savedTwilioAccountSid = providerConfig?.twilio_account_sid || undefined;
    const savedTwilioAuthToken = providerConfig?.twilio_auth_token
      ? decrypt(providerConfig.twilio_auth_token)
      : undefined;
    const savedTwilioFromNumber = providerConfig?.twilio_from_number || undefined;

    const results: Array<{ recipient: string; provider: string; status: string }> = [];

    if (channel === 'email') {
      for (const recipient of destinationList) {
        const result = await sendMailchimpEmail({
          to: recipient,
          subject: subject || 'Andalabot campaign',
          message,
          fromEmail: fromEmail || savedMailchimpFromEmail,
          fromName: fromName || savedMailchimpFromName,
          apiKey: savedMailchimpApiKey,
        });
        results.push({ recipient, provider: result.provider, status: result.status });
      }

      return NextResponse.json({ success: true, sent: results.length, results });
    }

    if (channel === 'sms') {
      for (const recipient of destinationList) {
        const result = await sendTwilioSms({
          to: recipient,
          body: message,
          from: fromNumber || savedTwilioFromNumber,
          accountSid: savedTwilioAccountSid,
          authToken: savedTwilioAuthToken,
        });
        results.push({ recipient, provider: result.provider, status: result.status });
      }

      return NextResponse.json({ success: true, sent: results.length, results });
    }

    return NextResponse.json({ error: 'Unsupported channel' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider send failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
