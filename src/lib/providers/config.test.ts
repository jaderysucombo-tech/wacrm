import { describe, expect, it } from 'vitest';
import {
  resolveMailchimpCredentials,
  resolveTwilioCredentials,
} from '@/lib/providers/config';

describe('provider credential resolution', () => {
  it('prefers the explicit saved config over env defaults', () => {
    const mailchimp = resolveMailchimpCredentials({
      apiKey: 'saved-key',
      fromEmail: 'hello@demo.com',
      fromName: 'Demo Brand',
      fallbackApiKey: 'env-key',
      fallbackFromEmail: 'fallback@demo.com',
      fallbackFromName: 'Fallback Brand',
    });

    expect(mailchimp.apiKey).toBe('saved-key');
    expect(mailchimp.fromEmail).toBe('hello@demo.com');
    expect(mailchimp.fromName).toBe('Demo Brand');
  });

  it('keeps Twilio credentials valid when body overrides are passed', () => {
    const twilio = resolveTwilioCredentials({
      accountSid: 'saved-sid',
      authToken: 'saved-token',
      from: '+12025550123',
      fallbackAccountSid: 'env-sid',
      fallbackAuthToken: 'env-token',
      fallbackFrom: '+12025550000',
    });

    expect(twilio.accountSid).toBe('saved-sid');
    expect(twilio.authToken).toBe('saved-token');
    expect(twilio.from).toBe('+12025550123');
  });
});
