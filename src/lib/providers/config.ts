export interface ResolveMailchimpCredentialsInput {
  apiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  fallbackApiKey?: string;
  fallbackFromEmail?: string;
  fallbackFromName?: string;
}

export interface ResolveTwilioCredentialsInput {
  accountSid?: string | null;
  authToken?: string | null;
  from?: string | null;
  fallbackAccountSid?: string;
  fallbackAuthToken?: string;
  fallbackFrom?: string;
}

export function resolveMailchimpCredentials({
  apiKey,
  fromEmail,
  fromName,
  fallbackApiKey = '',
  fallbackFromEmail = '',
  fallbackFromName = 'Andalabot',
}: ResolveMailchimpCredentialsInput) {
  return {
    apiKey: (apiKey ?? fallbackApiKey).trim(),
    fromEmail: (fromEmail ?? fallbackFromEmail).trim(),
    fromName: (fromName ?? fallbackFromName).trim() || 'Andalabot',
  };
}

export function resolveTwilioCredentials({
  accountSid,
  authToken,
  from,
  fallbackAccountSid = '',
  fallbackAuthToken = '',
  fallbackFrom = '',
}: ResolveTwilioCredentialsInput) {
  return {
    accountSid: (accountSid ?? fallbackAccountSid).trim(),
    authToken: (authToken ?? fallbackAuthToken).trim(),
    from: (from ?? fallbackFrom).trim(),
  };
}
