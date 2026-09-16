'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Eye, EyeOff, Loader2, Mail, MessageSquareText, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';

const MASKED = '••••••••••••••••';

export function BroadcastProviderConfig() {
  const { accountId, profileLoading, canEditSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMailchimpKey, setShowMailchimpKey] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);

  const [mailchimpApiKey, setMailchimpApiKey] = useState('');
  const [mailchimpApiKeyEdited, setMailchimpApiKeyEdited] = useState(false);
  const [mailchimpFromEmail, setMailchimpFromEmail] = useState('');
  const [mailchimpFromName, setMailchimpFromName] = useState('Andalabot');

  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioAuthTokenEdited, setTwilioAuthTokenEdited] = useState(false);
  const [twilioFromNumber, setTwilioFromNumber] = useState('');

  const loadedAccountIdRef = useRef<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/broadcasts/providers/config');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'No se pudo cargar la configuración de proveedores');
        return;
      }

      setMailchimpApiKey(data.mailchimp_api_key ? MASKED : '');
      setMailchimpFromEmail(data.mailchimp_from_email || '');
      setMailchimpFromName(data.mailchimp_from_name || 'Andalabot');

      setTwilioAccountSid(data.twilio_account_sid || '');
      setTwilioAuthToken(data.twilio_auth_token ? MASKED : '');
      setTwilioFromNumber(data.twilio_from_number || '');
    } catch {
      toast.error('No se pudo cargar la configuración de proveedores');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (profileLoading) return;
    if (!accountId) {
      setLoading(false);
      return;
    }
    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchConfig();
  }, [accountId, profileLoading, fetchConfig]);

  async function handleSave() {
    if (!accountId) return;
    setSaving(true);

    try {
      const payload = {
        mailchimp_api_key: mailchimpApiKeyEdited && mailchimpApiKey.trim() ? mailchimpApiKey.trim() : undefined,
        mailchimp_from_email: mailchimpFromEmail.trim() || null,
        mailchimp_from_name: mailchimpFromName.trim() || 'Andalabot',
        twilio_account_sid: twilioAccountSid.trim() || null,
        twilio_auth_token: twilioAuthTokenEdited && twilioAuthToken.trim() ? twilioAuthToken.trim() : undefined,
        twilio_from_number: twilioFromNumber.trim() || null,
      };

      const res = await fetch('/api/broadcasts/providers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'No se pudo guardar la configuración');
        return;
      }

      if (mailchimpApiKeyEdited) setMailchimpApiKey(MASKED);
      if (twilioAuthTokenEdited) setTwilioAuthToken(MASKED);
      setMailchimpApiKeyEdited(false);
      setTwilioAuthTokenEdited(false);
      toast.success('Proveedores guardados correctamente');
      await fetchConfig();
    } catch {
      toast.error('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando proveedores...
      </div>
    );
  }

  const readonly = !canEditSettings;

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="Proveedores de difusión"
        description="Configura Mailchimp y Twilio para enviar campañas por email y SMS desde tu cuenta."
      />

      {!canEditSettings && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Solo admin puede editar las credenciales de proveedores.
        </p>
      )}

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Credenciales seguras</AlertTitle>
        <AlertDescription>
          Las claves se guardan cifradas por cuenta y no se exponen en la UI una vez guardadas.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Mailchimp / Email
          </CardTitle>
          <CardDescription>Credenciales para campañas por correo electrónico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mailchimp-api-key">API key</Label>
            <div className="flex gap-2">
              <Input
                id="mailchimp-api-key"
                type={showMailchimpKey ? 'text' : 'password'}
                placeholder="Ingrese la API key de Mailchimp"
                value={mailchimpApiKey}
                disabled={readonly}
                onChange={(e) => {
                  const next = e.target.value;
                  setMailchimpApiKey(next);
                  setMailchimpApiKeyEdited(true);
                }}
              />
              <Button type="button" variant="outline" size="icon" disabled={readonly} onClick={() => setShowMailchimpKey((prev) => !prev)}>
                {showMailchimpKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mailchimp-from-email">From email</Label>
              <Input
                id="mailchimp-from-email"
                type="email"
                placeholder="ventas@tuempresa.com"
                value={mailchimpFromEmail}
                disabled={readonly}
                onChange={(e) => setMailchimpFromEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mailchimp-from-name">From name</Label>
              <Input
                id="mailchimp-from-name"
                placeholder="Andalabot"
                value={mailchimpFromName}
                disabled={readonly}
                onChange={(e) => setMailchimpFromName(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" /> Twilio / SMS
          </CardTitle>
          <CardDescription>Credenciales para campañas por mensajes de texto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="twilio-account-sid">Account SID</Label>
              <Input
                id="twilio-account-sid"
                value={twilioAccountSid}
                disabled={readonly}
                onChange={(e) => setTwilioAccountSid(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-from-number">Número Remitente</Label>
              <Input
                id="twilio-from-number"
                value={twilioFromNumber}
                disabled={readonly}
                onChange={(e) => setTwilioFromNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="twilio-auth-token">Auth token</Label>
            <div className="flex gap-2">
              <Input
                id="twilio-auth-token"
                type={showTwilioToken ? 'text' : 'password'}
                placeholder="Ingrese el auth token de Twilio"
                value={twilioAuthToken}
                disabled={readonly}
                onChange={(e) => {
                  const next = e.target.value;
                  setTwilioAuthToken(next);
                  setTwilioAuthTokenEdited(true);
                }}
              />
              <Button type="button" variant="outline" size="icon" disabled={readonly} onClick={() => setShowTwilioToken((prev) => !prev)}>
                {showTwilioToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <Button onClick={handleSave} disabled={readonly || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
