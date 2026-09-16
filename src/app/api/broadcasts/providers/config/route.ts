import { NextResponse } from 'next/server';
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { data, error } = await supabase
      .from('broadcast_provider_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      console.error('[broadcast/providers/config GET] fetch error:', error);
      return NextResponse.json({ error: 'Failed to load provider configuration' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        mailchimp_api_key: null,
        mailchimp_from_email: null,
        mailchimp_from_name: null,
        twilio_account_sid: null,
        twilio_auth_token: null,
        twilio_from_number: null,
      });
    }

    return NextResponse.json({
      mailchimp_api_key: !!data.mailchimp_api_key,
      mailchimp_from_email: data.mailchimp_from_email ?? null,
      mailchimp_from_name: data.mailchimp_from_name ?? null,
      twilio_account_sid: data.twilio_account_sid ?? null,
      twilio_auth_token: !!data.twilio_auth_token,
      twilio_from_number: data.twilio_from_number ?? null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return bad('Invalid request body');

    const payload: Record<string, string | null | undefined> = {
      account_id: accountId,
      mailchimp_from_email:
        typeof body.mailchimp_from_email === 'string'
          ? body.mailchimp_from_email.trim() || null
          : null,
      mailchimp_from_name:
        typeof body.mailchimp_from_name === 'string'
          ? body.mailchimp_from_name.trim() || 'Andalabot'
          : 'Andalabot',
      twilio_account_sid:
        typeof body.twilio_account_sid === 'string'
          ? body.twilio_account_sid.trim() || null
          : null,
      twilio_from_number:
        typeof body.twilio_from_number === 'string'
          ? body.twilio_from_number.trim() || null
          : null,
    };

    const { data: existing } = await supabase
      .from('broadcast_provider_config')
      .select('id, mailchimp_api_key, twilio_auth_token')
      .eq('account_id', accountId)
      .maybeSingle();

    if (typeof body.mailchimp_api_key === 'string' && body.mailchimp_api_key.trim()) {
      payload.mailchimp_api_key = encrypt(body.mailchimp_api_key.trim());
    } else if (existing?.mailchimp_api_key && !('mailchimp_api_key' in body)) {
      payload.mailchimp_api_key = existing.mailchimp_api_key;
    }

    if (typeof body.twilio_auth_token === 'string' && body.twilio_auth_token.trim()) {
      payload.twilio_auth_token = encrypt(body.twilio_auth_token.trim());
    } else if (existing?.twilio_auth_token && !('twilio_auth_token' in body)) {
      payload.twilio_auth_token = existing.twilio_auth_token;
    }

    const upsert = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from('broadcast_provider_config')
        .update(upsert)
        .eq('account_id', accountId);

      if (error) {
        console.error('[broadcast/providers/config POST] update error:', error);
        return NextResponse.json({ error: 'Failed to update provider configuration' }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from('broadcast_provider_config').insert(upsert);
      if (error) {
        console.error('[broadcast/providers/config POST] insert error:', error);
        return NextResponse.json({ error: 'Failed to save provider configuration' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
